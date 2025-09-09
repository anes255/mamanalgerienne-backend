const express = require('express');
const multer = require('multer');
const path = require('path');
const Article = require('../models/Article');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Multer setup for article images
const storage = multer.diskStorage({
  destination: './uploads/articles/',
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Get all articles
router.get('/', optionalAuth, async (req, res) => {
  try {
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
      query.$text = { $search: search };
    }

    if (category) {
      query.category = category;
    }

    if (featured === 'true') {
      query.featured = true;
    }

    const articles = await Article.find(query)
      .populate('author', 'name avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Article.countDocuments(query);

    res.json({
      articles,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get articles error:', error);
    res.status(500).json({ message: 'خطأ في جلب المقالات' });
  }
});

// Get single article
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id)
      .populate('author', 'name avatar');

    if (!article) {
      return res.status(404).json({ message: 'المقال غير موجود' });
    }

    // Increment views
    article.views += 1;
    await article.save();

    res.json(article);
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ message: 'خطأ في جلب المقال' });
  }
});

// Get articles by category
router.get('/category/:category', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const articles = await Article.find({ 
      category: req.params.category, 
      published: true 
    })
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Article.countDocuments({ 
      category: req.params.category, 
      published: true 
    });

    res.json({
      articles,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get category articles error:', error);
    res.status(500).json({ message: 'خطأ في جلب مقالات التصنيف' });
  }
});

// Create article (admin only)
router.post('/', adminAuth, upload.array('images', 5), async (req, res) => {
  try {
    const { title, content, excerpt, category, featured, tags } = req.body;

    if (!title || !content || !excerpt || !category) {
      return res.status(400).json({ message: 'جميع الحقول المطلوبة يجب ملؤها' });
    }

    const images = req.files ? req.files.map(file => file.filename) : [];

    const article = new Article({
      title,
      content,
      excerpt,
      category,
      images,
      author: req.user._id,
      featured: featured === 'true',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    });

    await article.save();
    await article.populate('author', 'name avatar');

    res.status(201).json({
      message: 'تم إنشاء المقال بنجاح',
      article
    });
  } catch (error) {
    console.error('Create article error:', error);
    res.status(500).json({ message: 'خطأ في إنشاء المقال' });
  }
});

// Update article (admin only)
router.put('/:id', adminAuth, upload.array('images', 5), async (req, res) => {
  try {
    const { title, content, excerpt, category, featured, tags } = req.body;

    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ message: 'المقال غير موجود' });
    }

    // Update fields
    if (title) article.title = title;
    if (content) article.content = content;
    if (excerpt) article.excerpt = excerpt;
    if (category) article.category = category;
    if (featured !== undefined) article.featured = featured === 'true';
    if (tags) article.tags = tags.split(',').map(tag => tag.trim());

    // Add new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => file.filename);
      article.images = [...article.images, ...newImages];
    }

    await article.save();
    await article.populate('author', 'name avatar');

    res.json({
      message: 'تم تحديث المقال بنجاح',
      article
    });
  } catch (error) {
    console.error('Update article error:', error);
    res.status(500).json({ message: 'خطأ في تحديث المقال' });
  }
});

// Delete article (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ message: 'المقال غير موجود' });
    }

    await Article.findByIdAndDelete(req.params.id);

    res.json({ message: 'تم حذف المقال بنجاح' });
  } catch (error) {
    console.error('Delete article error:', error);
    res.status(500).json({ message: 'خطأ في حذف المقال' });
  }
});

// Like/Unlike article
router.post('/:id/like', auth, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ message: 'المقال غير موجود' });
    }

    const userIndex = article.likes.indexOf(req.user._id);
    
    if (userIndex > -1) {
      // Unlike
      article.likes.splice(userIndex, 1);
    } else {
      // Like
      article.likes.push(req.user._id);
    }

    await article.save();

    res.json({
      message: userIndex > -1 ? 'تم إلغاء الإعجاب' : 'تم الإعجاب بالمقال',
      likesCount: article.likes.length,
      isLiked: userIndex === -1
    });
  } catch (error) {
    console.error('Like article error:', error);
    res.status(500).json({ message: 'خطأ في الإعجاب بالمقال' });
  }
});

module.exports = router;