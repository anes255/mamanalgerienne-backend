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

// CORS Configuration - Updated for better compatibility
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow your frontend URL and localhost for development
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'https://maman-algerienne.onrender.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'https://maman-algerienne.onrender.com',
      // Allow file:// protocol for local development
      'null'
    ];
    
    // Allow localhost with any port for development
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin === 'null') {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json({ limit: process.env.MAX_FILE_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.MAX_FILE_SIZE || '10mb' }));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('Origin') || 'none'}`);
  next();
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_PATH || './uploads')));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
  
  // Handle React routing, return all requests to the app (if you had a React frontend)
  // app.get('*', (req, res) => {
  //   res.sendFile(path.join(__dirname, 'public', 'index.html'));
  // });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    environment: process.env.NODE_ENV || 'development'
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
  
  // Basic auth for admin panel - Enhanced
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    console.log('Login attempt:', email);
    
    if (email === 'mamanalgeriennepartenariat@gmail.com' && password === 'anesaya75') {
      const userData = {
        token: 'test-admin-token',
        user: {
          id: '1',
          name: 'مدير الموقع',
          email: 'mamanalgeriennepartenariat@gmail.com',
          isAdmin: true,
          avatar: null,
          phone: '0555123456'
        }
      };
      
      console.log('Login successful for admin');
      res.json(userData);
    } else {
      console.log('Login failed for:', email);
      res.status(400).json({ 
        message: 'بيانات الدخول غير صحيحة',
        code: 'INVALID_CREDENTIALS'
      });
    }
  });
  
  app.get('/api/auth/me', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    console.log('Auth check with token:', token);
    
    if (token === 'test-admin-token') {
      res.json({
        user: {
          id: '1',
          name: 'مدير الموقع',
          email: 'mamanalgeriennepartenariat@gmail.com',
          isAdmin: true,
          avatar: null,
          phone: '0555123456'
        }
      });
    } else {
      res.status(401).json({ 
        message: 'غير مصرح',
        code: 'TOKEN_INVALID'
      });
    }
  });
  
  // Registration fallback
  app.post('/api/auth/register', (req, res) => {
    res.status(503).json({ 
      message: 'التسجيل غير متاح حالياً. قاعدة البيانات غير متصلة.',
      code: 'SERVICE_UNAVAILABLE'
    });
  });
  
  // Empty data routes with better structure
  const emptyRoutes = [
    { path: '/api/articles', dataKey: 'articles' },
    { path: '/api/products', dataKey: 'products' }, 
    { path: '/api/posts', dataKey: 'posts' },
    { path: '/api/comments', dataKey: 'comments' }
  ];
  
  emptyRoutes.forEach(route => {
    app.get(route.path, (req, res) => {
      console.log(`Fallback route hit: ${route.path}`);
      const responseData = {
        [route.dataKey]: [],
        pagination: { 
          current: 1, 
          pages: 0, 
          total: 0,
          limit: 10
        },
        success: true,
        message: 'No data available - database not connected'
      };
      res.json(responseData);
    });
    
    app.get(`${route.path}/:id`, (req, res) => {
      res.status(404).json({ 
        message: 'Item not found',
        code: 'NOT_FOUND'
      });
    });
    
    app.post(route.path, (req, res) => {
      res.status(503).json({ 
        message: 'Database not available. Please check MongoDB Atlas connection.',
        code: 'SERVICE_UNAVAILABLE'
      });
    });
  });

  // Admin dashboard route
  app.get('/api/admin/dashboard', (req, res) => {
    res.json({
      counts: { 
        articles: 0, 
        products: 0, 
        posts: 0, 
        users: 1, 
        comments: 0 
      },
      stats: { 
        todayViews: 0, 
        pendingComments: 0, 
        newUsersThisWeek: 0, 
        popularCategory: 'عام' 
      },
      success: true
    });
  });
  
  console.log('✅ Fallback routes set up');
}

// MongoDB Atlas connection
async function connectToAtlas() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority&appName=Cluster0';
    
    console.log('Connecting to MongoDB Atlas...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000, // 45 seconds
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

// Initialize server
async function startServer() {
  console.log('🚀 Starting server...');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Frontend URL:', process.env.FRONTEND_URL || 'not set');
  
  // Try to connect to MongoDB Atlas
  const dbConnected = await connectToAtlas();
  
  if (!dbConnected) {
    console.log('⚠️ Database connection failed, using fallback routes');
    // Use fallback routes if database connection fails
    setupFallbackRoutes();
  }
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    
    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production') {
      res.status(500).json({ 
        message: 'حدث خطأ في الخادم',
        code: 'INTERNAL_ERROR'
      });
    } else {
      res.status(500).json({ 
        message: 'Server error', 
        error: err.message,
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // 404 handler - MUST be LAST
  app.use('*', (req, res) => {
    console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      message: 'Route not found', 
      path: req.originalUrl,
      method: req.method,
      code: 'NOT_FOUND'
    });
  });

  // Start server
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
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

  // Handle server shutdown gracefully
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
