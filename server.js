require('dotenv').config();

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
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'https://maman-algerienne.onrender.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://maman-algerienne.onrender.com',
      'https://maman-algerienne.netlify.app',
      'https://maman-algerienne.vercel.app'
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, './uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Maman Algerienne Backend Server is running',
    timestamp: new Date().toISOString(),
    dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    mongooseVersion: mongoose.version
  });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Maman Algerienne API is working', 
    routes: 'loaded',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    server: 'Maman Algerienne Backend'
  });
});

// Debug route to test MongoDB connection
app.get('/api/debug/connection', async (req, res) => {
  try {
    console.log('🔍 Testing MongoDB connection...');
    
    // Test if we can connect to MongoDB
    const connectionState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    const result = {
      connectionState: states[connectionState] || 'unknown',
      connectionStateCode: connectionState,
      mongooseVersion: mongoose.version,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      mongoUri: process.env.MONGODB_URI ? 'Set in environment' : 'Not set in environment',
      mongoUriPartial: process.env.MONGODB_URI ? 
        `mongodb+srv://mamanalgerienne:***@cluster0.iqodm96.mongodb.net/...` : 
        'No URI found',
      timestamp: new Date().toISOString()
    };
    
    // Try to ping the database
    if (connectionState === 1) {
      try {
        await mongoose.connection.db.admin().ping();
        result.pingTest = 'SUCCESS - Database is reachable';
        
        // Try to list collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        result.collections = collections.map(col => col.name);
        result.collectionsCount = collections.length;
        result.databaseName = mongoose.connection.name;
        
      } catch (pingError) {
        result.pingTest = 'FAILED - ' + pingError.message;
        result.pingError = pingError.message;
      }
    } else {
      result.pingTest = 'SKIPPED - Not connected to database';
    }
    
    console.log('🔍 Connection test result:', result);
    res.json(result);
    
  } catch (error) {
    console.error('🔍 Connection test error:', error);
    res.status(500).json({
      error: 'Connection test failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
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
    console.error('Route loading failed, setting up fallback routes...');
    setupFallbackRoutes();
  }
}

// Setup fallback routes when database is not available
function setupFallbackRoutes() {
  console.log('Setting up fallback routes...');
  
  // Basic auth for admin panel
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    console.log('Fallback login attempt:', email);
    
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
      res.status(400).json({ 
        message: 'بيانات الدخول غير صحيحة',
        success: false 
      });
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
  
  // Empty data routes
  const emptyRoutes = [
    '/api/articles',
    '/api/products', 
    '/api/posts',
    '/api/comments',
    '/api/orders'
  ];
  
  emptyRoutes.forEach(route => {
    app.get(route, (req, res) => {
      res.json({
        articles: [],
        products: [],
        posts: [],
        comments: [],
        orders: [],
        pagination: { current: 1, pages: 0, total: 0 },
        message: 'Database connection not available - using fallback mode'
      });
    });
    
    app.get(`${route}/:id`, (req, res) => {
      res.status(404).json({ 
        message: 'Item not found',
        fallbackMode: true 
      });
    });
    
    app.post(route, (req, res) => {
      res.status(503).json({ 
        message: 'Database not available. Please check MongoDB Atlas connection.',
        details: 'Server is running in fallback mode. Check environment variables.',
        fallbackMode: true
      });
    });
    
    app.put(`${route}/:id`, (req, res) => {
      res.status(503).json({ 
        message: 'Database not available. Please check MongoDB Atlas connection.',
        fallbackMode: true
      });
    });
    
    app.delete(`${route}/:id`, (req, res) => {
      res.status(503).json({ 
        message: 'Database not available. Please check MongoDB Atlas connection.',
        fallbackMode: true
      });
    });
  });

  // Admin routes
  app.get('/api/admin/dashboard', (req, res) => {
    res.json({
      counts: { 
        articles: 0, 
        products: 0, 
        posts: 0, 
        users: 1, 
        comments: 0, 
        orders: 0 
      },
      stats: { 
        todayViews: 0, 
        pendingComments: 0, 
        newUsersThisWeek: 0, 
        popularCategory: 'عام' 
      },
      fallbackMode: true
    });
  });
  
  app.get('/api/admin/theme', (req, res) => {
    res.json({
      theme: {
        primaryColor: '#d4a574',
        secondaryColor: '#f8e8d4',
        textColor: '#2c2c2c',
        lightText: '#666666',
        bgColor: '#fdfbf7',
        borderColor: '#e5d5c8',
        accentColor: '#b8860b'
      },
      fallbackMode: true
    });
  });
  
  app.post('/api/admin/theme', (req, res) => {
    res.json({
      message: 'تم حفظ الألوان بنجاح (وضع التطوير)',
      theme: req.body,
      fallbackMode: true
    });
  });
  
  // Orders stats route
  app.get('/api/orders/stats/dashboard', (req, res) => {
    res.json({
      totalOrders: 0,
      pendingOrders: 0,
      todayOrders: 0,
      monthRevenue: 0,
      fallbackMode: true
    });
  });
  
  console.log('✅ Fallback routes set up successfully');
}

// MongoDB Atlas connection
async function connectToAtlas() {
  try {
    // ✅ Using your exact MongoDB Atlas URL
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
    
    console.log('🔌 Connecting to MongoDB Atlas...');
    console.log('🔌 Using connection string with cluster0.iqodm96.mongodb.net');
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000 // 45 seconds
    });
    
    console.log('✅ Connected to MongoDB Atlas successfully');
    console.log('📊 Database name:', mongoose.connection.name);
    console.log('📊 Connection state:', mongoose.connection.readyState);
    
    // Create admin user after connection
    await createAdminUser();
    
    // Load full routes
    setupFullRoutes();
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB Atlas connection failed:', error.message);
    
    if (error.message.includes('authentication failed')) {
      console.log('🔐 Authentication failed - check username and password');
      console.log('🔐 Expected: mamanalgerienne / anesaya75');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('🌐 DNS resolution failed - check cluster URL');
    } else if (error.message.includes('serverSelectionTimeoutMS')) {
      console.log('⏱️ Connection timeout - check network access and IP whitelist');
    }
    
    console.log('🔄 Server will continue in fallback mode');
    return false;
  }
}

// Create admin user
async function createAdminUser() {
  try {
    console.log('👤 Creating/checking admin user...');
    
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
    console.error('❌ Error creating admin user:', error.message);
  }
}

// Initialize server
async function startServer() {
  console.log('🚀 Starting Maman Algerienne Backend Server...');
  console.log('📍 Environment:', process.env.NODE_ENV || 'development');
  console.log('📍 Node.js version:', process.version);
  console.log('📍 Mongoose version:', mongoose.version);
  
  // Try to connect to MongoDB Atlas
  const dbConnected = await connectToAtlas();
  
  if (!dbConnected) {
    console.log('⚠️ Database connection failed - setting up fallback routes');
    setupFallbackRoutes();
  }
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  });

  // 404 handler - MUST be LAST
  app.use('*', (req, res) => {
    console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      message: 'Route not found', 
      path: req.originalUrl,
      method: req.method,
      availableRoutes: [
        'GET /health',
        'GET /api/test', 
        'GET /api/debug/connection',
        'POST /api/auth/login',
        'GET /api/articles',
        'GET /api/products',
        'GET /api/orders'
      ]
    });
  });

  // Start server
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`\n🎉 Maman Algerienne Backend Server running on port ${PORT}`);
    console.log(`📊 Health check: ${PORT === 5000 ? 'http://localhost:5000' : 'https://your-app.onrender.com'}/health`);
    console.log(`🧪 API Test: ${PORT === 5000 ? 'http://localhost:5000' : 'https://your-app.onrender.com'}/api/test`);
    console.log(`🔍 Connection Debug: ${PORT === 5000 ? 'http://localhost:5000' : 'https://your-app.onrender.com'}/api/debug/connection`);
    console.log(`🔧 Admin login: mamanalgeriennepartenariat@gmail.com / anesaya75`);
    
    console.log('\n📋 Available Endpoints:');
    console.log('  - GET  /health');
    console.log('  - GET  /api/test');
    console.log('  - GET  /api/debug/connection');
    console.log('  - POST /api/auth/login');
    console.log('  - GET  /api/articles');
    console.log('  - GET  /api/products');
    console.log('  - GET  /api/orders');
    console.log('  - GET  /api/admin/dashboard');
    console.log('  - GET  /api/admin/theme');
    
    if (dbConnected) {
      console.log('\n✅ Server ready with MongoDB Atlas connection');
    } else {
      console.log('\n⚠️ Server running in fallback mode');
      console.log('💡 To fix database connection:');
      console.log('   1. Check MongoDB Atlas credentials');
      console.log('   2. Verify network access (IP whitelist)');
      console.log('   3. Test connection: /api/debug/connection');
    }
    
    console.log('\n' + '='.repeat(60));
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
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

module.exports = app;
