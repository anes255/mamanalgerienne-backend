// Complete Maman Algerienne Backend Server - Fixed Version
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

console.log('🚀 Starting Maman Algerienne server...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Frontend URL:', process.env.FRONTEND_URL || 'http://localhost:3000');

// Ensure upload directories exist
const uploadDirs = ['./uploads', './uploads/avatars', './uploads/images'];
uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
});

// CORS Configuration - FIXED for production
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:8080',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:8080',
            'https://anes255.github.io',
            'https://maman-algerienne.onrender.com',
            'https://mamanalgerienne.netlify.app',
            'https://mamanalgerienne.vercel.app',
            // Add your actual frontend domain here
            process.env.FRONTEND_URL
        ].filter(Boolean);
        
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            console.log('❌ CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
};

app.use(cors(corsOptions));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static('uploads'));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// MongoDB Connection
console.log('Connecting to MongoDB Atlas...');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/maman-algerienne', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ Connected to MongoDB Atlas successfully');
})
.catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
});

// User Schema
const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    avatar: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Article Schema
const articleSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    excerpt: { type: String, required: true },
    category: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    image: { type: String, default: '' },
    featured: { type: Boolean, default: false },
    published: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    tags: [{ type: String }],
    readTime: { type: Number, default: 5 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Article = mongoose.model('Article', articleSchema);

// Post Schema
const postSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    description: { type: String },
    excerpt: { type: String },
    type: { type: String, enum: ['post', 'ad', 'announcement'], default: 'post' },
    category: { type: String, default: 'general' },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    image: { type: String, default: '' },
    featured: { type: Boolean, default: false },
    published: { type: Boolean, default: true },
    link: { type: String }, // For ads/sponsored content
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    tags: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', postSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = 'uploads/';
        if (file.fieldname === 'avatar') {
            uploadPath = 'uploads/avatars/';
        } else {
            uploadPath = 'uploads/images/';
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
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Create admin user if doesn't exist
async function createAdminUser() {
    try {
        const adminExists = await User.findOne({ email: 'mamanalgeriennepartenariat@gmail.com' });
        
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('anesaya75', 10);
            const admin = new User({
                firstName: 'Admin',
                lastName: 'Maman Algérienne',
                email: 'mamanalgeriennepartenariat@gmail.com',
                password: hashedPassword,
                role: 'admin'
            });
            
            await admin.save();
            console.log('✅ Admin user created successfully');
        } else {
            console.log('✅ Admin user already exists');
        }
    } catch (error) {
        console.error('❌ Error creating admin user:', error);
    }
}

// Initialize admin user
createAdminUser();

// Basic Routes
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Maman Algerienne API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API test successful',
        server: 'Maman Algerienne Backend',
        timestamp: new Date().toISOString()
    });
});

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        // Validate input
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new User({
            firstName,
            lastName,
            email,
            password: hashedPassword
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
            }
        });

        console.log('✅ User registered:', email);
    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                avatar: user.avatar
            }
        });

        console.log('✅ User logged in:', email);
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            createdAt: user.createdAt
        });
    } catch (error) {
        console.error('❌ Get user error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Articles Routes
app.get('/api/articles', async (req, res) => {
    try {
        const { category, limit = 10, featured, search, page = 1 } = req.query;
        
        let query = { published: true };
        
        // Handle category parameter
        if (category && category !== 'all') {
            query.category = category;
        }
        
        // Handle featured parameter
        if (featured === 'true') {
            query.featured = true;
        }
        
        // Handle search parameter
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { excerpt: { $regex: search, $options: 'i' } }
            ];
        }
        
        console.log('🔍 Articles query:', query);
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const articles = await Article.find(query)
            .populate('author', 'firstName lastName')
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ createdAt: -1 });
        
        const total = await Article.countDocuments(query);
        
        res.json({
            articles,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / parseInt(limit)),
                hasMore: skip + articles.length < total
            }
        });
        
        console.log(`✅ Returned ${articles.length} articles`);
    } catch (error) {
        console.error('❌ Error fetching articles:', error);
        res.status(500).json({ message: 'Error fetching articles', error: error.message });
    }
});

app.get('/api/articles/:id', async (req, res) => {
    try {
        const article = await Article.findById(req.params.id)
            .populate('author', 'firstName lastName avatar');
        
        if (!article) {
            return res.status(404).json({ message: 'Article not found' });
        }
        
        // Increment views
        article.views += 1;
        await article.save();
        
        res.json(article);
    } catch (error) {
        console.error('❌ Error fetching article:', error);
        res.status(500).json({ message: 'Error fetching article', error: error.message });
    }
});

app.post('/api/articles', authenticateToken, async (req, res) => {
    try {
        const { title, content, excerpt, category, image, featured, tags } = req.body;
        
        const article = new Article({
            title,
            content,
            excerpt,
            category,
            author: req.user.userId,
            image,
            featured: featured || false,
            tags: tags || []
        });
        
        await article.save();
        await article.populate('author', 'firstName lastName');
        
        res.status(201).json(article);
        console.log('✅ Article created:', title);
    } catch (error) {
        console.error('❌ Error creating article:', error);
        res.status(500).json({ message: 'Error creating article', error: error.message });
    }
});

// Posts Routes
app.get('/api/posts', async (req, res) => {
    try {
        const { type, limit = 10, featured, search, page = 1 } = req.query;
        
        let query = { published: true };
        
        // Handle type parameter (like type=ad)
        if (type) {
            query.type = type;
        }
        
        // Handle featured parameter
        if (featured === 'true') {
            query.featured = true;
        }
        
        // Handle search parameter
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { excerpt: { $regex: search, $options: 'i' } }
            ];
        }
        
        console.log('🔍 Posts query:', query);
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const posts = await Post.find(query)
            .populate('author', 'firstName lastName')
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ createdAt: -1 });
        
        const total = await Post.countDocuments(query);
        
        res.json({
            posts,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / parseInt(limit)),
                hasMore: skip + posts.length < total
            }
        });
        
        console.log(`✅ Returned ${posts.length} posts`);
    } catch (error) {
        console.error('❌ Error fetching posts:', error);
        res.status(500).json({ message: 'Error fetching posts', error: error.message });
    }
});

app.get('/api/posts/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('author', 'firstName lastName avatar');
        
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }
        
        // Increment views
        post.views += 1;
        await post.save();
        
        res.json(post);
    } catch (error) {
        console.error('❌ Error fetching post:', error);
        res.status(500).json({ message: 'Error fetching post', error: error.message });
    }
});

app.post('/api/posts', authenticateToken, async (req, res) => {
    try {
        const { title, content, description, excerpt, type, category, image, featured, link, tags } = req.body;
        
        const post = new Post({
            title,
            content,
            description,
            excerpt,
            type: type || 'post',
            category: category || 'general',
            author: req.user.userId,
            image,
            featured: featured || false,
            link,
            tags: tags || []
        });
        
        await post.save();
        await post.populate('author', 'firstName lastName');
        
        res.status(201).json(post);
        console.log('✅ Post created:', title);
    } catch (error) {
        console.error('❌ Error creating post:', error);
        res.status(500).json({ message: 'Error creating post', error: error.message });
    }
});

// Sponsor Ads Endpoint - NEW (was missing and causing 404)
app.get('/api/sponsor-ads', async (req, res) => {
    try {
        console.log('🎯 Handling sponsor ads request');
        
        // Try to get posts marked as ads or featured content
        const sponsorAds = await Post.find({ 
            $or: [
                { type: 'ad' },
                { featured: true },
                { category: 'sponsored' }
            ],
            published: true
        })
        .populate('author', 'firstName lastName')
        .limit(6)
        .sort({ createdAt: -1 });
        
        res.json(sponsorAds);
        console.log(`✅ Returned ${sponsorAds.length} sponsor ads`);
    } catch (error) {
        console.error('❌ Error fetching sponsor ads:', error);
        res.status(500).json({ message: 'Error fetching sponsor ads', error: error.message });
    }
});

// Upload Routes
app.post('/api/upload/image', authenticateToken, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image file provided' });
        }
        
        const imageUrl = `/uploads/images/${req.file.filename}`;
        res.json({ imageUrl });
        console.log('✅ Image uploaded:', imageUrl);
    } catch (error) {
        console.error('❌ Error uploading image:', error);
        res.status(500).json({ message: 'Error uploading image', error: error.message });
    }
});

app.post('/api/upload/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No avatar file provided' });
        }
        
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        
        // Update user's avatar
        await User.findByIdAndUpdate(req.user.userId, { avatar: avatarUrl });
        
        res.json({ avatarUrl });
        console.log('✅ Avatar uploaded:', avatarUrl);
    } catch (error) {
        console.error('❌ Error uploading avatar:', error);
        res.status(500).json({ message: 'Error uploading avatar', error: error.message });
    }
});

// Admin Routes
app.get('/api/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const stats = {
            users: await User.countDocuments(),
            articles: await Article.countDocuments(),
            posts: await Post.countDocuments(),
            recentUsers: await User.find().sort({ createdAt: -1 }).limit(5).select('-password'),
            recentArticles: await Article.find().sort({ createdAt: -1 }).limit(5).populate('author', 'firstName lastName'),
            recentPosts: await Post.find().sort({ createdAt: -1 }).limit(5).populate('author', 'firstName lastName')
        };
        
        res.json(stats);
    } catch (error) {
        console.error('❌ Error fetching dashboard data:', error);
        res.status(500).json({ message: 'Error fetching dashboard data', error: error.message });
    }
});

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
});

// Add sample data function
async function addSampleData() {
    try {
        const articlesCount = await Article.countDocuments();
        const postsCount = await Post.countDocuments();
        
        if (articlesCount === 0 || postsCount === 0) {
            console.log('📝 Adding sample data...');
            
            // Find admin user
            const admin = await User.findOne({ role: 'admin' });
            if (!admin) {
                console.log('⚠️ No admin user found, skipping sample data');
                return;
            }
            
            // Sample articles
            if (articlesCount === 0) {
                const sampleArticles = [
                    {
                        title: "Guide complet de l'allaitement maternel",
                        content: "L'allaitement maternel est un moment privilégié entre la mère et son enfant...",
                        excerpt: "Découvrez tous nos conseils pour un allaitement réussi et serein.",
                        category: "maternite",
                        author: admin._id,
                        featured: true,
                        image: "/assets/allaitement.jpg",
                        tags: ["allaitement", "bébé", "conseils"]
                    },
                    {
                        title: "Recettes healthy pour enfants difficiles",
                        content: "Voici des recettes savoureuses et nutritives que vos enfants vont adorer...",
                        excerpt: "Des idées de repas équilibrés pour les petits mangeurs capricieux.",
                        category: "cuisine",
                        author: admin._id,
                        featured: false,
                        image: "/assets/recettes-enfants.jpg",
                        tags: ["recettes", "enfants", "nutrition"]
                    },
                    {
                        title: "Gérer les colères de votre tout-petit",
                        content: "Les crises de colère font partie du développement normal de l'enfant...",
                        excerpt: "Stratégies efficaces pour accompagner les émotions de votre enfant.",
                        category: "education",
                        author: admin._id,
                        featured: false,
                        image: "/assets/coleres-enfant.jpg",
                        tags: ["éducation", "émotions", "développement"]
                    }
                ];
                
                await Article.insertMany(sampleArticles);
                console.log('✅ Sample articles added');
            }
            
            // Sample posts
            if (postsCount === 0) {
                const samplePosts = [
                    {
                        title: "Promotion sur les produits bio pour bébés",
                        content: "Découvrez notre sélection de produits bio certifiés pour votre bébé...",
                        description: "Profitez de -20% sur tous nos produits bio cette semaine!",
                        type: "ad",
                        category: "sponsored",
                        author: admin._id,
                        featured: true,
                        image: "/assets/produits-bio.jpg",
                        link: "https://example.com/produits-bio",
                        tags: ["promotion", "bio", "bébé"]
                    },
                    {
                        title: "Témoignage: Ma première année de maternité",
                        content: "Partage d'expérience d'une jeune maman algérienne...",
                        excerpt: "Un témoignage touchant sur les joies et défis de la maternité.",
                        type: "post",
                        category: "témoignage",
                        author: admin._id,
                        featured: false,
                        image: "/assets/temoignage.jpg",
                        tags: ["témoignage", "maternité", "expérience"]
                    }
                ];
                
                await Post.insertMany(samplePosts);
                console.log('✅ Sample posts added');
            }
        }
    } catch (error) {
        console.error('❌ Error adding sample data:', error);
    }
}

// Add sample data after admin creation
setTimeout(addSampleData, 2000);

// Catch-all for API routes (must be after all other API routes)
app.use('/api/*', (req, res) => {
    console.log(`❌ API endpoint not found: ${req.method} ${req.path}`);
    res.status(404).json({
        message: 'Route not found',
        path: req.path,
        method: req.method,
        availableRoutes: [
            '/health',
            '/api/test', 
            '/api/articles',
            '/api/posts',
            '/api/sponsor-ads',
            '/api/auth/login',
            '/api/auth/register',
            '/api/auth/me',
            '/api/upload/image',
            '/api/upload/avatar',
            '/api/admin/dashboard',
            '/api/admin/users'
        ]
    });
});

// Catch-all for non-API routes
app.use('*', (req, res) => {
    console.log(`404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({
        message: 'Route not found',
        path: req.path,
        method: req.method,
        availableRoutes: ['/health', '/api/test', '/api/articles', '/api/posts', '/api/auth/login']
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('💥 Global error handler:', error);
    
    if (error.name === 'MulterError') {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
        }
    }
    
    res.status(error.status || 500).json({
        message: error.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🌟 Maman Algerienne Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🧪 API Test: http://localhost:${PORT}/api/test`);
    console.log(`📰 Articles: http://localhost:${PORT}/api/articles`);
    console.log(`🛍️ Products: http://localhost:${PORT}/api/products`);
    console.log(`📢 Posts: http://localhost:${PORT}/api/posts`);
    console.log(`🎯 Sponsor Ads: http://localhost:${PORT}/api/sponsor-ads`);
    console.log('🔧 Admin login credentials:');
    console.log(' Email: mamanalgeriennepartenariat@gmail.com');
    console.log(' Password: anesaya75');
    console.log('✅ Server ready with MongoDB Atlas');
    console.log('════════════════════════════════════════════════════════════');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    mongoose.connection.close(() => {
        console.log('📦 MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    mongoose.connection.close(() => {
        console.log('📦 MongoDB connection closed');
        process.exit(0);
    });
});

module.exports = app;
