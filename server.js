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

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow your frontend URL and localhost for development
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'https://maman-algerienne.onrender.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://maman-algerienne.onrender.com'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Middleware
app.use(express.json({ limit: process.env.MAX_FILE_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_FILE_SIZE || '10mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_PATH || './uploads')));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    environment: process.env.NODE_ENV || 'development',
    mongoUri: process.env.MONGODB_URI ? 'Set' : 'Not Set'
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
    
    console.log('Fallback login attempt:', { email });
    
    if (email === 'mamanalgeriennepartenariat@gmail.com' && password === 'anesaya75') {
      res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        token: 'test-admin-token',
        user: {
          id: '1',
          name: 'مدير الموقع',
          email: 'mamanalgeriennepartenariat@gmail.com',
          phone: '0555123456',
          isAdmin: true
        }
      });
    } else {
      res.status(400).json({ 
        success: false,
        message: 'بيانات الدخول غير صحيحة' 
      });
    }
  });
  
  app.get('/api/auth/me', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token === 'test-admin-token') {
      res.json({
        success: true,
        user: {
          id: '1',
          name: 'مدير الموقع',
          email: 'mamanalgeriennepartenariat@gmail.com',
          phone: '0555123456',
          isAdmin: true
        }
      });
    } else {
      res.status(401).json({ 
        success: false,
        message: 'غير مصرح' 
      });
    }
  });
  
  // Empty data routes
  const emptyRoutes = [
    '/api/articles',
    '/api/products', 
    '/api/posts',
    '/api/comments'
  ];
  
  emptyRoutes.forEach(route => {
    app.get(route, (req, res) => {
      res.json({
        success: true,
        articles: [],
        products: [],
        posts: [],
        comments: [],
        pagination: { current: 1, pages: 0, total: 0 }
      });
    });
    
    app.get(`${route}/:id`, (req, res) => {
      res.status(404).json({ 
        success: false,
        message: 'Item not found' 
      });
    });
    
    app.post(route, (req, res) => {
      res.status(503).json({ 
        success: false,
        message: 'Database not available. Please check MongoDB Atlas connection.' 
      });
    });
  });

  // Admin dashboard route
  app.get('/api/admin/dashboard', (req, res) => {
    res.json({
      success: true,
      counts: { articles: 0, products: 0, posts: 0, users: 1, comments: 0 },
      stats: { todayViews: 0, pendingComments: 0, newUsersThisWeek: 0, popularCategory: 'عام' }
    });
  });
  
  console.log('✅ Fallback routes set up');
}

// MongoDB Atlas connection
async function connectToAtlas() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority&appName=Cluster0';
    
    console.log('Connecting to MongoDB Atlas...');
    console.log('MongoDB URI:', MONGODB_URI.replace(/:[^:@]*@/, ':***@')); // Hide password in logs
    
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
      console.log('🔐 Please check your database password in the connection string');
      console.log('🔐 Make sure to replace YOUR_PASSWORD with your actual password');
    }
    
    return false;
  }
}

// Create admin user - FIXED VERSION
async function createAdminUser() {
  try {
    // Import User model
    const User = require('./models/User');
    
    console.log('🔍 Checking for admin user...');
    
    const existingAdmin = await User.findOne({ 
      email: 'mamanalgeriennepartenariat@gmail.com' 
    });
    
    if (!existingAdmin) {
      console.log('👤 Creating admin user...');
      
      const admin = new User({
        name: 'مدير الموقع',
        email: 'mamanalgeriennepartenariat@gmail.com',
        phone: '0555123456',
        password: 'anesaya75', // Will be hashed by pre-save middleware
        isAdmin: true,
        isVerified: true
      });
      
      await admin.save();
      console.log('✅ Admin user created successfully');
      console.log('📧 Email:', admin.email);
      console.log('🔑 Password: anesaya75');
      console.log('👑 Admin: true');
    } else {
      console.log('✅ Admin user already exists');
      console.log('📧 Email:', existingAdmin.email);
      console.log('👑 Admin:', existingAdmin.isAdmin);
      
      // Make sure existing user is admin
      if (!existingAdmin.isAdmin) {
        existingAdmin.isAdmin = true;
        await existingAdmin.save();
        console.log('✅ Existing user promoted to admin');
      }
    }
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Initialize server
async function startServer() {
  console.log('🚀 Starting server...');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Frontend URL:', process.env.FRONTEND_URL || 'not set');
  console.log('Port:', process.env.PORT || 5000);
  
  // Try to connect to MongoDB Atlas
  const dbConnected = await connectToAtlas();
  
  if (!dbConnected) {
    console.log('⚠️ Using fallback routes due to database connection failure');
    // Use fallback routes if database connection fails
    setupFallbackRoutes();
  }
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  });

  // 404 handler - MUST be LAST
  app.use('*', (req, res) => {
    console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      success: false,
      message: 'Route not found', 
      path: req.originalUrl,
      method: req.method
    });
  });

  // Start server
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
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
      console.log('⚠️ Server running in fallback mode');
      console.log('🔍 To fix: Check MongoDB Atlas connection string and credentials');
    }
  });
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = app;
