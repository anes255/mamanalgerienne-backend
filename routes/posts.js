// routes/posts.js - Post Routes
// ==========================================
const express2 = require('express');
const router2 = express2.Router();
const multer2 = require('multer');
const path2 = require('path');
const fs2 = require('fs');
const mongoose2 = require('mongoose');
const { auth: auth2, optionalAuth: optionalAuth2 } = require('../middleware/auth');

// Ensure upload directory exists
const uploadDir2 = './uploads/posts';
if (!fs2.existsSync(uploadDir2)) {
  fs2.mkdirSync(uploadDir2, { recursive: true });
}

// Multer configuration
const storage2 = multer2.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir2),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path2.extname(file.originalname));
  }
});

const upload2 = multer2({
  storage: storage2,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path2.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    cb(mimetype && extname ? null : new Error('فقط الصور مسموح بها'), mimetype && extname);
  }
});

// GET all posts
router2.get('/', optionalAuth2, async (req, res) => {
  try {
    const Post = mongoose2.model('Post');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Post.countDocuments();

    res.json({
      success: true,
      posts,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب المنشورات', error: error.message });
  }
});

// CREATE post
router2.post('/', auth2, upload2.array('images', 5), async (req, res) => {
  try {
    const Post = mongoose2.model('Post');
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'محتوى المنشور مطلوب' });
    }

    const images = req.files ? req.files.map(file => `/uploads/posts/${file.filename}`) : [];

    const post = new Post({
      content: content.trim(),
      images,
      author: req.user._id
    });

    await post.save();
    await post.populate('author', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'تم إنشاء المنشور بنجاح',
      post
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في إنشاء المنشور', error: error.message });
  }
});

// LIKE post
router2.post('/:id/like', auth2, async (req, res) => {
  try {
    const Post = mongoose2.model('Post');
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ success: false, message: 'المنشور غير موجود' });
    }

    const userIdStr = req.user._id.toString();
    const likeIndex = post.likes.findIndex(like => like.toString() === userIdStr);
    
    if (likeIndex > -1) {
      post.likes.splice(likeIndex, 1);
    } else {
      post.likes.push(req.user._id);
    }

    await post.save();

    res.json({
      success: true,
      message: likeIndex > -1 ? 'تم إلغاء الإعجاب' : 'تم الإعجاب بالمنشور',
      likesCount: post.likes.length,
      isLiked: likeIndex === -1
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في الإعجاب بالمنشور', error: error.message });
  }
});

// DELETE post
router2.delete('/:id', auth2, async (req, res) => {
  try {
    const Post = mongoose2.model('Post');
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ success: false, message: 'المنشور غير موجود' });
    }

    // Check if user owns the post or is admin
    if (post.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية لحذف هذا المنشور' });
    }

    await Post.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'تم حذف المنشور بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في حذف المنشور', error: error.message });
  }
});

module.exports = router2;
