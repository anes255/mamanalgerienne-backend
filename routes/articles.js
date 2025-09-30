const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Import middleware
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');

// Ensure upload directory exists
const uploadDir = './uploads/articles';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration for article images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('فقط الصور مسموح بها (JPEG, PNG, GIF, WEBP)'));
    }
  }
});

// ==========================================
// GET ALL ARTICLES
// ==========================================
router.get('/', optionalAuth, async (req, res) => {
  try {
    const Article = mongoose.model('Article');
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search;
    const category = req.query.category;
    const featured = req.query.featured;
    const sort = req.query.sort || '-createdAt';

    // Build query
    const query = { published: true };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } }
      ];
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (featured === 'true') {
      query.featured = true;
    }

    const articles = await Article.find(query)
      .populate('author', 'name avatar email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Article.countDocuments(query);

    res.json({
      success: true,
      articles,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get articles error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في جلب المقالات',
      error: error.message 
    });
  }
});

// ==========================================
// GET SINGLE ARTICLE
// ==========================================
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const Article = mongoose.model('Article');
    
    const article = await Article.findById(req.params.id)
      .populate('author', 'name avatar email')
      .lean();

    if (!article) {
      return res.status(404).json({ 
        success: false,
        message: 'المقال غير موجود' 
      });
    }

    // Increment views
    await Article.findByIdAndUpdate(req.params.id, { 
      $inc: { views: 1 } 
    });

    res.json({
      success: true,
      article
    });
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في جلب المقال',
      error: error.message
    });
  }
});

// ==========================================
// GET ARTICLES BY CATEGORY
// ==========================================
router.get('/category/:category', optionalAuth, async (req, res) => {
  try {
    const Article = mongoose.model('Article');
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const articles = await Article.find({ 
      category: req.params.category, 
      published: true 
    })
      .populate('author', 'name avatar email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Article.countDocuments({ 
      category: req.params.category, 
      published: true 
    });

    res.json({
      success: true,
      articles,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get category articles error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في جلب مقالات التصنيف',
      error: error.message
    });
  }
});

// ==========================================
// CREATE ARTICLE (ADMIN ONLY) - FIXED
// ==========================================
router.post('/', adminAuth, upload.array('images', 5), async (req, res) => {
  try {
    const Article = mongoose.model('Article');
    
    console.log('📝 Creating article...');
    console.log('User:', req.user ? req.user._id : 'No user');
    console.log('User email:', req.user ? req.user.email : 'No email');
    console.log('Body:', req.body);
    console.log('Files:', req.files ? req.files.length : 0);

    const { title, content, excerpt, category, featured, tags } = req.body;

    // Validation
    if (!title || !content || !excerpt || !category) {
      // Delete uploaded files if validation fails
      if (req.files) {
        req.files.forEach(file => {
          fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        });
      }
      
      return res.status(400).json({ 
        success: false,
        message: 'جميع الحقول المطلوبة يجب ملؤها (العنوان، المحتوى، المقتطف، التصنيف)' 
      });
    }

    // CRITICAL FIX: Ensure author is set from authenticated user
    if (!req.user || !req.user._id) {
      if (req.files) {
        req.files.forEach(file => {
          fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'خطأ في المصادقة - لم يتم العثور على معرف المستخدم'
      });
    }

    // Process uploaded images
    const images = req.files ? req.files.map(file => `/uploads/articles/${file.filename}`) : [];

    // Process tags
    let tagsArray = [];
    if (tags) {
      if (typeof tags === 'string') {
        tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      } else if (Array.isArray(tags)) {
        tagsArray = tags;
      }
    }

    // Create article with proper author field
    const articleData = {
      title: title.trim(),
      content: content.trim(),
      excerpt: excerpt.trim(),
      category,
      images,
      author: req.user._id, // ✅ FIXED: Use req.user._id from auth middleware
      featured: featured === 'true' || featured === true,
      tags: tagsArray,
      published: true
    };

    console.log('Article data before save:', {
      title: articleData.title,
      author: articleData.author,
      authorType: typeof articleData.author,
      category: articleData.category
    });

    const article = new Article(articleData);
    await article.save();
    
    // Populate author details
    await article.populate('author', 'name avatar email');

    console.log('✅ Article created successfully:', article._id);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء المقال بنجاح',
      article
    });

  } catch (error) {
    console.error('❌ Create article error:', error);
    
    // Delete uploaded files if article creation failed
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'خطأ في إنشاء المقال: ' + error.message,
      error: error.message
    });
  }
});

// ==========================================
// UPDATE ARTICLE (ADMIN ONLY)
// ==========================================
router.put('/:id', adminAuth, upload.array('images', 5), async (req, res) => {
  try {
    const Article = mongoose.model('Article');
    
    const { title, content, excerpt, category, featured, tags, removeImages } = req.body;

    const article = await Article.findById(req.params.id);
    if (!article) {
      // Delete uploaded files
      if (req.files) {
        req.files.forEach(file => {
          fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        });
      }
      
      return res.status(404).json({ 
        success: false,
        message: 'المقال غير موجود' 
      });
    }

    // Update fields
    if (title) article.title = title.trim();
    if (content) article.content = content.trim();
    if (excerpt) article.excerpt = excerpt.trim();
    if (category) article.category = category;
    if (featured !== undefined) article.featured = featured === 'true' || featured === true;
    
    if (tags) {
      if (typeof tags === 'string') {
        article.tags = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      } else if (Array.isArray(tags)) {
        article.tags = tags;
      }
    }

    // Remove specified images
    if (removeImages) {
      const imagesToRemove = typeof removeImages === 'string' ? removeImages.split(',') : removeImages;
      article.images = article.images.filter(img => !imagesToRemove.includes(img));
      
      // Delete files from disk
      imagesToRemove.forEach(imgPath => {
        const filePath = path.join(__dirname, '..', imgPath);
        fs.unlink(filePath, (err) => {
          if (err) console.error('Error deleting image:', err);
        });
      });
    }

    // Add new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => `/uploads/articles/${file.filename}`);
      article.images = [...article.images, ...newImages];
    }

    await article.save();
    await article.populate('author', 'name avatar email');

    res.json({
      success: true,
      message: 'تم تحديث المقال بنجاح',
      article
    });
  } catch (error) {
    console.error('Update article error:', error);
    
    // Delete uploaded files if update failed
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'خطأ في تحديث المقال',
      error: error.message
    });
  }
});

// ==========================================
// DELETE ARTICLE (ADMIN ONLY)
// ==========================================
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const Article = mongoose.model('Article');
    
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ 
        success: false,
        message: 'المقال غير موجود' 
      });
    }

    // Delete associated images
    if (article.images && article.images.length > 0) {
      article.images.forEach(imgPath => {
        const filePath = path.join(__dirname, '..', imgPath);
        fs.unlink(filePath, (err) => {
          if (err) console.error('Error deleting image:', err);
        });
      });
    }

    await Article.findByIdAndDelete(req.params.id);

    res.json({ 
      success: true,
      message: 'تم حذف المقال بنجاح' 
    });
  } catch (error) {
    console.error('Delete article error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في حذف المقال',
      error: error.message
    });
  }
});

// ==========================================
// LIKE/UNLIKE ARTICLE
// ==========================================
router.post('/:id/like', auth, async (req, res) => {
  try {
    const Article = mongoose.model('Article');
    
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ 
        success: false,
        message: 'المقال غير موجود' 
      });
    }

    const userIdStr = req.user._id.toString();
    const likeIndex = article.likes.findIndex(like => like.toString() === userIdStr);
    
    if (likeIndex > -1) {
      // Unlike
      article.likes.splice(likeIndex, 1);
    } else {
      // Like
      article.likes.push(req.user._id);
    }

    await article.save();

    res.json({
      success: true,
      message: likeIndex > -1 ? 'تم إلغاء الإعجاب' : 'تم الإعجاب بالمقال',
      likesCount: article.likes.length,
      isLiked: likeIndex === -1
    });
  } catch (error) {
    console.error('Like article error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في الإعجاب بالمقال',
      error: error.message
    });
  }
});

module.exports = router;
