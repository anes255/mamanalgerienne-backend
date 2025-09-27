// Enhanced Maman Algerienne Backend Server - Comprehensive Fix
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
console.log('Port:', PORT);

// Enhanced CORS Configuration - CRITICAL FIX
const corsOptions = {
    origin: function (origin, callback) {
        console.log('🔍 CORS checking origin:', origin);
        
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
            console.log('✅ No origin - allowing request');
            return callback(null, true);
        }
        
        // Comprehensive list of allowed origins
        const allowedOrigins = [
            // Development
            'http://localhost:3000',
            'http://localhost:8080',
            'http://localhost:8000',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:8080',
            'http://127.0.0.1:8000',
            
            // Production
            'https://anes255.github.io',
            'https://maman-algerienne.onrender.com',
            'https://mamanalgerienne.netlify.app',
            'https://mamanalgerienne.vercel.app',
            'https://maman-algerienne.netlify.app',
            'https://maman-algerienne.vercel.app',
            
            // Environment variable
            process.env.FRONTEND_URL,
            process.env.ALLOWED_ORIGIN
        ].filter(Boolean);
        
        // Check if origin is allowed
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            return origin === allowedOrigin || origin.startsWith(allowedOrigin);
        });
        
        if (isAllowed) {
            console.log('✅ CORS origin allowed:', origin);
            callback(null, true);
        } else {
            console.log('❌ CORS origin blocked:', origin);
            console.log('📋 Allowed origins:', allowedOrigins);
            callback(new Error('Not allowed by CORS'), false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'Accept', 
        'X-Requested-With',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
    ],
    exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
    maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Additional CORS headers middleware
app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept,X-Requested-With,Origin');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

// Enhanced middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy (important for Render.com)
app.set('trust proxy', 1);

// Create upload directories
const uploadDirs = ['./uploads', './uploads/avatars', './uploads/images'];
uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
});

// Static files middleware
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Enhanced request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const origin = req.headers.origin || 'no-origin';
    console.log(`📡 ${timestamp} - ${req.method} ${req.path} - Origin: ${origin}`);
    next();
});

// MongoDB Connection with enhanced error handling
console.log('Connecting to MongoDB Atlas...');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/maman-algerienne';
console.log('MongoDB URI:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials in logs

mongoose.connect(mongoUri, {
    // Remove deprecated options
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ Connected to MongoDB successfully');
})
.catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    console.error('💡 Check your MONGODB_URI environment variable');
    // Don't exit in production, allow app to continue
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
});

// Handle MongoDB connection events
mongoose.connection.on('error', err => {
    console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
});

// Enhanced Schemas
const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    avatar: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Remove deprecated index option warnings
userSchema.index({ email: 1 });

const User = mongoose.model('User', userSchema);

const articleSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    excerpt: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    image: { type: String, default: '' },
    featured: { type: Boolean, default: false },
    published: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    tags: [{ type: String, trim: true }],
    readTime: { type: Number, default: 5, min: 1 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

articleSchema.index({ title: 'text', content: 'text', excerpt: 'text' });
articleSchema.index({ category: 1, featured: 1, published: 1 });

const Article = mongoose.model('Article', articleSchema);

const postSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    description: { type: String, trim: true },
    excerpt: { type: String, trim: true },
    type: { type: String, enum: ['post', 'ad', 'announcement'], default: 'post' },
    category: { type: String, default: 'general', trim: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    image: { type: String, default: '' },
    featured: { type: Boolean, default: false },
    published: { type: Boolean, default: true },
    link: { type: String, trim: true }, // For ads/sponsored content
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    tags: [{ type: String, trim: true }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

postSchema.index({ type: 1, featured: 1, published: 1 });
postSchema.index({ title: 'text', content: 'text', description: 'text' });

const Post = mongoose.model('Post', postSchema);

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'maman-algerienne-secret-key-change-this';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Enhanced Auth Middleware
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ 
                message: 'Access token required',
                code: 'NO_TOKEN'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Verify user still exists
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            return res.status(401).json({ 
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        req.user = decoded;
        req.userDoc = user;
        next();
    } catch (err) {
        console.error('❌ Auth error:', err.message);
        return res.status(403).json({ 
            message: 'Invalid or expired token',
            code: 'INVALID_TOKEN'
        });
    }
};

// Admin middleware
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ 
            message: 'Admin access required',
            code: 'ADMIN_REQUIRED'
        });
    }
    next();
};

// Enhanced multer configuration
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
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed!'), false);
        }
    }
});

// Create admin user function
async function createAdminUser() {
    try {
        const adminEmail = 'mamanalgeriennepartenariat@gmail.com';
        const adminExists = await User.findOne({ email: adminEmail });
        
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('anesaya75', 12);
            const admin = new User({
                firstName: 'Admin',
                lastName: 'Maman Algérienne',
                email: adminEmail,
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

// CORE ROUTES - Enhanced with better error handling

// Health check endpoint - CRITICAL for debugging
app.get('/health', (req, res) => {
    const health = {
        status: 'ok',
        message: 'Maman Algerienne API is running',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        port: PORT
    };
    
    console.log('🏥 Health check requested:', health);
    res.json(health);
});

// API test endpoint
app.get('/api/test', (req, res) => {
    const testData = {
        message: 'API test successful',
        server: 'Maman Algerienne Backend',
        timestamp: new Date().toISOString(),
        cors_origin: req.headers.origin || 'no-origin',
        user_agent: req.headers['user-agent'] || 'no-user-agent'
    };
    
    console.log('🧪 API test requested:', testData);
    res.json(testData);
});

// Root endpoint for debugging
app.get('/', (req, res) => {
    res.json({
        message: 'Maman Algerienne Backend API',
        version: '2.0.0',
        endpoints: {
            health: '/health',
            test: '/api/test',
            articles: '/api/articles',
            posts: '/api/posts',
            sponsorAds: '/api/sponsor-ads',
            auth: {
                login: '/api/auth/login',
                register: '/api/auth/register',
                me: '/api/auth/me'
            }
        },
        documentation: 'https://github.com/anes255/mamanalgerienne-backend'
    });
});

// Enhanced Authentication Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        // Enhanced validation
        if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password) {
            return res.status(400).json({ 
                message: 'All fields are required',
                code: 'MISSING_FIELDS'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                message: 'Password must be at least 6 characters long',
                code: 'PASSWORD_TOO_SHORT'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                message: 'Invalid email format',
                code: 'INVALID_EMAIL'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ 
                message: 'User already exists with this email',
                code: 'USER_EXISTS'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = new User({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user._id, 
                email: user.email, 
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
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
        res.status(500).json({ 
            message: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email?.trim() || !password) {
            return res.status(400).json({ 
                message: 'Email and password are required',
                code: 'MISSING_CREDENTIALS'
            });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(401).json({ 
                message: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({ 
                message: 'Account is deactivated',
                code: 'ACCOUNT_DEACTIVATED'
            });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ 
                message: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user._id, 
                email: user.email, 
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
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
        res.status(500).json({ 
            message: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        res.json({
            id: req.userDoc._id,
            firstName: req.userDoc.firstName,
            lastName: req.userDoc.lastName,
            email: req.userDoc.email,
            role: req.userDoc.role,
            avatar: req.userDoc.avatar,
            createdAt: req.userDoc.createdAt,
            lastLogin: req.userDoc.lastLogin
        });
    } catch (error) {
        console.error('❌ Get user error:', error);
        res.status(500).json({ 
            message: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// Enhanced Articles Routes
app.get('/api/articles', async (req, res) => {
    try {
        const { 
            category, 
            limit = 10, 
            featured, 
            search, 
            page = 1,
            sort = 'newest'
        } = req.query;
        
        let query = { published: true };
        
        // Category filter
        if (category && category !== 'all') {
            query.category = { $regex: new RegExp(category, 'i') };
        }
        
        // Featured filter
        if (featured === 'true') {
            query.featured = true;
        }
        
        // Search filter
        if (search?.trim()) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { excerpt: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }
        
        // Sorting
        let sortOption = { createdAt: -1 }; // Default: newest first
        if (sort === 'oldest') sortOption = { createdAt: 1 };
        if (sort === 'popular') sortOption = { views: -1, likes: -1 };
        if (sort === 'title') sortOption = { title: 1 };
        
        console.log('🔍 Articles query:', { query, sort: sortOption, limit, page });
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(parseInt(limit), 50); // Max 50 articles per request
        
        const articles = await Article.find(query)
            .populate('author', 'firstName lastName avatar')
            .limit(limitNum)
            .skip(skip)
            .sort(sortOption)
            .lean(); // Use lean() for better performance
        
        const total = await Article.countDocuments(query);
        
        res.json({
            articles,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / limitNum),
                hasMore: skip + articles.length < total,
                totalArticles: total
            },
            query: { category, featured, search, sort }
        });
        
        console.log(`✅ Returned ${articles.length} articles (total: ${total})`);
    } catch (error) {
        console.error('❌ Error fetching articles:', error);
        res.status(500).json({ 
            message: 'Error fetching articles', 
            code: 'FETCH_ERROR',
            error: error.message 
        });
    }
});

// Enhanced Posts Routes
app.get('/api/posts', async (req, res) => {
    try {
        const { 
            type, 
            limit = 10, 
            featured, 
            search, 
            page = 1,
            category 
        } = req.query;
        
        let query = { published: true };
        
        // Type filter (important for ads)
        if (type) {
            query.type = type;
        }
        
        // Category filter
        if (category && category !== 'all') {
            query.category = { $regex: new RegExp(category, 'i') };
        }
        
        // Featured filter
        if (featured === 'true') {
            query.featured = true;
        }
        
        // Search filter
        if (search?.trim()) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { excerpt: { $regex: search, $options: 'i' } }
            ];
        }
        
        console.log('🔍 Posts query:', query);
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(parseInt(limit), 50);
        
        const posts = await Post.find(query)
            .populate('author', 'firstName lastName avatar')
            .limit(limitNum)
            .skip(skip)
            .sort({ createdAt: -1 })
            .lean();
        
        const total = await Post.countDocuments(query);
        
        res.json({
            posts,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / limitNum),
                hasMore: skip + posts.length < total,
                totalPosts: total
            },
            query: { type, category, featured, search }
        });
        
        console.log(`✅ Returned ${posts.length} posts (total: ${total})`);
    } catch (error) {
        console.error('❌ Error fetching posts:', error);
        res.status(500).json({ 
            message: 'Error fetching posts', 
            code: 'FETCH_ERROR',
            error: error.message 
        });
    }
});

// CRITICAL: Sponsor Ads Endpoint (was missing and causing 404s)
app.get('/api/sponsor-ads', async (req, res) => {
    try {
        console.log('🎯 Handling sponsor ads request');
        
        const { limit = 6 } = req.query;
        
        // Try multiple strategies to get sponsor content
        let sponsorAds = [];
        
        // Strategy 1: Get ads marked as type 'ad'
        sponsorAds = await Post.find({ 
            type: 'ad',
            published: true
        })
        .populate('author', 'firstName lastName')
        .limit(parseInt(limit))
        .sort({ createdAt: -1 })
        .lean();
        
        // Strategy 2: If no ads, get featured posts
        if (sponsorAds.length === 0) {
            sponsorAds = await Post.find({ 
                featured: true,
                published: true
            })
            .populate('author', 'firstName lastName')
            .limit(parseInt(limit))
            .sort({ createdAt: -1 })
            .lean();
        }
        
        // Strategy 3: If still no content, get featured articles
        if (sponsorAds.length === 0) {
            sponsorAds = await Article.find({ 
                featured: true,
                published: true
            })
            .populate('author', 'firstName lastName')
            .limit(parseInt(limit))
            .sort({ createdAt: -1 })
            .lean();
        }
        
        res.json(sponsorAds);
        console.log(`✅ Returned ${sponsorAds.length} sponsor ads`);
    } catch (error) {
        console.error('❌ Error fetching sponsor ads:', error);
        res.status(500).json({ 
            message: 'Error fetching sponsor ads', 
            code: 'FETCH_ERROR',
            error: error.message 
        });
    }
});

// Upload Routes
app.post('/api/upload/image', authenticateToken, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                message: 'No image file provided',
                code: 'NO_FILE'
            });
        }
        
        const imageUrl = `/uploads/images/${req.file.filename}`;
        res.json({ 
            imageUrl,
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
        
        console.log('✅ Image uploaded:', imageUrl);
    } catch (error) {
        console.error('❌ Error uploading image:', error);
        res.status(500).json({ 
            message: 'Error uploading image', 
            code: 'UPLOAD_ERROR',
            error: error.message 
        });
    }
});

// Create sample data if none exists
async function createSampleData() {
    try {
        const articlesCount = await Article.countDocuments();
        const postsCount = await Post.countDocuments();
        
        if (articlesCount === 0 || postsCount === 0) {
            console.log('📝 Creating sample data...');
            
            const admin = await User.findOne({ role: 'admin' });
            if (!admin) {
                console.log('⚠️ No admin user found for sample data');
                return;
            }
            
            // Sample articles
            if (articlesCount === 0) {
                const sampleArticles = [
                    {
                        title: "دليل شامل للرضاعة الطبيعية",
                        content: "الرضاعة الطبيعية هي لحظة مميزة بين الأم وطفلها...",
                        excerpt: "اكتشفي جميع نصائحنا للرضاعة الطبيعية الناجحة والمريحة.",
                        category: "الأمومة",
                        author: admin._id,
                        featured: true,
                        image: "/assets/breastfeeding.jpg",
                        tags: ["رضاعة طبيعية", "أطفال", "نصائح"]
                    },
                    {
                        title: "وصفات صحية للأطفال الصعبين في الأكل",
                        content: "إليك وصفات لذيذة ومغذية سيحبها أطفالك...",
                        excerpt: "أفكار وجبات متوازنة للأطفال الذين يصعب إرضاؤهم في الطعام.",
                        category: "الطبخ",
                        author: admin._id,
                        featured: false,
                        image: "/assets/kids-recipes.jpg",
                        tags: ["وصفات", "أطفال", "تغذية"]
                    },
                    {
                        title: "التعامل مع نوبات غضب طفلك الصغير",
                        content: "نوبات الغضب جزء طبيعي من نمو الطفل...",
                        excerpt: "استراتيجيات فعالة لمرافقة مشاعر طفلك.",
                        category: "التربية",
                        author: admin._id,
                        featured: false,
                        image: "/assets/child-tantrums.jpg",
                        tags: ["تربية", "مشاعر", "نمو"]
                    }
                ];
                
                await Article.insertMany(sampleArticles);
                console.log('✅ Sample articles created');
            }
            
            // Sample posts including ads
            if (postsCount === 0) {
                const samplePosts = [
                    {
                        title: "عرض خاص على منتجات الأطفال العضوية",
                        content: "اكتشفي مجموعتنا من المنتجات العضوية المعتمدة لطفلك...",
                        description: "استفيدي من خصم 20% على جميع منتجاتنا العضوية هذا الأسبوع!",
                        excerpt: "عرض مميز على المنتجات العضوية",
                        type: "ad",
                        category: "sponsored",
                        author: admin._id,
                        featured: true,
                        image: "/assets/organic-products.jpg",
                        link: "https://example.com/organic-products",
                        tags: ["عرض", "عضوي", "أطفال"]
                    },
                    {
                        title: "شهادة: سنتي الأولى في الأمومة",
                        content: "مشاركة تجربة أم جزائرية شابة...",
                        excerpt: "شهادة مؤثرة عن متع وتحديات الأمومة.",
                        type: "post",
                        category: "شهادات",
                        author: admin._id,
                        featured: false,
                        image: "/assets/testimony.jpg",
                        tags: ["شهادة", "أمومة", "تجربة"]
                    }
                ];
                
                await Post.insertMany(samplePosts);
                console.log('✅ Sample posts created');
            }
        }
    } catch (error) {
        console.error('❌ Error creating sample data:', error);
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('💥 Global error handler:', error);
    
    if (error.name === 'MulterError') {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                message: 'File too large. Maximum size is 5MB.',
                code: 'FILE_TOO_LARGE'
            });
        }
    }
    
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
            message: 'Validation error',
            code: 'VALIDATION_ERROR',
            errors: messages
        });
    }
    
    res.status(error.status || 500).json({
        message: error.message || 'Internal server error',
        code: error.code || 'SERVER_ERROR',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// Catch-all for API routes
app.use('/api/*', (req, res) => {
    console.log(`❌ API endpoint not found: ${req.method} ${req.path}`);
    res.status(404).json({
        message: 'API endpoint not found',
        path: req.path,
        method: req.method,
        availableEndpoints: [
            'GET /health',
            'GET /api/test',
            'GET /api/articles',
            'GET /api/posts',
            'GET /api/sponsor-ads',
            'POST /api/auth/login',
            'POST /api/auth/register',
            'GET /api/auth/me'
        ]
    });
});

// Catch-all for other routes
app.use('*', (req, res) => {
    console.log(`404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({
        message: 'Route not found',
        path: req.path,
        method: req.method,
        suggestion: 'This is an API server. Try /health or /api/test'
    });
});

// Initialize database and start server
async function startServer() {
    try {
        // Wait for MongoDB connection
        if (mongoose.connection.readyState !== 1) {
            await new Promise((resolve) => {
                mongoose.connection.once('connected', resolve);
            });
        }
        
        // Create admin user
        await createAdminUser();
        
        // Create sample data
        setTimeout(createSampleData, 3000);
        
        // Start server
        app.listen(PORT, () => {
            console.log(`🌟 Maman Algerienne Server running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`🧪 API Test: http://localhost:${PORT}/api/test`);
            console.log(`📰 Articles: http://localhost:${PORT}/api/articles`);
            console.log(`📢 Posts: http://localhost:${PORT}/api/posts`);
            console.log(`🎯 Sponsor Ads: http://localhost:${PORT}/api/sponsor-ads`);
            console.log('');
            console.log('🔧 Admin Credentials:');
            console.log('📧 Email: mamanalgeriennepartenariat@gmail.com');
            console.log('🔑 Password: anesaya75');
            console.log('');
            console.log('✅ Server ready and operational!');
            console.log('════════════════════════════════════════════════════════════');
        });
        
    } catch (error) {
        console.error('💥 Failed to start server:', error);
        process.exit(1);
    }
}

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

// Start the server
startServer();

module.exports = app;
