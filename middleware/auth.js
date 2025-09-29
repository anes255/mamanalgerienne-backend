require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Create uploads directories
const dirs = ['./uploads/articles', './uploads/products', './uploads/posts', './uploads/avatars'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// CORS Configuration - Allow all origins for now
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, './uploads')));

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
    dbConnected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString()
  });
});

// Global flag
let routesLoaded = false;

// MongoDB connection
async function connectToDatabase() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 
      'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority&appName=Cluster0';
    
    console.log('\n🔌 Connecting to MongoDB Atlas...');
    console.log('🔌 URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@'));
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ MongoDB connected successfully!');
    console.log('✅ Database:', mongoose.connection.name);
    
    await createAdminUser();
    setupFullRoutes();
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    if (error.message.includes('authentication failed')) {
      console.error('🔐 Check: Username/Password in MongoDB Atlas');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('🌐 Check: Internet connection and cluster URL');
    } else if (error.message.includes('MongoServerSelectionError')) {
      console.error('⏱️ Check: Network Access in MongoDB Atlas (allow 0.0.0.0/0)');
    }
    
    console.log('\n⚠️ Using fallback mode with in-memory storage');
    setupFallbackRoutes();
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
      console.log('👤 Creating admin user...');
      const admin = new User({
        name: 'مدير الموقع',
        email: 'mamanalgeriennepartenariat@gmail.com',
        phone: '0555123456',
        password: 'anesaya75',
        isAdmin: true,
        status: 'active'
      });
      await admin.save();
      console.log('✅ Admin user created!');
      console.log('📧 Email: mamanalgeriennepartenariat@gmail.com');
      console.log('🔑 Password: anesaya75');
      console.log('🆔 ID:', admin._id);
    } else {
      if (!existingAdmin.isAdmin) {
        existingAdmin.isAdmin = true;
        await existingAdmin.save();
        console.log('✅ User promoted to admin');
      } else {
        console.log('✅ Admin user exists');
        console.log('🆔 ID:', existingAdmin._id);
      }
    }
  } catch (error) {
    console.error('❌ Admin user creation failed:', error.message);
  }
}

// Setup full routes
function setupFullRoutes() {
  if (routesLoaded) return;
  
  try {
    console.log('📋 Loading API routes...');
    
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
    app.use('/api/orders', orderRoutes);
    app.use('/api/admin', adminRoutes);
    
    routesLoaded = true;
    console.log('✅ All routes loaded successfully');
  } catch (error) {
    console.error('❌ Route loading failed:', error.message);
    throw error;
  }
}

// Fallback routes
function setupFallbackRoutes() {
  console.log('⚠️ Setting up fallback routes (in-memory storage)...');
  
  const fakeObjectId = '507f1f77bcf86cd799439011';
  const storage = { articles: [], products: [], posts: [], orders: [] };
  
  // Auth
  app.post('/api/auth/login', (req, res) => {
    const { email, username, password } = req.body;
    const loginField = email || username;
    
    if (loginField === 'mamanalgeriennepartenariat@gmail.com' && password === 'anesaya75') {
      res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        token: 'fallback-admin-token',
        user: {
          _id: fakeObjectId,
          id: fakeObjectId,
          name: 'مدير الموقع (وضع مؤقت)',
          email: 'mamanalgeriennepartenariat@gmail.com',
          phone: '0555123456',
          isAdmin: true
        }
      });
    } else {
      res.status(400).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }
  });
  
  app.get('/api/auth/me', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token === 'fallback-admin-token') {
      res.json({
        success: true,
        user: {
          _id: fakeObjectId,
          id: fakeObjectId,
          name: 'مدير الموقع (وضع مؤقت)',
          email: 'mamanalgeriennepartenariat@gmail.com',
          isAdmin: true
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'غير مصرح' });
    }
  });
  
  // Articles
  app.get('/api/articles', (req, res) => {
    res.json({ articles: storage.articles, pagination: { current: 1, pages: 1, total: storage.articles.length } });
  });
  
  app.post('/api/articles', (req, res) => {
    const article = {
      _id: Date.now().toString(),
      ...req.body,
      author: { _id: fakeObjectId, name: 'مدير الموقع' },
      images: [],
      published: true,
      createdAt: new Date().toISOString(),
      views: 0,
      likes: []
    };
    storage.articles.push(article);
    res.status(201).json({ message: 'تم إنشاء المقال (مؤقت)', article });
  });
  
  app.delete('/api/articles/:id', (req, res) => {
    const index = storage.articles.findIndex(a => a._id === req.params.id);
    if (index > -1) {
      storage.articles.splice(index, 1);
      res.json({ message: 'تم حذف المقال' });
    } else {
      res.status(404).json({ message: 'المقال غير موجود' });
    }
  });
  
  // Products
  app.get('/api/products', (req, res) => {
    res.json({ products: storage.products, pagination: { current: 1, pages: 1, total: storage.products.length } });
  });
  
  app.post('/api/products', (req, res) => {
    const product = {
      _id: Date.now().toString(),
      ...req.body,
      seller: { _id: fakeObjectId, name: 'مدير الموقع' },
      images: [],
      inStock: true,
      createdAt: new Date().toISOString(),
      views: 0,
      likes: []
    };
    storage.products.push(product);
    res.status(201).json({ message: 'تم إضافة المنتج (مؤقت)', product });
  });
  
  app.delete('/api/products/:id', (req, res) => {
    const index = storage.products.findIndex(p => p._id === req.params.id);
    if (index > -1) {
      storage.products.splice(index, 1);
      res.json({ message: 'تم حذف المنتج' });
    } else {
      res.status(404).json({ message: 'المنتج غير موجود' });
    }
  });
  
  // Posts
  app.get('/api/posts', (req, res) => {
    res.json({ posts: storage.posts, pagination: { current: 1, pages: 1, total: storage.posts.length } });
  });
  
  app.post('/api/posts/ad', (req, res) => {
    const post = {
      _id: Date.now().toString(),
      ...req.body,
      author: { _id: fakeObjectId, name: 'مدير الموقع' },
      type: 'ad',
      images: [],
      approved: true,
      createdAt: new Date().toISOString(),
      views: 0,
      likes: []
    };
    storage.posts.push(post);
    res.status(201).json({ message: 'تم إنشاء الإعلان (مؤقت)', post });
  });
  
  app.delete('/api/posts/:id', (req, res) => {
    const index = storage.posts.findIndex(p => p._id === req.params.id);
    if (index > -1) {
      storage.posts.splice(index, 1);
      res.json({ message: 'تم حذف الإعلان' });
    } else {
      res.status(404).json({ message: 'الإعلان غير موجود' });
    }
  });
  
  // Orders
  app.get('/api/orders', (req, res) => {
    res.json({ orders: storage.orders, pagination: { current: 1, pages: 1, total: storage.orders.length } });
  });
  
  // Comments
  app.get('/api/comments', (req, res) => {
    res.json({ comments: [], pagination: { current: 1, pages: 0, total: 0 } });
  });
  
  app.get('/api/admin/comments', (req, res) => {
    res.json({ comments: [], pagination: { current: 1, pages: 0, total: 0 } });
  });
  
  console.log('✅ Fallback routes ready');
  console.log('⚠️ Data will be lost on restart!');
}

// Start server
async function startServer() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('🚀 Starting Maman Algerienne Backend');
  console.log('═══════════════════════════════════════════════');
  console.log('📅', new Date().toLocaleString('ar-DZ'));
  console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
  console.log('═══════════════════════════════════════════════\n');
  
  const dbConnected = await connectToDatabase();
  
  // Error handler
  app.use((err, req, res, next) => {
    console.error('❌ Error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({ message: 'Route not found', path: req.originalUrl });
  });

  // Start listening
  const PORT = process.env.PORT || 10000;
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('\n═══════════════════════════════════════════════');
    console.log('✅ SERVER RUNNING');
    console.log('═══════════════════════════════════════════════');
    console.log(`🌐 Port: ${PORT}`);
    console.log(`📊 Health: https://mamanalgerienne-backend.onrender.com/health`);
    console.log(`🧪 Test: https://mamanalgerienne-backend.onrender.com/api/test`);
    console.log('═══════════════════════════════════════════════');
    console.log('\n🔐 Admin Login:');
    console.log('   📧 mamanalgeriennepartenariat@gmail.com');
    console.log('   🔑 anesaya75');
    console.log('═══════════════════════════════════════════════\n');
    
    if (dbConnected) {
      console.log('✅ MongoDB connected - Data will persist');
    } else {
      console.log('⚠️ FALLBACK MODE - Data temporary');
      console.log('🔧 Fix: Add MONGODB_URI to Render environment');
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('👋 Shutting down...');
  await mongoose.connection.close();
  process.exit(0);
});

// Start
startServer().catch(error => {
  console.error('❌ Startup failed:', error);
  process.exit(1);
});

module.exports = app;
