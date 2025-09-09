const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// CORS configuration - updated for production
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:5500'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Create uploads directories if they don't exist
const uploadsDir = process.env.NODE_ENV === 'production' ? '/tmp/uploads' : './uploads';
const dirs = [
  `${uploadsDir}/articles`, 
  `${uploadsDir}/products`, 
  `${uploadsDir}/posts`, 
  `${uploadsDir}/avatars`
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir));

// Serve static files in production (for frontend)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working', 
    routes: 'loaded',
    environment: process.env.NODE_ENV || 'development'
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
        articles: [],
        products: [],
        posts: [],
        comments: [],
        pagination: { current: 1, pages: 0, total: 0 }
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
      console.log('🔒 Please check your database password in the connection string');
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
  
  // Try to connect to MongoDB Atlas
  const dbConnected = await connectToAtlas();
  
  if (!dbConnected) {
    // Use fallback routes if database connection fails
    setupFallbackRoutes();
  }

  // Handle React routing in production, return all requests to the app
  if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
      // Only serve index.html for non-API routes
      if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
      } else {
        res.status(404).json({ 
          message: 'Route not found', 
          path: req.originalUrl,
          method: req.method
        });
      }
    });
  }
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
    });
  });

  // 404 handler for API routes
  app.use('/api/*', (req, res) => {
    console.log(`404 - API Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      message: 'API route not found', 
      path: req.originalUrl,
      method: req.method
    });
  });

  // Start server
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
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
      console.log('💡 Database connection failed - using fallback routes');
    }
  });
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = app;
