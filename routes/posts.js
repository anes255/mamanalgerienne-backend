const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/posts/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10 // Maximum 10 files
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Get all posts with filters
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const type = req.query.type; // 'ad', 'community', or undefined for all
    const category = req.query.category;
    const featured = req.query.featured === 'true';

    let query = { approved: true };
    
    if (type) {
      query.type = type;
    }
    
    if (category) {
      query.category = category;
    }
    
    if (featured) {
      query.featured = true;
    }

    const posts = await Post.find(query)
      .populate('author', 'name avatar')
      .sort({ featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments(query);

    res.json({
      posts,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'خطأ في جلب المنشورات' });
  }
});

// Get single post
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'name avatar');
    
    if (!post) {
      return res.status(404).json({ message: 'المنشور غير موجود' });
    }

    // Increment views if not the author
    if (!req.user || post.author._id.toString() !== req.user._id.toString()) {
      post.views = (post.views || 0) + 1;
      await post.save();
    }

    res.json(post);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'خطأ في جلب المنشور' });
  }
});

// Create new community post
router.post('/community', auth, upload.array('images', 10), async (req, res) => {
  try {
    const { title, content, category } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'العنوان والمحتوى مطلوبان' });
    }

    const images = req.files ? req.files.map(file => file.filename) : [];

    const post = new Post({
      title,
      content,
      category: category || 'عام',
      type: 'community',
      author: req.user._id,
      images,
      approved: true // Auto-approve community posts
    });

    await post.save();
    await post.populate('author', 'name avatar');

    res.status(201).json({
      message: 'تم إنشاء المنشور بنجاح',
      post
    });
  } catch (error) {
    console.error('Create community post error:', error);
    res.status(500).json({ message: 'خطأ في إنشاء المنشور' });
  }
});

// Create new ad post (Admin only)
router.post('/ad', adminAuth, upload.array('images', 10), async (req, res) => {
  try {
    const { title, content, link, buttonText, featured } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'العنوان والمحتوى مطلوبان' });
    }

    const images = req.files ? req.files.map(file => file.filename) : [];

    const post = new Post({
      title,
      content,
      type: 'ad',
      author: req.user._id,
      images,
      approved: true,
      featured: featured === 'true',
      adDetails: {
        link: link || '',
        buttonText: buttonText || 'اقرأ المزيد',
        featured: featured === 'true'
      }
    });

    await post.save();
    await post.populate('author', 'name avatar');

    res.status(201).json({
      message: 'تم إنشاء الإعلان بنجاح',
      post
    });
  } catch (error) {
    console.error('Create ad post error:', error);
    res.status(500).json({ message: 'خطأ في إنشاء الإعلان' });
  }
});

// Update post
router.put('/:id', auth, upload.array('images', 10), async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'المنشور غير موجود' });
    }

    // Check if user owns the post or is admin
    if (post.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'غير مسموح لك بتعديل هذا المنشور' });
    }

    const { title, content, category, link, buttonText, featured } = req.body;

    // Update basic fields
    if (title) post.title = title;
    if (content) post.content = content;
    if (category) post.category = category;
    
    // Update admin-only fields
    if (req.user.isAdmin) {
      if (featured !== undefined) post.featured = featured === 'true';
      
      if (post.type === 'ad') {
        post.adDetails = {
          link: link || post.adDetails?.link || '',
          buttonText: buttonText || post.adDetails?.buttonText || 'اقرأ المزيد',
          featured: featured === 'true'
        };
      }
    }

    // Handle new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => file.filename);
      post.images = [...(post.images || []), ...newImages];
    }

    await post.save();
    await post.populate('author', 'name avatar');

    res.json({
      message: 'تم تحديث المنشور بنجاح',
      post
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ message: 'خطأ في تحديث المنشور' });
  }
});

// Delete post (Author or Admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'المنشور غير موجود' });
    }

    // Check if user owns the post or is admin
    if (post.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'غير مسموح لك بحذف هذا المنشور' });
    }

    // Delete associated images
    if (post.images && post.images.length > 0) {
      post.images.forEach(image => {
        const imagePath = path.join(__dirname, '..', 'uploads', 'posts', image);
        if (fs.existsSync(imagePath)) {
          try {
            fs.unlinkSync(imagePath);
            console.log(`Deleted image: ${imagePath}`);
          } catch (err) {
            console.error(`Error deleting image ${imagePath}:`, err);
          }
        }
      });
    }

    // Delete all comments associated with this post
    const deletedComments = await Comment.deleteMany({ 
      targetType: 'Post', 
      targetId: post._id 
    });
    
    console.log(`Deleted ${deletedComments.deletedCount} comments for post ${post._id}`);

    // Delete the post
    await Post.findByIdAndDelete(req.params.id);

    res.json({ 
      message: 'تم حذف المنشور بنجاح',
      deletedComments: deletedComments.deletedCount
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'خطأ في حذف المنشور' });
  }
});

// Like/Unlike post
router.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'المنشور غير موجود' });
    }

    const userIndex = post.likes.indexOf(req.user._id);
    
    if (userIndex > -1) {
      // Unlike
      post.likes.splice(userIndex, 1);
    } else {
      // Like
      post.likes.push(req.user._id);
    }

    await post.save();

    res.json({
      message: userIndex > -1 ? 'تم إلغاء الإعجاب' : 'تم الإعجاب بالمنشور',
      likesCount: post.likes.length,
      isLiked: userIndex === -1
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'خطأ في الإعجاب بالمنشور' });
  }
});

// Get user's posts
router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {
      author: req.params.userId,
      approved: true
    };

    const posts = await Post.find(query)
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments(query);

    res.json({
      posts,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ message: 'خطأ في جلب منشورات المستخدم' });
  }
});

// Admin: Toggle post approval
router.patch('/:id/approve', adminAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'المنشور غير موجود' });
    }

    post.approved = !post.approved;
    await post.save();

    res.json({
      message: post.approved ? 'تم الموافقة على المنشور' : 'تم رفض المنشور',
      approved: post.approved
    });
  } catch (error) {
    console.error('Toggle post approval error:', error);
    res.status(500).json({ message: 'خطأ في تغيير حالة الموافقة' });
  }
});

// Admin: Toggle post featured status
router.patch('/:id/featured', adminAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'المنشور غير موجود' });
    }

    post.featured = !post.featured;
    await post.save();

    res.json({
      message: post.featured ? 'تم تمييز المنشور' : 'تم إلغاء تمييز المنشور',
      featured: post.featured
    });
  } catch (error) {
    console.error('Toggle post featured error:', error);
    res.status(500).json({ message: 'خطأ في تغيير حالة التمييز' });
  }
});

// Search posts
router.get('/search/:query', optionalAuth, async (req, res) => {
  try {
    const { query } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const searchRegex = new RegExp(query, 'i');
    
    const posts = await Post.find({
      approved: true,
      $or: [
        { title: { $regex: searchRegex } },
        { content: { $regex: searchRegex } }
      ]
    })
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({
      approved: true,
      $or: [
        { title: { $regex: searchRegex } },
        { content: { $regex: searchRegex } }
      ]
    });

    res.json({
      posts,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Search posts error:', error);
    res.status(500).json({ message: 'خطأ في البحث عن المنشورات' });
  }
});

module.exports = router;