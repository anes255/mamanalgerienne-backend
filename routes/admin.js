const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

console.log('✅ Loading Admin routes...');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = './uploads/';
        
        // Determine upload directory based on field name
        if (file.fieldname === 'articleImages') {
            uploadPath += 'articles/';
        } else if (file.fieldname === 'productImages' || file.fieldname === 'images') {
            uploadPath += 'products/';
        } else if (file.fieldname === 'postImages') {
            uploadPath += 'posts/';
        }
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Only allow image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Authentication middleware (simple version)
const adminAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        // For development - simple token check
        if (token === 'test-admin-token') {
            req.user = {
                id: '1',
                email: 'mamanalgeriennepartenariat@gmail.com',
                isAdmin: true
            };
            return next();
        }

        // Try JWT verification
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
            req.user = decoded;
            
            // Check if user is admin
            if (!req.user.isAdmin) {
                return res.status(403).json({ message: 'Admin access required' });
            }
            
            next();
        } catch (jwtError) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        
    } catch (error) {
        console.error('Admin auth middleware error:', error);
        res.status(500).json({ message: 'Auth error' });
    }
};

// =================
// DASHBOARD ROUTES
// =================

// GET /api/admin/dashboard - Get dashboard statistics
router.get('/dashboard', adminAuth, async (req, res) => {
    try {
        console.log('📊 Loading admin dashboard...');

        let counts = {
            articles: 0,
            products: 0,
            posts: 0,
            users: 1,
            comments: 0,
            orders: 0
        };

        let stats = {
            todayViews: 0,
            pendingComments: 0,
            newUsersThisWeek: 0,
            popularCategory: 'عام'
        };

        // Try to get real data from models
        try {
            const Article = require('../models/Article');
            const Product = require('../models/Product');
            const Post = require('../models/Post');
            const Comment = require('../models/Comment');
            const Order = require('../models/Order');
            const User = require('../models/User');

            // Get counts
            const [articlesCount, productsCount, postsCount, usersCount, commentsCount, ordersCount] = await Promise.all([
                Article.countDocuments({}),
                Product.countDocuments({}),
                Post.countDocuments({}),
                User.countDocuments({}),
                Comment.countDocuments({}),
                Order.countDocuments({})
            ]);

            counts = {
                articles: articlesCount,
                products: productsCount,
                posts: postsCount,
                users: usersCount,
                comments: commentsCount,
                orders: ordersCount
            };

            // Get additional stats
            const today = new Date();
            const startOfWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

            const [pendingComments, newUsers] = await Promise.all([
                Comment.countDocuments({ approved: false }),
                User.countDocuments({ createdAt: { $gte: startOfWeek } })
            ]);

            stats = {
                todayViews: Math.floor(Math.random() * 1000) + 500, // Placeholder
                pendingComments: pendingComments,
                newUsersThisWeek: newUsers,
                popularCategory: 'حملي' // Placeholder
            };

        } catch (modelError) {
            console.log('⚠️ Some models not available, using fallback data');
        }

        res.json({
            counts,
            stats
        });

    } catch (error) {
        console.error('❌ Dashboard error:', error);
        res.status(500).json({ 
            message: 'خطأ في تحميل لوحة التحكم',
            error: error.message 
        });
    }
});

// =================
// ARTICLES ROUTES
// =================

// GET /api/admin/articles - Get all articles
router.get('/articles', adminAuth, async (req, res) => {
    try {
        const Article = require('../models/Article');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const articles = await Article.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('author', 'name email');

        const total = await Article.countDocuments({});

        res.json({
            articles,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error('❌ Get articles error:', error);
        res.json({
            articles: [],
            pagination: { current: 1, pages: 0, total: 0 }
        });
    }
});

// POST /api/admin/articles - Create article
router.post('/articles', adminAuth, upload.array('images', 5), async (req, res) => {
    try {
        const Article = require('../models/Article');
        
        const { title, category, excerpt, content, featured } = req.body;

        const images = req.files ? req.files.map(file => file.filename) : [];

        const article = new Article({
            title,
            category,
            excerpt,
            content,
            images,
            featured: featured === 'true',
            author: req.user.id,
            published: true
        });

        await article.save();

        console.log('✅ Article created:', title);

        res.status(201).json({
            message: 'تم إنشاء المقال بنجاح',
            article
        });

    } catch (error) {
        console.error('❌ Create article error:', error);
        res.status(500).json({ 
            message: 'خطأ في إنشاء المقال',
            error: error.message 
        });
    }
});

// PUT /api/admin/articles/:id - Update article
router.put('/articles/:id', adminAuth, upload.array('images', 5), async (req, res) => {
    try {
        const Article = require('../models/Article');
        
        const { title, category, excerpt, content, featured } = req.body;
        const images = req.files ? req.files.map(file => file.filename) : [];

        const updateData = {
            title,
            category,
            excerpt,
            content,
            featured: featured === 'true'
        };

        if (images.length > 0) {
            updateData.images = images;
        }

        const article = await Article.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!article) {
            return res.status(404).json({ message: 'المقال غير موجود' });
        }

        res.json({
            message: 'تم تحديث المقال بنجاح',
            article
        });

    } catch (error) {
        console.error('❌ Update article error:', error);
        res.status(500).json({ 
            message: 'خطأ في تحديث المقال',
            error: error.message 
        });
    }
});

// DELETE /api/admin/articles/:id - Delete article
router.delete('/articles/:id', adminAuth, async (req, res) => {
    try {
        const Article = require('../models/Article');
        
        const article = await Article.findById(req.params.id);
        
        if (!article) {
            return res.status(404).json({ message: 'المقال غير موجود' });
        }

        // Delete associated images
        if (article.images && article.images.length > 0) {
            article.images.forEach(image => {
                const imagePath = path.join('./uploads/articles/', image);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            });
        }

        await Article.findByIdAndDelete(req.params.id);

        res.json({
            message: 'تم حذف المقال بنجاح'
        });

    } catch (error) {
        console.error('❌ Delete article error:', error);
        res.status(500).json({ 
            message: 'خطأ في حذف المقال',
            error: error.message 
        });
    }
});

// =================
// PRODUCTS ROUTES
// =================

// GET /api/admin/products - Get all products
router.get('/products', adminAuth, async (req, res) => {
    try {
        const Product = require('../models/Product');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const products = await Product.find({})
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
        console.error('❌ Get products error:', error);
        res.json({
            products: [],
            pagination: { current: 1, pages: 0, total: 0 }
        });
    }
});

// POST /api/admin/products - Create product
router.post('/products', adminAuth, upload.array('images', 5), async (req, res) => {
    try {
        const Product = require('../models/Product');
        
        const { 
            name, 
            category, 
            description, 
            price, 
            stockQuantity, 
            featured, 
            onSale, 
            salePrice 
        } = req.body;

        const images = req.files ? req.files.map(file => file.filename) : [];

        const product = new Product({
            name,
            category,
            description,
            price: parseFloat(price),
            stockQuantity: parseInt(stockQuantity),
            images,
            featured: featured === 'true',
            onSale: onSale === 'true',
            salePrice: onSale === 'true' && salePrice ? parseFloat(salePrice) : undefined,
            inStock: parseInt(stockQuantity) > 0
        });

        await product.save();

        console.log('✅ Product created:', name);

        res.status(201).json({
            message: 'تم إنشاء المنتج بنجاح',
            product
        });

    } catch (error) {
        console.error('❌ Create product error:', error);
        res.status(500).json({ 
            message: 'خطأ في إنشاء المنتج',
            error: error.message 
        });
    }
});

// PUT /api/admin/products/:id - Update product
router.put('/products/:id', adminAuth, upload.array('images', 5), async (req, res) => {
    try {
        const Product = require('../models/Product');
        
        const { 
            name, 
            category, 
            description, 
            price, 
            stockQuantity, 
            featured, 
            onSale, 
            salePrice 
        } = req.body;

        const images = req.files ? req.files.map(file => file.filename) : [];

        const updateData = {
            name,
            category,
            description,
            price: parseFloat(price),
            stockQuantity: parseInt(stockQuantity),
            featured: featured === 'true',
            onSale: onSale === 'true',
            salePrice: onSale === 'true' && salePrice ? parseFloat(salePrice) : undefined,
            inStock: parseInt(stockQuantity) > 0
        };

        if (images.length > 0) {
            updateData.images = images;
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ message: 'المنتج غير موجود' });
        }

        res.json({
            message: 'تم تحديث المنتج بنجاح',
            product
        });

    } catch (error) {
        console.error('❌ Update product error:', error);
        res.status(500).json({ 
            message: 'خطأ في تحديث المنتج',
            error: error.message 
        });
    }
});

// DELETE /api/admin/products/:id - Delete product
router.delete('/products/:id', adminAuth, async (req, res) => {
    try {
        const Product = require('../models/Product');
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({ message: 'المنتج غير موجود' });
        }

        // Delete associated images
        if (product.images && product.images.length > 0) {
            product.images.forEach(image => {
                const imagePath = path.join('./uploads/products/', image);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            });
        }

        await Product.findByIdAndDelete(req.params.id);

        res.json({
            message: 'تم حذف المنتج بنجاح'
        });

    } catch (error) {
        console.error('❌ Delete product error:', error);
        res.status(500).json({ 
            message: 'خطأ في حذف المنتج',
            error: error.message 
        });
    }
});

// =================
// POSTS ROUTES
// =================

// GET /api/admin/posts - Get all posts
router.get('/posts', adminAuth, async (req, res) => {
    try {
        const Post = require('../models/Post');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const posts = await Post.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('author', 'name email');

        const total = await Post.countDocuments({});

        res.json({
            posts,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error('❌ Get posts error:', error);
        res.json({
            posts: [],
            pagination: { current: 1, pages: 0, total: 0 }
        });
    }
});

// POST /api/admin/posts - Create post/ad
router.post('/posts', adminAuth, upload.array('images', 5), async (req, res) => {
    try {
        const Post = require('../models/Post');
        
        const { title, content, link, buttonText, featured } = req.body;

        const images = req.files ? req.files.map(file => file.filename) : [];

        const post = new Post({
            title,
            content,
            type: 'ad',
            adDetails: {
                link: link || '',
                buttonText: buttonText || 'اقرأ المزيد',
                featured: featured === 'true'
            },
            images,
            author: req.user.id,
            approved: true
        });

        await post.save();

        console.log('✅ Post created:', title);

        res.status(201).json({
            message: 'تم إنشاء الإعلان بنجاح',
            post
        });

    } catch (error) {
        console.error('❌ Create post error:', error);
        res.status(500).json({ 
            message: 'خطأ في إنشاء الإعلان',
            error: error.message 
        });
    }
});

// DELETE /api/admin/posts/:id - Delete post
router.delete('/posts/:id', adminAuth, async (req, res) => {
    try {
        const Post = require('../models/Post');
        
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ message: 'الإعلان غير موجود' });
        }

        // Delete associated images
        if (post.images && post.images.length > 0) {
            post.images.forEach(image => {
                const imagePath = path.join('./uploads/posts/', image);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            });
        }

        await Post.findByIdAndDelete(req.params.id);

        res.json({
            message: 'تم حذف الإعلان بنجاح'
        });

    } catch (error) {
        console.error('❌ Delete post error:', error);
        res.status(500).json({ 
            message: 'خطأ في حذف الإعلان',
            error: error.message 
        });
    }
});

// =================
// COMMENTS ROUTES
// =================

// GET /api/admin/comments - Get all comments
router.get('/comments', adminAuth, async (req, res) => {
    try {
        const Comment = require('../models/Comment');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const comments = await Comment.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('author', 'name email')
            .populate('targetId', 'title name');

        const total = await Comment.countDocuments({});

        res.json({
            comments,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error('❌ Get comments error:', error);
        res.json({
            comments: [],
            pagination: { current: 1, pages: 0, total: 0 }
        });
    }
});

// PATCH /api/admin/comments/:id/approve - Toggle comment approval
router.patch('/comments/:id/approve', adminAuth, async (req, res) => {
    try {
        const Comment = require('../models/Comment');
        
        const comment = await Comment.findById(req.params.id);
        
        if (!comment) {
            return res.status(404).json({ message: 'التعليق غير موجود' });
        }

        comment.approved = !comment.approved;
        await comment.save();

        res.json({
            message: comment.approved ? 'تم قبول التعليق' : 'تم إلغاء قبول التعليق',
            comment
        });

    } catch (error) {
        console.error('❌ Toggle comment approval error:', error);
        res.status(500).json({ 
            message: 'خطأ في تغيير حالة التعليق',
            error: error.message 
        });
    }
});

// DELETE /api/admin/comments/:id - Delete comment
router.delete('/comments/:id', adminAuth, async (req, res) => {
    try {
        const Comment = require('../models/Comment');
        
        const comment = await Comment.findByIdAndDelete(req.params.id);
        
        if (!comment) {
            return res.status(404).json({ message: 'التعليق غير موجود' });
        }

        res.json({
            message: 'تم حذف التعليق بنجاح'
        });

    } catch (error) {
        console.error('❌ Delete comment error:', error);
        res.status(500).json({ 
            message: 'خطأ في حذف التعليق',
            error: error.message 
        });
    }
});

// =================
// ORDERS ROUTES
// =================

// GET /api/admin/orders - Get all orders
router.get('/orders', adminAuth, async (req, res) => {
    try {
        const Order = require('../models/Order');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const status = req.query.status;
        const search = req.query.search;

        let query = {};
        
        if (status) {
            query.status = status;
        }
        
        if (search) {
            query.$or = [
                { 'customerInfo.name': { $regex: search, $options: 'i' } },
                { 'customerInfo.phone': { $regex: search, $options: 'i' } },
                { orderNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('items.product');

        const total = await Order.countDocuments(query);

        res.json({
            orders,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error('❌ Get orders error:', error);
        res.json({
            orders: [],
            pagination: { current: 1, pages: 0, total: 0 }
        });
    }
});

// =================
// USERS ROUTES
// =================

// GET /api/admin/users - Get all users
router.get('/users', adminAuth, async (req, res) => {
    try {
        const User = require('../models/User');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const users = await User.find({})
            .select('-password') // Exclude password field
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments({});

        res.json({
            users,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error('❌ Get users error:', error);
        res.json({
            users: [],
            pagination: { current: 1, pages: 0, total: 0 }
        });
    }
});

// =================
// THEME ROUTES
// =================

// GET /api/admin/theme - Get current theme
router.get('/theme', async (req, res) => {
    try {
        const Theme = require('../models/Theme');
        
        let theme = await Theme.findOne({ isActive: true });
        
        if (!theme) {
            // Create default theme if none exists
            theme = new Theme({
                name: 'default',
                primaryColor: '#d4a574',
                secondaryColor: '#f8e8d4',
                textColor: '#2c2c2c',
                isActive: true
            });
            await theme.save();
        }

        res.json({
            theme: {
                primaryColor: theme.primaryColor,
                secondaryColor: theme.secondaryColor,
                textColor: theme.textColor,
                lightText: theme.lightText,
                bgColor: theme.bgColor,
                borderColor: theme.borderColor,
                accentColor: theme.accentColor
            }
        });

    } catch (error) {
        console.error('❌ Get theme error:', error);
        // Return default theme on error
        res.json({
            theme: {
                primaryColor: '#d4a574',
                secondaryColor: '#f8e8d4',
                textColor: '#2c2c2c',
                lightText: '#666666',
                bgColor: '#fdfbf7',
                borderColor: '#e5d5c8',
                accentColor: '#b8860b'
            }
        });
    }
});

// POST /api/admin/theme - Save theme
router.post('/theme', adminAuth, async (req, res) => {
    try {
        const Theme = require('../models/Theme');
        
        const {
            primaryColor,
            secondaryColor, 
            textColor,
            lightText,
            bgColor,
            borderColor,
            accentColor
        } = req.body;

        // Deactivate current theme
        await Theme.updateMany({}, { $set: { isActive: false } });

        // Create new theme
        const theme = new Theme({
            name: 'custom',
            primaryColor: primaryColor || '#d4a574',
            secondaryColor: secondaryColor || '#f8e8d4',
            textColor: textColor || '#2c2c2c',
            lightText: lightText || '#666666',
            bgColor: bgColor || '#fdfbf7',
            borderColor: borderColor || '#e5d5c8',
            accentColor: accentColor || '#b8860b',
            isActive: true,
            createdBy: req.user.email || 'admin'
        });

        await theme.save();

        console.log('✅ Theme saved successfully');

        res.json({
            message: 'تم حفظ الألوان بنجاح',
            theme: {
                primaryColor: theme.primaryColor,
                secondaryColor: theme.secondaryColor,
                textColor: theme.textColor,
                lightText: theme.lightText,
                bgColor: theme.bgColor,
                borderColor: theme.borderColor,
                accentColor: theme.accentColor
            }
        });

    } catch (error) {
        console.error('❌ Save theme error:', error);
        res.status(500).json({ 
            message: 'خطأ في حفظ الألوان',
            error: error.message 
        });
    }
});

// =================
// UTILITY ROUTES
// =================

// GET /api/admin/stats - Get detailed statistics
router.get('/stats', adminAuth, async (req, res) => {
    try {
        let stats = {
            totalRevenue: 0,
            monthlyRevenue: 0,
            topProducts: [],
            recentOrders: [],
            userGrowth: []
        };

        try {
            const Order = require('../models/Order');
            const Product = require('../models/Product');

            // Calculate revenue
            const allOrders = await Order.find({ status: { $ne: 'cancelled' } });
            stats.totalRevenue = allOrders.reduce((sum, order) => sum + order.totalPrice, 0);

            // Monthly revenue
            const thisMonth = new Date();
            thisMonth.setDate(1);
            const monthlyOrders = await Order.find({ 
                createdAt: { $gte: thisMonth },
                status: { $ne: 'cancelled' }
            });
            stats.monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + order.totalPrice, 0);

            // Top products (by order frequency)
            const productStats = await Order.aggregate([
                { $unwind: '$items' },
                { $group: { 
                    _id: '$items.productName', 
                    count: { $sum: '$items.quantity' },
                    revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }},
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]);
            stats.topProducts = productStats;

            // Recent orders
            stats.recentOrders = await Order.find({})
                .sort({ createdAt: -1 })
                .limit(5)
                .select('orderNumber customerInfo.name totalPrice status createdAt');

        } catch (error) {
            console.log('⚠️ Some statistics unavailable:', error.message);
        }

        res.json(stats);

    } catch (error) {
        console.error('❌ Get stats error:', error);
        res.status(500).json({ 
            message: 'خطأ في تحميل الإحصائيات',
            error: error.message 
        });
    }
});

module.exports = router;
