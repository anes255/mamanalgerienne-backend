require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

console.log('🚀 Starting Maman Algerienne Backend Server...');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');
console.log('📍 Node.js version:', process.version);

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
    frontendUrl: process.env.FRONTEND_URL || 'not set'
  });
});

// Connection debug route
app.get('/api/debug/connection', (req, res) => {
  res.json({
    mongodb: {
      connected: mongoose.connection.readyState === 1,
      state: mongoose.connection.readyState,
      name: mongoose.connection.name || 'Not connected'
    },
    server: {
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      uptime: process.uptime()
    }
  });
});

// Global flag to track if routes are loaded
let routesLoaded = false;

// Setup essential auth routes first (always available)
function setupEssentialRoutes() {
  console.log('🔧 Setting up essential authentication routes...');
  
  // Essential login route
  app.post('/api/auth/login', async (req, res) => {
    try {
      console.log('📧 Login attempt:', req.body.email || req.body.username);
      
      const { email, username, password } = req.body;
      const loginField = email || username;

      if (!loginField || !password) {
        return res.status(400).json({
          success: false,
          message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
        });
      }

      // Check admin credentials first
      if (loginField === 'mamanalgeriennepartenariat@gmail.com' && password === 'anesaya75') {
        console.log('✅ Admin login successful');
        return res.json({
          success: true,
          message: 'تم تسجيل الدخول بنجاح',
          token: 'test-admin-token',
          user: {
            id: '1',
            name: 'مدير الموقع',
            email: 'mamanalgeriennepartenariat@gmail.com',
            isAdmin: true
          }
        });
      }

      // Try database authentication if available
      try {
        const User = require('./models/User');
        const bcrypt = require('bcryptjs');
        const jwt = require('jsonwebtoken');

        const user = await User.findOne({
          $or: [
            { email: loginField },
            { phone: loginField }
          ]
        });

        if (!user) {
          return res.status(400).json({
            success: false,
            message: 'بيانات الدخول غير صحيحة'
          });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(400).json({
            success: false,
            message: 'بيانات الدخول غير صحيحة'
          });
        }

        const token = jwt.sign(
          { userId: user._id },
          process.env.JWT_SECRET || 'maman-algerienne-secret-key-2024',
          { expiresIn: '30d' }
        );

        console.log('✅ Database login successful for:', user.email);

        res.json({
          success: true,
          message: 'تم تسجيل الدخول بنجاح',
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            isAdmin: user.isAdmin,
            avatar: user.avatar
          }
        });

      } catch (dbError) {
        console.log('Database auth failed, checking fallback credentials');
        return res.status(400).json({
          success: false,
          message: 'بيانات الدخول غير صحيحة'
        });
      }

    } catch (error) {
      console.error('❌ Login error:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في الخادم'
      });
    }
  });

  // Essential register route
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, phone, password, confirmPassword } = req.body;

      // Validation
      if (!name || !email || !phone || !password) {
        return res.status(400).json({
          success: false,
          message: 'جميع الحقول مطلوبة'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'كلمات المرور غير متطابقة'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
        });
      }

      try {
        const User = require('./models/User');
        const jwt = require('jsonwebtoken');

        // Check if user exists
        const existingUser = await User.findOne({ 
          $or: [{ email }, { phone }] 
        });

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'المستخدم موجود مسبقاً'
          });
        }

        // Create user
        const user = new User({
          name,
          email,
          phone,
          password // Will be hashed by the pre-save middleware
        });

        await user.save();

        // Create token
        const token = jwt.sign(
          { userId: user._id },
          process.env.JWT_SECRET || 'maman-algerienne-secret-key-2024',
          { expiresIn: '30d' }
        );

        console.log('✅ New user registered:', email);

        res.status(201).json({
          success: true,
          message: 'تم إنشاء الحساب بنجاح',
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            isAdmin: user.isAdmin,
            avatar: user.avatar
          }
        });

      } catch (dbError) {
        console.error('Database registration failed:', dbError);
        res.status(500).json({
          success: false,
          message: 'خطأ في إنشاء الحساب - قاعدة البيانات غير متاحة'
        });
      }

    } catch (error) {
      console.error('❌ Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'خطأ في الخادم'
      });
    }
  });

  // Essential auth/me route
  app.get('/api/auth/me', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'لا يوجد رمز مصادقة' 
      });
    }

    if (token === 'test-admin-token') {
      return res.json({
        success: true,
        user: {
          id: '1',
          name: 'مدير الموقع',
          email: 'mamanalgeriennepartenariat@gmail.com',
          isAdmin: true
        }
      });
    }

    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'maman-algerienne-secret-key-2024');
      
      // Try to get user from database
      const User = require('./models/User');
      User.findById(decoded.userId).then(user => {
        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'المستخدم غير موجود'
          });
        }

        res.json({
          success: true,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            isAdmin: user.isAdmin,
            avatar: user.avatar
          }
        });
      }).catch(dbError => {
        res.status(401).json({ 
          success: false,
          message: 'رمز المصادقة غير صالح' 
        });
      });

    } catch (jwtError) {
      res.status(401).json({ 
        success: false,
        message: 'رمز المصادقة غير صالح' 
      });
    }
  });

  console.log('✅ Essential routes set up successfully');
}

// Setup full API routes
function setupFullRoutes() {
  if (routesLoaded) return;
  
  try {
    console.log('Setting up full API routes...');
    
    // Import and use routes with error handling
    try {
      const authRoutes = require('./routes/auth');
      app.use('/api/auth', authRoutes);
      console.log('✅ Auth routes loaded');
    } catch (authError) {
      console.log('⚠️ Auth routes failed to load:', authError.message);
    }

    try {
      const articleRoutes = require('./routes/articles');
      app.use('/api/articles', articleRoutes);
      console.log('✅ Article routes loaded');
    } catch (articleError) {
      console.log('⚠️ Article routes failed to load:', articleError.message);
    }

    try {
      const productRoutes = require('./routes/products');
      app.use('/api/products', productRoutes);
      console.log('✅ Product routes loaded');
    } catch (productError) {
      console.log('⚠️ Product routes failed to load:', productError.message);
    }

    try {
      const postRoutes = require('./routes/posts');
      app.use('/api/posts', postRoutes);
      console.log('✅ Post routes loaded');
    } catch (postError) {
      console.log('⚠️ Post routes failed to load:', postError.message);
    }

    try {
      const commentRoutes = require('./routes/comments');
      app.use('/api/comments', commentRoutes);
      console.log('✅ Comment routes loaded');
    } catch (commentError) {
      console.log('⚠️ Comment routes failed to load:', commentError.message);
    }

    try {
      const adminRoutes = require('./routes/admin');
      app.use('/api/admin', adminRoutes);
      console.log('✅ Admin routes loaded');
    } catch (adminError) {
      console.log('⚠️ Admin routes failed to load:', adminError.message);
    }

    try {
      const orderRoutes = require('./routes/Orders');
      app.use('/api/orders', orderRoutes);
      console.log('✅ Order routes loaded');
    } catch (orderError) {
      console.log('⚠️ Order routes failed to load:', orderError.message);
    }
    
    routesLoaded = true;
    console.log('✅ Route loading completed');
    
  } catch (error) {
    console.error('Error in route loading process:', error.message);
  }
}

// Setup fallback routes for missing functionality
function setupFallbackRoutes() {
  console.log('Route loading failed, setting up fallback routes...');
  
  // Empty data routes for frontend compatibility
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
      counts: { articles: 0, products: 0, posts: 0, users: 1, comments: 0, orders: 0 },
      stats: { todayViews: 0, pendingComments: 0, newUsersThisWeek: 0, popularCategory: 'عام' }
    });
  });

  // Admin theme route
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
      }
    });
  });
  
  console.log('✅ Fallback routes set up successfully');
}

// MongoDB Atlas connection
async function connectToAtlas() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority&appName=Cluster0';
    
    console.log('🔌 Connecting to MongoDB Atlas...');
    console.log('🔌 Using connection string with cluster0.iqodm96.mongodb.net');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB Atlas successfully');
    console.log('📊 Database name:', mongoose.connection.name || 'test');
    console.log('📊 Connection state:', mongoose.connection.readyState);
    
    // Create admin user after connection
    await createAdminUser();
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB Atlas connection failed:', error.message);
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
    console.error('Error creating admin user:', error.message);
  }
}

// Initialize server
async function startServer() {
  console.log('🔌 Mongoose version:', require('mongoose/package.json').version);
  
  // Always setup essential routes first
  setupEssentialRoutes();
  
  // Try to connect to MongoDB Atlas
  const dbConnected = await connectToAtlas();
  
  // Setup full routes
  setupFullRoutes();
  
  // Setup fallback routes for any missing functionality
  setupFallbackRoutes();
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  });

  // 404 handler - MUST be LAST
  app.use('*', (req, res) => {
    console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      message: 'Route not found', 
      path: req.originalUrl,
      method: req.method
    });
  });

  // Start server
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`\n🎉 Maman Algerienne Backend Server running on port ${PORT}`);
    console.log(`📊 Health check: https://your-app.onrender.com/health`);
    console.log(`🧪 API Test: https://your-app.onrender.com/api/test`);
    console.log(`🔍 Connection Debug: https://your-app.onrender.com/api/debug/connection`);
    console.log(`🔧 Admin login: mamanalgeriennepartenariat@gmail.com / anesaya75`);
    
    console.log(`📋 Available Endpoints:`);
    console.log(` - GET /health`);
    console.log(` - GET /api/test`);
    console.log(` - GET /api/debug/connection`);
    console.log(` - POST /api/auth/login`);
    console.log(` - GET /api/articles`);
    console.log(` - GET /api/products`);
    console.log(` - GET /api/orders`);
    console.log(` - GET /api/admin/dashboard`);
    console.log(` - GET /api/admin/theme`);
    
    if (dbConnected) {
      console.log('✅ Server ready with MongoDB Atlas connection');
    } else {
      console.log('⚠️ Server running with limited functionality (no database)');
    }
    console.log('============================================================');
  });
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = app;
