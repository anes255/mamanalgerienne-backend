const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:8080', 
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8080',
      'http://127.0.0.1:5173',
      'https://maman-algerienne.onrender.com',
      'https://anes255.github.io',
      'https://mamanalgerienne.netlify.app',
      'https://mamanalgerienne.vercel.app'
    ];
    
    // Check if origin is in allowed list or is a localhost/development domain
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    const isGitHubPages = origin.includes('github.io');
    const isNetlify = origin.includes('netlify.app');
    const isVercel = origin.includes('vercel.app');
    const isRender = origin.includes('onrender.com');
    
    if (allowedOrigins.includes(origin) || isLocalhost || isGitHubPages || isNetlify || isVercel || isRender) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(null, true); // Allow all origins for now during debugging
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200
};

// Apply CORS before other middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Security middleware (relaxed for development)
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting (more permissive)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased limit for development
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.originalUrl} - Origin: ${req.get('Origin') || 'No Origin'}`);
  next();
});

// Health check route (must be early)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    status: 'online',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test route for API connectivity
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working correctly',
    timestamp: new Date().toISOString(),
    origin: req.get('Origin'),
    userAgent: req.get('User-Agent'),
    method: req.method
  });
});

// MongoDB Atlas connection
async function connectToAtlas() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority&appName=Cluster0';
    
    console.log('🔗 Connecting to MongoDB Atlas...');
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ Connected to MongoDB Atlas successfully');
    return true;
  } catch (error) {
    console.error('❌ MongoDB Atlas connection failed:', error.message);
    return false;
  }
}

// Create admin user
async function createAdminUser() {
  try {
    const User = require('./models/User');
    
    const adminExists = await User.findOne({ 
      $or: [
        { email: 'mamanalgeriennepartenariat@gmail.com' },
        { role: 'admin' }
      ]
    });

    if (!adminExists) {
      const admin = new User({
        username: 'admin',
        email: 'mamanalgeriennepartenariat@gmail.com',
        password: 'anesaya75',
        fullName: 'Administrateur Maman Algerienne',
        role: 'admin',
        emailVerified: true,
        isActive: true
      });

      await admin.save();
      console.log('✅ Admin user created successfully');
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  }
}

// Fallback data
const sampleData = {
  articles: [
    {
      _id: 'sample-article-1',
      title: 'نصائح مهمة للأمهات الجدد',
      content: 'مجموعة من النصائح القيمة التي تساعد الأمهات الجديدات في رحلة الأمومة الجميلة...',
      author: 'فريق الموقع',
      category: 'الأمومة والطفولة',
      image: '/assets/article1.jpg',
      createdAt: new Date().toISOString(),
      published: true
    },
    {
      _id: 'sample-article-2', 
      title: 'وصفات صحية ولذيذة للأطفال',
      content: 'تشكيلة من الوصفات الصحية واللذيذة التي يحبها الأطفال وتفيد نموهم...',
      author: 'أخصائية التغذية سارة',
      category: 'التغذية',
      image: '/assets/article2.jpg',
      createdAt: new Date().toISOString(),
      published: true
    }
  ],
  posts: [
    {
      _id: 'sample-post-1',
      title: 'مرحباً بكم في مجتمع الأمهات الجزائريات',
      content: 'منصة رائعة للتواصل وتبادل الخبرات والنصائح بين الأمهات الجزائريات',
      author: 'إدارة الموقع',
      authorAvatar: '/assets/admin-avatar.jpg',
      likes: 45,
      comments: [],
      createdAt: new Date().toISOString()
    }
  ],
  products: [
    {
      _id: 'sample-product-1',
      name: 'منتجات طبيعية للعناية بالطفل',
      description: 'مجموعة من المنتجات الطبيعية والآمنة للعناية بالأطفال الرضع',
      price: 2500,
      currency: 'DZD',
      image: '/assets/product1.jpg',
      category: 'العناية بالطفل',
      available: true
    }
  ]
};

// Setup fallback API routes
function setupFallbackRoutes() {
  console.log('📋 Setting up fallback routes...');

  // Articles endpoint
  app.get('/api/articles', (req, res) => {
    console.log('📰 Serving fallback articles');
    res.json({
      success: true,
      articles: sampleData.articles,
      count: sampleData.articles.length,
      message: 'Fallback data - database connection needed for live content'
    });
  });

  // Posts endpoint
  app.get('/api/posts', (req, res) => {
    console.log('📝 Serving fallback posts');
    res.json({
      success: true,
      posts: sampleData.posts,
      count: sampleData.posts.length,
      message: 'Fallback data - database connection needed for live content'
    });
  });

  // Products endpoint
  app.get('/api/products', (req, res) => {
    console.log('🛍️ Serving fallback products');
    res.json({
      success: true,
      products: sampleData.products,
      count: sampleData.products.length,
      message: 'Fallback data - database connection needed for live content'
    });
  });

  // Sponsor ads endpoint
  app.get('/api/sponsor-ads', (req, res) => {
    console.log('📢 Serving empty sponsor ads');
    res.json({
      success: true,
      ads: [],
      count: 0,
      message: 'No sponsor ads available'
    });
  });

  // Contact form endpoint
  app.post('/api/contact', (req, res) => {
    console.log('📧 Contact form submission received:', req.body);
    res.json({
      success: true,
      message: 'تم استلام رسالتك بنجاح. سنتواصل معك قريباً!'
    });
  });

  // Newsletter subscription
  app.post('/api/newsletter', (req, res) => {
    console.log('📬 Newsletter subscription:', req.body);
    res.json({
      success: true,
      message: 'تم الاشتراك في النشرة الإخبارية بنجاح!'
    });
  });

  console.log('✅ Fallback routes set up successfully');
}

// Setup full routes with database
async function setupFullRoutes() {
  try {
    console.log('🔗 Setting up full API routes...');
    
    // Import route modules
    const authRoutes = require('./routes/auth');
    // const postRoutes = require('./routes/posts');
    // const articleRoutes = require('./routes/articles');
    
    // Apply routes
    app.use('/api/auth', authRoutes);
    // app.use('/api/posts', postRoutes);
    // app.use('/api/articles', articleRoutes);
    
    // Setup fallback routes for missing route files
    setupFallbackRoutes();
    
    console.log('✅ Full API routes set up successfully');
  } catch (error) {
    console.error('❌ Error setting up full routes:', error.message);
    console.log('📋 Falling back to sample data routes...');
    setupFallbackRoutes();
  }
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'حدث خطأ في الخادم',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler - MUST be LAST
app.use('*', (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    success: false,
    message: 'Route not found', 
    path: req.originalUrl,
    method: req.method,
    availableRoutes: [
      'GET /health',
      'GET /api/test', 
      'GET /api/articles',
      'GET /api/posts',
      'GET /api/products',
      'GET /api/sponsor-ads',
      'POST /api/contact',
      'POST /api/newsletter',
      'POST /api/auth/login',
      'POST /api/auth/register'
    ]
  });
});

// Initialize server
async function startServer() {
  console.log('🚀 Starting Maman Algerienne server...');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Frontend URL:', process.env.FRONTEND_URL || 'not set');
  
  // Try to connect to MongoDB Atlas
  const dbConnected = await connectToAtlas();
  
  if (dbConnected) {
    await createAdminUser();
    await setupFullRoutes();
  } else {
    console.log('⚠️ Database connection failed, using fallback mode');
    setupFallbackRoutes();
  }

  // Start server
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌟 Maman Algerienne Server running on port ${PORT}`);
    console.log(`🌐 Server URL: http://0.0.0.0:${PORT}`);
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
