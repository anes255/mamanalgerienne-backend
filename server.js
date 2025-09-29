require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Prevent multiple server instances
if (global.serverInstance) {
  console.log('⚠️  Server already running, skipping initialization');
  process.exit(0);
}
global.serverInstance = true;

// Create uploads directories
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, './uploads')));

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

let routesLoaded = false;

function setupFullRoutes() {
  if (routesLoaded) return;
  try {
    console.log('Setting up full API routes...');
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

function setupFallbackRoutes() {
  console.log('📋 Setting up fallback routes...');
  
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
  
  const emptyRoutes = ['/api/articles', '/api/products', '/api/posts', '/api/comments'];
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
      res.status(503).json({ message: 'Database not available' });
    });
  });

  app.get('/api/admin/dashboard', (req, res) => {
    res.json({
      counts: { articles: 0, products: 0, posts: 0, users: 1, comments: 0 },
      stats: { todayViews: 0, pendingComments: 0, newUsersThisWeek: 0, popularCategory: 'عام' }
    });
  });
  
  console.log('✅ Fallback routes set up');
}

async function connectToAtlas() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority&appName=Cluster0';
    console.log('Connecting to MongoDB Atlas...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB Atlas successfully');
    await createAdminUser();
    setupFullRoutes();
    return true;
  } catch (error) {
    console.error('❌ MongoDB Atlas connection failed:', error.message);
    return false;
  }
}

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

let server;

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('Server closed');
      mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('Server closed');
      mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
});

async function startServer() {
  console.log('🚀 Starting Maman Algerienne server...');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Frontend URL:', process.env.FRONTEND_URL || 'https://maman-algerienne.onrender.com');
  
  const dbConnected = await connectToAtlas();
  
  if (!dbConnected) {
    console.log('⚠️  Using fallback routes (no database)');
    setupFallbackRoutes();
  }
  
  app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  });

  app.use('*', (req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      message: 'Route not found', 
      path: req.originalUrl,
      method: req.method
    });
  });

  const PORT = process.env.PORT || 5000;
  
  try {
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🌟 Maman Algerienne Server running on port ${PORT}`);
      console.log(`📊 Health: https://mamanalgerienne-backend.onrender.com/health`);
      console.log(`🧪 Test: https://mamanalgerienne-backend.onrender.com/api/test`);
      console.log(`\n🔧 Admin: mamanalgeriennepartenariat@gmail.com / anesaya75`);
      console.log(dbConnected ? '✅ MongoDB Atlas connected' : '⚠️  Fallback mode');
      console.log('════════════════════════════════════════════════════════════');
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\n❌ PORT ${PORT} IS ALREADY IN USE`);
        console.log('💡 SOLUTIONS:');
        console.log('  1. Kill existing process: pkill -f "node server.js"');
        console.log('  2. On Render: Wait 30s for old instance to stop');
        console.log('  3. Check package.json - only "start": "node server.js"');
        console.log('  4. Restart Render service with "Clear cache & deploy"\n');
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = app;
