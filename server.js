require('dotenv').config(); // Load environment variables

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Create uploads directories if they don't exist
const uploadsDir = './uploads';
const dirs = ['./uploads/articles', './uploads/products', './uploads/posts', './uploads/avatars'];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// CORS Configuration - More permissive for development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow your frontend URL and localhost for development
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'https://maman-algerienne.onrender.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5500', // Live Server default port
      'http://127.0.0.1:5500',
      'https://maman-algerienne.onrender.com',
      'https://anes255.github.io', // GitHub Pages
      // Add common development ports
      'http://localhost:8080',
      'http://localhost:3001',
      'http://localhost:4000'
    ];
    
    // In development, be more permissive
    if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

// Middleware
app.use(express.json({ limit: process.env.MAX_FILE_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_FILE_SIZE || '10mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_PATH || './uploads')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check - Enhanced
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working', 
    routes: 'loaded',
    environment: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'not set',
    timestamp: new Date().toISOString()
  });
});

// Global flag to track if routes are loaded
let routesLoaded = false;
let dbConnected = false;

// Setup full API routes
function setupFullRoutes() {
  if (routesLoaded) return;
  
  try {
    console.log('Setting up full API routes...');
    
    // Import and use routes
    const authRoutes = require('./routes/auth');
    const articleRoutes = require('./routes/articles');
    const productRoutes = require('./routes/products');
    const postRoutes = require('./routes/posts');
    const commentRoutes = require('./routes/comments');
    const adminRoutes = require('./routes/admin');
    const orderRoutes = require('./routes/Orders');

    // Register routes
    app.use('/api/auth', authRoutes);
    app.use('/api/articles', articleRoutes);
    app.use('/api/products', productRoutes);
    app.use('/api/posts', postRoutes);
    app.use('/api/comments', commentRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/orders', orderRoutes);
    
    routesLoaded = true;
    console.log('✅ All API routes loaded successfully');
    
  } catch (error) {
    console.error('Error loading routes:', error.message);
    console.log('📋 Setting up fallback routes instead...');
    setupFallbackRoutes();
  }
}

// Setup fallback routes when database is not available
function setupFallbackRoutes() {
  console.log('Setting up fallback routes...');
  
  // Basic auth for admin panel
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    if (email === 'mamanalgeriennepartenariat@gmail.com' && password === 'anesaya75') {
      res.json({
        token: 'test-admin-token',
        user: {
          id: '1',
          name: 'مدير الموقع',
          email: 'mamanalgeriennepartenariat@gmail.com',
          isAdmin: true
        }
      });
    } else {
      res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }
  });
  
  app.get('/api/auth/me', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token === 'test-admin-token') {
      res.json({
        user: {
          id: '1',
          name: 'مدير الموقع',
          email: 'mamanalgeriennepartenariat@gmail.com',
          isAdmin: true
        }
      });
    } else {
      res.status(401).json({ message: 'غير مصرح' });
    }
  });
  
  // Sample articles for demonstration
  const sampleArticles = [
    {
      _id: '1',
      title: 'نصائح للأمهات الجدد',
      content: 'مجموعة من النصائح المفيدة للأمهات اللاتي رزقن بمولود جديد...',
      excerpt: 'نصائح مفيدة للتعامل مع المولود الجديد وتنظيم الوقت',
      category: 'حملي',
      author: { name: 'د. فاطمة أحمد', avatar: null },
      images: [],
      views: 245,
      likes: [],
      featured: true,
      createdAt: new Date().toISOString()
    },
    {
      _id: '2',
      title: 'وصفات صحية للأطفال',
      content: 'وصفات متنوعة ومفيدة لتحضير وجبات صحية ولذيذة للأطفال...',
      excerpt: 'أفكار متجددة لوجبات صحية يحبها الأطفال',
      category: 'كوزينتي',
      author: { name: 'الشيف سارة', avatar: null },
      images: [],
      views: 189,
      likes: [],
      featured: true,
      createdAt: new Date().toISOString()
    },
    {
      _id: '3',
      title: 'تنظيم المنزل مع الأطفال',
      content: 'كيفية الحفاظ على نظافة وتنظيم المنزل مع وجود الأطفال...',
      excerpt: 'استراتيجيات عملية لإدارة المنزل مع الأطفال',
      category: 'بيتي',
      author: { name: 'نور الهدى', avatar: null },
      images: [],
      views: 167,
      likes: [],
      featured: false,
      createdAt: new Date().toISOString()
    }
  ];

  const samplePosts = [
    {
      _id: 'ad1',
      title: 'عرض خاص على منتجات الأطفال',
      content: 'تخفيضات كبيرة على جميع منتجات الأطفال لفترة محدودة...',
      type: 'ad',
      adDetails: {
        link: 'https://example.com',
        buttonText: 'تسوقي الآن',
        featured: true
      },
      images: [],
      createdAt: new Date().toISOString()
    }
  ];
  
  // Empty data routes with sample data
  app.get('/api/articles', (req, res) => {
    const { featured, page = 1, limit = 10, search, category } = req.query;
    let filteredArticles = [...sampleArticles];
    
    if (featured === 'true') {
      filteredArticles = filteredArticles.filter(article => article.featured);
    }
    
    if (search) {
      filteredArticles = filteredArticles.filter(article => 
        article.title.includes(search) || article.content.includes(search)
      );
    }
    
    if (category) {
      filteredArticles = filteredArticles.filter(article => article.category === category);
    }
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedArticles = filteredArticles.slice(startIndex, endIndex);
    
    res.json({
      articles: paginatedArticles,
      pagination: { 
        current: parseInt(page), 
        pages: Math.ceil(filteredArticles.length / limit), 
        total: filteredArticles.length 
      }
    });
  });

  app.get('/api/articles/category/:category', (req, res) => {
    const { category } = req.params;
    const filteredArticles = sampleArticles.filter(article => article.category === category);
    
    res.json({
      articles: filteredArticles,
      pagination: { current: 1, pages: 1, total: filteredArticles.length }
    });
  });

  app.get('/api/posts', (req, res) => {
    const { type, limit = 10 } = req.query;
    let filteredPosts = [...samplePosts];
    
    if (type === 'ad') {
      filteredPosts = filteredPosts.filter(post => post.type === 'ad');
    }
    
    const limitedPosts = filteredPosts.slice(0, parseInt(limit));
    
    res.json({
      posts: limitedPosts,
      pagination: { current: 1, pages: 1, total: filteredPosts.length }
    });
  });

  app.get('/api/products', (req, res) => {
    res.json({
      products: [],
      pagination: { current: 1, pages: 0, total: 0 }
    });
  });

  app.get('/api/comments', (req, res) => {
    res.json({
      comments: [],
      pagination: { current: 1, pages: 0, total: 0 }
    });
  });
  
  // Individual item routes
  const itemRoutes = ['/api/articles', '/api/products', '/api/posts'];
  itemRoutes.forEach(route => {
    app.get(`${route}/:id`, (req, res) => {
      if (route === '/api/articles') {
        const article = sampleArticles.find(a => a._id === req.params.id);
        if (article) {
          res.json(article);
        } else {
          res.status(404).json({ message: 'Article not found' });
        }
      } else {
        res.status(404).json({ message: 'Item not found' });
      }
    });
    
    app.post(route, (req, res) => {
      res.status(503).json({ 
        message: 'Database not available. Please check MongoDB Atlas connection.' 
      });
    });
  });

  // Admin dashboard route
  app.get('/api/admin/dashboard', (req, res) => {
    res.json({
      counts: { 
        articles: sampleArticles.length, 
        products: 0, 
        posts: samplePosts.length, 
        users: 1, 
        comments: 0 
      },
      stats: { 
        todayViews: 50, 
        pendingComments: 0, 
        newUsersThisWeek: 5, 
        popularCategory: 'حملي' 
      }
    });
  });
  
  console.log('✅ Fallback routes set up with sample data');
}

// MongoDB Atlas connection
async function connectToAtlas() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority&appName=Cluster0';
    
    console.log('Connecting to MongoDB Atlas...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      connectTimeoutMS: 10000, // Give up initial connection after 10s
    });
    
    console.log('✅ Connected to MongoDB Atlas successfully');
    dbConnected = true;
    
    // Create admin user after connection
    await createAdminUser();
    
    // Load full routes
    setupFullRoutes();
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB Atlas connection failed:', error.message);
    dbConnected = false;
    
    if (error.message.includes('authentication failed')) {
      console.log('🔐 Please check your database password in the connection string');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('🌐 Please check your internet connection');
    }
    
    return false;
  }
}

// Create admin user
async function createAdminUser() {
  try {
    const User = require('./models/User');
    
    const existingAdmin = await User.findOne({ 
      email: 'mamanalgeriennepartenariat@gmail.com' 
    });
    
    if (!existingAdmin) {
      const admin = new User({
        name: 'مدير الموقع',
        email: 'mamanalgeriennepartenariat@gmail.com',
        phone: '0555123456',
        password: 'anesaya75',
        isAdmin: true
      });
      
      await admin.save();
      console.log('✅ Admin user created successfully');
    } else {
      if (!existingAdmin.isAdmin) {
        existingAdmin.isAdmin = true;
        await existingAdmin.save();
        console.log('✅ Existing user promoted to admin');
      } else {
        console.log('✅ Admin user already exists');
      }
    }
  } catch (error) {
    console.error('Error creating admin user:', error.message);
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ 
    message: 'Server error', 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Initialize server
async function startServer() {
  console.log('🚀 Starting Maman Algerienne server...');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Frontend URL:', process.env.FRONTEND_URL || 'not set');
  
  // Try to connect to MongoDB Atlas
  const dbConnected = await connectToAtlas();
  
  if (!dbConnected) {
    console.log('⚠️ Database connection failed, using fallback mode');
    setupFallbackRoutes();
  }

  // 404 handler - MUST be LAST
  app.use('*', (req, res) => {
    console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      message: 'Route not found', 
      path: req.originalUrl,
      method: req.method,
      availableRoutes: [
        '/health',
        '/api/test', 
        '/api/articles',
        '/api/posts',
        '/api/auth/login'
      ]
    });
  });

  // Start server
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`\n🌟 Maman Algerienne Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🧪 API Test: http://localhost:${PORT}/api/test`);
    console.log(`📰 Articles: http://localhost:${PORT}/api/articles`);
    console.log(`🛍️ Products: http://localhost:${PORT}/api/products`);
    console.log(`📢 Posts: http://localhost:${PORT}/api/posts`);
    console.log(`\n🔧 Admin login credentials:`);
    console.log(`   Email: mamanalgeriennepartenariat@gmail.com`);
    console.log(`   Password: anesaya75\n`);
    
    if (dbConnected) {
      console.log('✅ Server ready with MongoDB Atlas');
    } else {
      console.log('⚠️ Server running in fallback mode with sample data');
      console.log('🔍 To fix: Check MongoDB Atlas connection and credentials');
    }
    
    console.log('═'.repeat(60));
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Process terminated');
      mongoose.connection.close();
    });
  });
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = app;
