const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Import models only if they exist
let Post, Comment;
try {
  Post = require('../models/Post');
  Comment = require('../models/Comment');
} catch (error) {
  console.log('Models not found, using fallback');
}

// Import middleware only if it exists
let auth, adminAuth, optionalAuth;
try {
  const authMiddleware = require('../middleware/auth');
  auth = authMiddleware.auth;
  adminAuth = authMiddleware.adminAuth;
  optionalAuth = authMiddleware.optionalAuth;
} catch (error) {
  console.log('Auth middleware not found, using fallback');
  // Fallback auth middleware
  auth = (req, res, next) => {
    req.user = { _id: 'test-user', isAdmin: false };
    next();
  };
  adminAuth = (req, res, next) => {
    req.user = { _id: 'test-admin', isAdmin: true };
    next();
  };
  optionalAuth = (req, res, next) => {
    req.user = null;
    next();
  };
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads/posts/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
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

// Sample data for fallback
const samplePosts = [
  {
    _id: 'ad1',
    title: 'عرض خاص على منتجات الأطفال',
    content: 'تخفيضات كبيرة على جميع منتجات الأطفال لفترة محدودة. اكتشفي مجموعتنا المتنوعة من الألعاب التعليمية، الملابس، ومستلزمات الرضاعة بأسعار مميزة.',
    type: 'ad',
    author: {
      _id: 'admin',
      name: 'إدارة الموقع',
      avatar: null
    },
    adDetails: {
      link: 'https://example.com/children-products',
      buttonText: 'تسوقي الآن',
      featured: true
    },
    images: [],
    views: 150,
    likes: [],
    approved: true,
    featured: true,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'ad2',
    title: 'دورة تدريبية للأمهات الجدد',
    content: 'انضمي إلى دورتنا التدريبية المجانية للأمهات الجدد. تعلمي أساسيات رعاية الطفل والرضاعة الطبيعية مع خبيرات متخصصات.',
    type: 'ad',
    author: {
      _id: 'admin',
      name: 'إدارة الموقع',
      avatar: null
    },
    adDetails: {
      link: 'https://example.com/mothers-course',
      buttonText: 'سجلي الآن',
      featured: false
    },
    images: [],
    views: 89,
    likes: [],
    approved: true,
    featured: false,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: 'community1',
    title: 'تجربتي مع الرضاعة الطبيعية',
    content: 'أردت أن أشارككن تجربتي مع الرضاعة الطبيعية. في البداية كانت صعبة جداً ولكن مع الصبر والمثابرة أصبحت أسهل...',
    type: 'community',
    category: 'تجارب',
    author: {
      _id: 'user1',
      name: 'أم محمد',
      avatar: null
    },
    images: [],
    views: 45,
    likes: ['user2', 'user3'],
    approved: true,
    featured: false,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Get all posts with filters
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const type = req.query.type; // 'ad', 'community', or undefined for all
    const category = req.query.category;
    const featured = req.query.featured === 'true';

    if (!Post) {
      // Fallback with sample data
      let filteredPosts = [...samplePosts];
      
      if (type) {
        filteredPosts = filteredPosts.filter(post => post.type === type);
      }
      
      if (category) {
        filteredPosts = filteredPosts.filter(post => post.category === category);
      }
      
      if (featured) {
        filteredPosts = filteredPosts.filter(post => post.featured === true);
      }

      const paginatedPosts = filteredPosts.slice(skip, skip + limit);

      return res.json({
        posts: paginatedPosts,
        pagination: {
          current: page,
          pages: Math.ceil(filteredPosts.length / limit),
          total: filteredPosts.length
        }
      });
    }

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
    if (!Post) {
      // Fallback with sample data
      const post = samplePosts.find(p => p._id === req.params.id);
      if (!post) {
        return res.status(404).json({ message: 'المنشور غير موجود' });
      }
      return res.json(post);
    }

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

    if (!Post) {
      return res.status(503).json({ message: 'خدمة المنشورات غير متاحة حالياً' });
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

    if (!Post) {
      return res.status(503).json({ message: 'خدمة المنشورات غير متاحة حالياً' });
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
    if (!Post) {
      return res.status(503).json({ message: 'خدمة المنشورات غير متاحة حالياً' });
    }

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

// Delete post
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!Post) {
      return res.status(503).json({ message: 'خدمة المنشورات غير متاحة حالياً' });
    }

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
    let deletedComments = 0;
    if (Comment) {
      const deleteResult = await Comment.deleteMany({ 
        targetType: 'Post', 
        targetId: post._id 
      });
      deletedComments = deleteResult.deletedCount;
    }

    // Delete the post
    await Post.findByIdAndDelete(req.params.id);

    res.json({ 
      message: 'تم حذف المنشور بنجاح',
      deletedComments
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'خطأ في حذف المنشور' });
  }
});

// Like/Unlike post
router.post('/:id/like', auth, async (req, res) => {
  try {
    if (!Post) {
      return res.status(503).json({ message: 'خدمة المنشورات غير متاحة حالياً' });
    }

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

    if (!Post) {
      return res.json({
        posts: [],
        pagination: { current: 1, pages: 0, total: 0 }
      });
    }

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

module.exports = router;
