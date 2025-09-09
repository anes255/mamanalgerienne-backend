const express = require('express');
const { adminAuth } = require('../middleware/auth');
const Article = require('../models/Article');
const Product = require('../models/Product');
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');

const router = express.Router();

// Dashboard statistics
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const [articlesCount, productsCount, postsCount, usersCount, commentsCount] = await Promise.all([
      Article.countDocuments(),
      Product.countDocuments(),
      Post.countDocuments(),
      User.countDocuments(),
      Comment.countDocuments()
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayViews, pendingComments, newUsersThisWeek] = await Promise.all([
      Article.aggregate([
        { $group: { _id: null, totalViews: { $sum: '$views' } } }
      ]),
      Comment.countDocuments({ approved: false }),
      User.countDocuments({ 
        createdAt: { 
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
        } 
      })
    ]);

    // Get most popular category
    const popularCategory = await Article.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    res.json({
      counts: {
        articles: articlesCount,
        products: productsCount,
        posts: postsCount,
        users: usersCount,
        comments: commentsCount
      },
      stats: {
        todayViews: todayViews[0]?.totalViews || 0,
        pendingComments,
        newUsersThisWeek,
        popularCategory: popularCategory[0]?._id || 'عام'
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'خطأ في جلب إحصائيات لوحة التحكم' });
  }
});

// Get single article by ID for editing
router.get('/articles/:id', adminAuth, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id).populate('author', 'name avatar');
    
    if (!article) {
      return res.status(404).json({ message: 'المقال غير موجود' });
    }

    res.json(article);
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ message: 'خطأ في جلب المقال' });
  }
});

// Get single product by ID for editing
router.get('/products/:id', adminAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'خطأ في جلب المنتج' });
  }
});

// Get single post by ID for editing
router.get('/posts/:id', adminAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'name avatar');
    
    if (!post) {
      return res.status(404).json({ message: 'المنشور غير موجود' });
    }

    res.json(post);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'خطأ في جلب المنشور' });
  }
});

// Get all users (Admin only)
router.get('/users', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments();

    res.json({
      users,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'خطأ في جلب المستخدمين' });
  }
});

// Toggle user active status
router.patch('/users/:id/toggle', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // Prevent admin from deactivating themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'لا يمكنك إلغاء تفعيل حسابك الخاص' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      message: user.isActive ? 'تم تفعيل المستخدم' : 'تم إلغاء تفعيل المستخدم',
      isActive: user.isActive
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ message: 'خطأ في تغيير حالة المستخدم' });
  }
});

// Delete user (Admin only)
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'لا يمكنك حذف حسابك الخاص' });
    }

    // Prevent deleting other admins
    if (user.isAdmin) {
      return res.status(400).json({ message: 'لا يمكن حذف حساب مدير آخر' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'تم حذف المستخدم بنجاح' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'خطأ في حذف المستخدم' });
  }
});

// Get all comments for admin review
router.get('/comments', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status; // 'pending', 'approved', 'all'

    let query = {};
    if (status === 'pending') {
      query.approved = false;
    } else if (status === 'approved') {
      query.approved = true;
    }

    const comments = await Comment.find(query)
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments(query);

    res.json({
      comments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'خطأ في جلب التعليقات' });
  }
});

// Approve/Disapprove comment
router.patch('/comments/:id/approve', adminAuth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'التعليق غير موجود' });
    }

    comment.approved = !comment.approved;
    await comment.save();

    res.json({
      message: comment.approved ? 'تم الموافقة على التعليق' : 'تم رفض التعليق',
      approved: comment.approved
    });
  } catch (error) {
    console.error('Approve comment error:', error);
    res.status(500).json({ message: 'خطأ في الموافقة على التعليق' });
  }
});

// Delete comment (Admin only)
router.delete('/comments/:id', adminAuth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'التعليق غير موجود' });
    }

    // If this comment has replies, delete them too
    if (comment.replies && comment.replies.length > 0) {
      await Comment.deleteMany({ _id: { $in: comment.replies } });
    }

    // If this is a reply, remove it from parent's replies array
    if (comment.parentComment) {
      await Comment.findByIdAndUpdate(
        comment.parentComment,
        { $pull: { replies: comment._id } }
      );
    }

    await Comment.findByIdAndDelete(req.params.id);

    res.json({ message: 'تم حذف التعليق بنجاح' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'خطأ في حذف التعليق' });
  }
});

module.exports = router;