const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Try to load optional dependencies
let compression, helmet;
try {
  compression = require('compression');
  console.log('✅ Compression middleware loaded');
} catch (e) {
  console.log('⚠️ Compression not available, skipping...');
}

try {
  helmet = require('helmet');
  console.log('✅ Helmet security middleware loaded');
} catch (e) {
  console.log('⚠️ Helmet not available, skipping...');
}

// Create uploads directories if they don't exist
const uploadsDir = './uploads';
const dirs = ['./uploads/articles', './uploads/products', './uploads/posts', './uploads/avatars'];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Mobile-optimized middleware configuration
// 1. Security headers with mobile support (if helmet is available)
if (helmet) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        connectSrc: ["'self'", "http://localhost:5000", "https:"],
        mediaSrc: ["'self'", "data:", "https:", "http:"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
} else {
  // Basic security headers without helmet
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
}

// 2. Compression for better mobile performance (if available)
if (compression) {
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6,
    threshold: 1024,
  }));
}

// 3. Mobile-friendly CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8080',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Allow mobile development and file:// protocol
      if (origin.startsWith('file://') || 
          origin.includes('localhost') || 
          origin.includes('127.0.0.1') ||
          origin.includes('192.168.') ||
          origin.includes('10.0.')) {
        callback(null, true);
      } else {
        callback(null, true); // For now, allow all origins for mobile compatibility
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar']
}));

// 4. Enhanced body parsing for mobile uploads
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb',
  parameterLimit: 50000
}));

// 5. Mobile-optimized static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Set proper MIME types for mobile compatibility
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
    
    // Mobile-friendly cache headers
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Vary', 'Accept-Encoding');
  }
}));

// 6. Mobile device detection middleware
app.use((req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  
  // Detect mobile devices
  const mobileKeywords = [
    'Mobile', 'Android', 'iPhone', 'iPad', 'iPod', 'BlackBerry', 
    'Windows Phone', 'Opera Mini', 'IEMobile', 'Mobile Safari'
  ];
  
  req.isMobile = mobileKeywords.some(keyword => 
    userAgent.includes(keyword)
  );
  
  // Add mobile-specific headers
  if (req.isMobile) {
    res.setHeader('X-UA-Compatible', 'IE=edge');
    res.setHeader('X-Mobile-Detected', 'true');
  }
  
  next();
});

// 7. Serve static files in production with mobile optimization
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (path.endsWith('.js') || path.endsWith('.css')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000');
      }
    }
  }));
  
  // Handle React routing for mobile browsers
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).send('Server Error');
      }
    });
  });
}

// Health check with mobile info
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    mobileOptimized: true,
    userAgent: req.headers['user-agent'],
    isMobile: req.isMobile,
    compression: !!compression,
    helmet: !!helmet
  });
});

// Test route with mobile detection
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working', 
    routes: 'loaded',
    mobileDetected: req.isMobile,
    compressionEnabled: !!compression,
    timestamp: new Date().toISOString()
  });
});

// Global flag to track if routes are loaded
let routesLoaded = false;

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

    app.use('/api/orders', orderRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/articles', articleRoutes);
    app.use('/api/products', productRoutes);
    app.use('/api/posts', postRoutes);
    app.use('/api/comments', commentRoutes);
    app.use('/api/admin', adminRoutes);
    
    routesLoaded = true;
    console.log('✅ All API routes loaded successfully');
    
  } catch (error) {
    console.error('Error loading routes:', error.message);
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
  
  // Empty data routes with mobile-friendly responses
  const emptyRoutes = [
    '/api/articles',
    '/api/products', 
    '/api/posts',
    '/api/comments'
  ];
  
  emptyRoutes.forEach(route => {
    app.get(route, (req, res) => {
      res.json({
        articles: [],
        products: [],
        posts: [],
        comments: [],
        pagination: { current: 1, pages: 0, total: 0 },
        mobile: req.isMobile
      });
    });
    
    app.get(`${route}/:id`, (req, res) => {
      res.status(404).json({ message: 'Item not found' });
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
      counts: { articles: 0, products: 0, posts: 0, users: 1, comments: 0 },
      stats: { todayViews: 0, pendingComments: 0, newUsersThisWeek: 0, popularCategory: 'عام' },
      mobile: req.isMobile
    });
  });
  
  console.log('✅ Fallback routes set up');
}

// MongoDB Atlas connection
async function connectToAtlas() {
  try {
    const MONGODB_URI = 'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority&appName=Cluster0';
    
    console.log('Connecting to MongoDB Atlas...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB Atlas successfully');
    
    // Create admin user after connection
    await createAdminUser();
    
    // Load full routes
    setupFullRoutes();
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB Atlas connection failed:', error.message);
    
    if (error.message.includes('authentication failed')) {
      console.log('🔑 Please check your database password in the connection string');
      console.log('🔑 Make sure to replace YOUR_PASSWORD with your actual password');
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

// Enhanced error handling for mobile
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  
  // Mobile-friendly error response
  const errorResponse = {
    message: 'Server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    mobile: req.isMobile,
    timestamp: new Date().toISOString()
  };
  
  res.status(500).json(errorResponse);
});

// Initialize server
async function startServer() {
  console.log('🚀 Starting mobile-optimized server...');
  
  // Try to connect to MongoDB Atlas
  const dbConnected = await connectToAtlas();
  
  if (!dbConnected) {
    // Use fallback routes if database connection fails
    setupFallbackRoutes();
  }

  // 404 handler - MUST be LAST
  app.use('*', (req, res) => {
    console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      message: 'Route not found', 
      path: req.originalUrl,
      method: req.method,
      mobile: req.isMobile
    });
  });

  // Start server
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Mobile-optimized server running on port ${PORT}`);
    console.log(`📱 Accessible from mobile devices on your network`);
    console.log(`🔗 Local: http://localhost:${PORT}`);
    console.log(`🔗 Network: http://0.0.0.0:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🧪 API Test: http://localhost:${PORT}/api/test`);
    console.log(`📰 Articles: http://localhost:${PORT}/api/articles`);
    console.log(`🛍️ Products: http://localhost:${PORT}/api/products`);
    console.log(`📢 Posts: http://localhost:${PORT}/api/posts`);
    console.log(`\n📧 Admin login credentials:`);
    console.log(`   Email: mamanalgeriennepartenariat@gmail.com`);
    console.log(`   Password: anesaya75`);
    console.log(`\n📱 Mobile Optimizations:`);
    console.log(`   ${compression ? '✓' : '⚠️'} Compression ${compression ? 'enabled' : 'not available'}`);
    console.log(`   ${helmet ? '✓' : '⚠️'} Security headers ${helmet ? 'enabled' : 'basic only'}`);
    console.log(`   ✓ Mobile device detection`);
    console.log(`   ✓ Optimized cache headers`);
    console.log(`   ✓ CORS for mobile browsers`);
    console.log(`   ✓ Large file upload support`);
    
    if (dbConnected) {
      console.log('\n✅ Server ready with MongoDB Atlas');
    } else {
      console.log('\n⚠️ Server running in fallback mode');
      console.log('🔍 To fix: Replace YOUR_PASSWORD in the MongoDB URI with your actual password');
      console.log('🔍 The connection string should look like:');
      console.log('   mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/...');
    }
  });
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = app;
