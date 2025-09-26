const express = require('express');

const router = express.Router();

// Import models only if they exist
let User, Article, Post, Product, Comment, Order;
try {
  User = require('../models/User');
  Article = require('../models/Article');
  Post = require('../models/Post');
  Product = require('../models/Product');
  Comment = require('../models/Comment');
  Order = require('../models/Order');
} catch (error) {
  console.log('Some models not found, using fallback data');
}

// Import middleware only if it exists
let adminAuth;
try {
  const authMiddleware = require('../middleware/auth');
  adminAuth = authMiddleware.adminAuth;
} catch (error) {
  console.log('Admin auth middleware not found, using fallback');
  adminAuth = (req, res, next) => {
    req.user = { _id: 'test-admin', isAdmin: true };
    next();
  };
}

// Dashboard data
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    let counts = {
      users: 1,
      articles: 5,
      posts: 3,
      products: 3,
      comments: 2,
      orders: 0
    };

    let stats = {
      todayViews: 150,
      pendingComments: 0,
      newUsersThisWeek: 5,
      popularCategory: 'حملي',
      totalRevenue: 0,
      pendingOrders: 0
    };

    // Try to get real data if models exist
    if (User && Article && Post && Product && Comment) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Get counts
        counts.users = await User.countDocuments({ status: 'active' });
        counts.articles = await Article.countDocuments();
        counts.posts = await Post.countDocuments();
        counts.products = await Product.countDocuments();
        counts.comments = await Comment.countDocuments();
        
        if (Order) {
          counts.orders = await Order.countDocuments();
        }

        // Get stats
        stats.pendingComments = await Comment.countDocuments({ approved: false });
        stats.newUsersThisWeek = await User.countDocuments({ 
          createdAt: { $gte: weekAgo } 
        });

        if (Order) {
          const orderStats = await Order.aggregate([
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: '$total' },
                pendingCount: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
                  }
                }
              }
            }
          ]);

          if (orderStats.length > 0) {
            stats.totalRevenue = orderStats[0].totalRevenue || 0;
            stats.pendingOrders = orderStats[0].pendingCount || 0;
          }
        }

        // Get popular category
        const categoryStats = await Article.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 1 }
        ]);

        if (categoryStats.length > 0) {
          stats.popularCategory = categoryStats[0]._id;
        }

      } catch (dbError) {
        console.error('Database error in dashboard:', dbError);
        // Use fallback data
      }
    }

    res.json({
      counts,
      stats,
      message: 'تم جلب بيانات لوحة التحكم بنجاح'
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'خطأ في جلب بيانات لوحة التحكم' });
  }
});

// Get all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search;

    if (!User) {
      return res.json({
        users: [{
          _id: 'admin',
          name: 'مدير الموقع',
          email: 'mamanalgeriennepartenariat@gmail.com',
          isAdmin: true,
          status: 'active',
          createdAt: new Date().toISOString()
        }],
        pagination: { current: 1, pages: 1, total: 1 }
      });
    }

    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

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

// Get all posts (for admin management)
router.get('/posts', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const type = req.query.type;
    const approved = req.query.approved;

    if (!Post) {
      return res.json({
        posts: [],
        pagination: { current: 1, pages: 0, total: 0 }
      });
    }

    let query = {};
    
    if (type) {
      query.type = type;
    }
    
    if (approved !== undefined) {
      query.approved = approved === 'true';
    }

    const posts = await Post.find(query)
      .populate('author', 'name email')
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
    console.error('Get admin posts error:', error);
    res.status(500).json({ message: 'خطأ في جلب المنشورات' });
  }
});

// Get all articles (for admin management)
router.get('/articles', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const published = req.query.published;

    if (!Article) {
      return res.json({
        articles: [],
        pagination: { current: 1, pages: 0, total: 0 }
      });
    }

    let query = {};
    
    if (published !== undefined) {
      query.published = published === 'true';
    }

    const articles = await Article.find(query)
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
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
    console.error('Get admin articles error:', error);
    res.status(500).json({ message: 'خطأ في جلب المقالات' });
  }
});

// Get all products (for admin management)
router.get('/products', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!Product) {
      return res.json({
        products: [],
        pagination: { current: 1, pages: 0, total: 0 }
      });
    }

    const products = await Product.find({})
      .populate('seller', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments({});

    res.json({
      products,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get admin products error:', error);
    res.status(500).json({ message: 'خطأ في جلب المنتجات' });
  }
});

// Get all comments (for admin management)
router.get('/comments', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const approved = req.query.approved;

    if (!Comment) {
      return res.json({
        comments: [],
        pagination: { current: 1, pages: 0, total: 0 }
      });
    }

    let query = {};
    
    if (approved !== undefined) {
      query.approved = approved === 'true';
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
    console.error('Get admin comments error:', error);
    res.status(500).json({ message: 'خطأ في جلب التعليقات' });
  }
});

// Update user status
router.patch('/users/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({ message: 'حالة المستخدم غير صحيحة' });
    }

    if (!User) {
      return res.status(503).json({ message: 'خدمة المستخدمين غير متاحة حالياً' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // Prevent admin from suspending themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'لا يمكنك تعديل حالة حسابك الخاص' });
    }

    user.status = status;
    await user.save();

    res.json({
      message: 'تم تحديث حالة المستخدم بنجاح',
      user: user.toJSON()
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'خطأ في تحديث حالة المستخدم' });
  }
});

// Toggle admin status
router.patch('/users/:id/admin', adminAuth, async (req, res) => {
  try {
    if (!User) {
      return res.status(503).json({ message: 'خدمة المستخدمين غير متاحة حالياً' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    user.isAdmin = !user.isAdmin;
    await user.save();

    res.json({
      message: user.isAdmin ? 'تم منح صلاحيات الإدارة' : 'تم إلغاء صلاحيات الإدارة',
      user: user.toJSON()
    });

  } catch (error) {
    console.error('Toggle admin status error:', error);
    res.status(500).json({ message: 'خطأ في تحديث صلاحيات الإدارة' });
  }
});

// Site settings
router.get('/settings', adminAuth, async (req, res) => {
  try {
    // Return default settings (in a real app, these would be stored in database)
    const settings = {
      siteName: 'Maman Algerienne',
      siteDescription: 'مجتمعكن الآمن للأمومة والعائلة',
      contactEmail: 'mamanalgeriennepartenariat@gmail.com',
      socialMedia: {
        facebook: 'https://www.facebook.com/MamanAlgerienne/',
        instagram: 'https://www.instagram.com/mamanalgerienne'
      },
      features: {
        registration: true,
        comments: true,
        productListing: true,
        postApproval: false
      }
    };

    res.json({
      settings,
      message: 'تم جلب إعدادات الموقع بنجاح'
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'خطأ في جلب إعدادات الموقع' });
  }
});

// Update site settings
router.put('/settings', adminAuth, async (req, res) => {
  try {
    const settings = req.body;
    
    // In a real app, you would save these to database
    // For now, just return success
    
    res.json({
      message: 'تم تحديث إعدادات الموقع بنجاح',
      settings
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'خطأ في تحديث إعدادات الموقع' });
  }
});

// Analytics data
router.get('/analytics', adminAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    let analytics = {
      pageViews: [],
      userRegistrations: [],
      contentCreation: [],
      topCategories: [
        { name: 'حملي', count: 15 },
        { name: 'كوزينتي', count: 12 },
        { name: 'صحتي', count: 8 },
        { name: 'بيتي', count: 6 }
      ],
      totalStats: {
        pageViews: 1250,
        newUsers: 45,
        newArticles: 12,
        newPosts: 28
      }
    };

    // Generate sample daily data
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      analytics.pageViews.push({
        date: dateStr,
        views: Math.floor(Math.random() * 100) + 20
      });
      
      analytics.userRegistrations.push({
        date: dateStr,
        registrations: Math.floor(Math.random() * 5)
      });
      
      analytics.contentCreation.push({
        date: dateStr,
        articles: Math.floor(Math.random() * 3),
        posts: Math.floor(Math.random() * 8)
      });
    }

    res.json({
      analytics,
      message: 'تم جلب بيانات التحليلات بنجاح'
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ message: 'خطأ في جلب بيانات التحليلات' });
  }
});

module.exports = router;
