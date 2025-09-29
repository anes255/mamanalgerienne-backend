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
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'https://maman-algerienne.onrender.com'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Origin allowed by CORS:', origin);
      callback(null, true); // Allow all origins for now
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
    console.error('❌ Error loading routes:', error.message);
    console.error('Stack trace:', error.stack);
    throw error; // Re-throw to be caught by the caller
  }
}

// Setup fallback routes when database is not available
function setupFallbackRoutes() {
  console.log('⚠️  Setting up fallback routes...');
  
  // Generate a valid-looking ObjectId
  const fakeObjectId = '507f1f77bcf86cd799439011';
  
  // Storage for fallback data (in-memory, will be lost on restart)
  const fallbackData = {
    articles: [],
    products: [],
    posts: [],
    orders: []
  };
  
  // Basic auth for admin panel
  app.post('/api/auth/login', (req, res) => {
    const { email, password, username } = req.body;
    const loginField = email || username;
    
    console.log('🔑 Fallback login attempt:', loginField);
    
    if (loginField === 'mamanalgeriennepartenariat@gmail.com' && password === 'anesaya75') {
      res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        token: 'test-admin-token',
        user: {
          _id: fakeObjectId,
          id: fakeObjectId,
          name: 'مدير الموقع',
          email: 'mamanalgeriennepartenariat@gmail.com',
          phone: '0555123456',
          isAdmin: true,
          avatar: null
        }
      });
    } else {
      res.status(400).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }
  });
  
  app.get('/api/auth/me', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token === 'test-admin-token') {
      res.json({
        success: true,
        user: {
          _id: fakeObjectId,
          id: fakeObjectId,
          name: 'مدير الموقع',
          email: 'mamanalgeriennepartenariat@gmail.com',
          phone: '0555123456',
          isAdmin: true,
          avatar: null
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'غير مصرح', code: 'INVALID_TOKEN' });
    }
  });
  
  // Articles routes
  app.get('/api/articles', (req, res) => {
    res.json({
      articles: fallbackData.articles,
      pagination: { current: 1, pages: 1, total: fallbackData.articles.length }
    });
  });
  
  app.get('/api/articles/:id', (req, res) => {
    const article = fallbackData.articles.find(a => a._id === req.params.id);
    if (article) {
      res.json(article);
    } else {
      res.status(404).json({ message: 'المقال غير موجود' });
    }
  });
  
  app.post('/api/articles', (req, res) => {
    const newArticle = {
      _id: Date.now().toString(),
      ...req.body,
      author: {
        _id: fakeObjectId,
        name: 'مدير الموقع'
      },
      images: req.body.images || [],
      published: true,
      featured: req.body.featured || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      views: 0,
      likes: []
    };
    fallbackData.articles.push(newArticle);
    res.status(201).json({
      message: 'تم إنشاء المقال بنجاح (وضع تجريبي - البيانات مؤقتة)',
      article: newArticle
    });
  });
  
  app.delete('/api/articles/:id', (req, res) => {
    const index = fallbackData.articles.findIndex(a => a._id === req.params.id);
    if (index > -1) {
      fallbackData.articles.splice(index, 1);
      res.json({ message: 'تم حذف المقال بنجاح' });
    } else {
      res.status(404).json({ message: 'المقال غير موجود' });
    }
  });
  
  // Products routes
  app.get('/api/products', (req, res) => {
    res.json({
      products: fallbackData.products,
      pagination: { current: 1, pages: 1, total: fallbackData.products.length }
    });
  });
  
  app.get('/api/products/:id', (req, res) => {
    const product = fallbackData.products.find(p => p._id === req.params.id);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'المنتج غير موجود' });
    }
  });
  
  app.post('/api/products', (req, res) => {
    const newProduct = {
      _id: Date.now().toString(),
      ...req.body,
      seller: {
        _id: fakeObjectId,
        name: 'مدير الموقع',
        phone: '0555123456'
      },
      images: req.body.images || [],
      inStock: true,
      featured: req.body.featured || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      views: 0,
      likes: [],
      rating: { average: 0, count: 0 }
    };
    fallbackData.products.push(newProduct);
    res.status(201).json({
      message: 'تم إضافة المنتج بنجاح (وضع تجريبي - البيانات مؤقتة)',
      product: newProduct
    });
  });
  
  app.delete('/api/products/:id', (req, res) => {
    const index = fallbackData.products.findIndex(p => p._id === req.params.id);
    if (index > -1) {
      fallbackData.products.splice(index, 1);
      res.json({ message: 'تم حذف المنتج بنجاح' });
    } else {
      res.status(404).json({ message: 'المنتج غير موجود' });
    }
  });
  
  // Posts/Ads routes
  app.get('/api/posts', (req, res) => {
    res.json({
      posts: fallbackData.posts,
      pagination: { current: 1, pages: 1, total: fallbackData.posts.length }
    });
  });
  
  app.get('/api/posts/:id', (req, res) => {
    const post = fallbackData.posts.find(p => p._id === req.params.id);
    if (post) {
      res.json(post);
    } else {
      res.status(404).json({ message: 'المنشور غير موجود' });
    }
  });
  
  app.post('/api/posts/ad', (req, res) => {
    const newPost = {
      _id: Date.now().toString(),
      ...req.body,
      author: {
        _id: fakeObjectId,
        name: 'مدير الموقع'
      },
      type: 'ad',
      images: req.body.images || [],
      approved: true,
      featured: req.body.featured || false,
      adDetails: {
        link: req.body.link || '',
        buttonText: req.body.buttonText || 'اقرأ المزيد',
        featured: req.body.featured || false
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      views: 0,
      likes: []
    };
    fallbackData.posts.push(newPost);
    res.status(201).json({
      message: 'تم إنشاء الإعلان بنجاح (وضع تجريبي - البيانات مؤقتة)',
      post: newPost
    });
  });
  
  app.post('/api/posts/community', (req, res) => {
    const newPost = {
      _id: Date.now().toString(),
      ...req.body,
      author: {
        _id: fakeObjectId,
        name: 'مدير الموقع'
      },
      type: 'community',
      images: req.body.images || [],
      approved: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      views: 0,
      likes: []
    };
    fallbackData.posts.push(newPost);
    res.status(201).json({
      message: 'تم إنشاء المنشور بنجاح (وضع تجريبي - البيانات مؤقتة)',
      post: newPost
    });
  });
  
  app.delete('/api/posts/:id', (req, res) => {
    const index = fallbackData.posts.findIndex(p => p._id === req.params.id);
    if (index > -1) {
      fallbackData.posts.splice(index, 1);
      res.json({ message: 'تم حذف المنشور بنجاح' });
    } else {
      res.status(404).json({ message: 'المنشور غير موجود' });
    }
  });
  
  // Orders routes
  app.get('/api/orders', (req, res) => {
    res.json({
      orders: fallbackData.orders,
      pagination: { current: 1, pages: 1, total: fallbackData.orders.length }
    });
  });
  
  app.get('/api/orders/:id', (req, res) => {
    const order = fallbackData.orders.find(o => o._id === req.params.id);
    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ message: 'الطلب غير موجود' });
    }
  });
  
  // Comments routes
  app.get('/api/comments', (req, res) => {
    res.json({
      comments: [],
      pagination: { current: 1, pages: 0, total: 0 }
    });
  });

  // Admin routes
  app.get('/api/admin/dashboard', (req, res) => {
    res.json({
      counts: { 
        articles: fallbackData.articles.length, 
        products: fallbackData.products.length, 
        posts: fallbackData.posts.length, 
        users: 1, 
        comments: 0,
        orders: fallbackData.orders.length
      },
      stats: { 
        todayViews: 0, 
        pendingComments: 0, 
        newUsersThisWeek: 0, 
        popularCategory: 'عام' 
      }
    });
  });
  
  app.get('/api/admin/comments', (req, res) => {
    res.json({
      comments: [],
      pagination: { current: 1, pages: 0, total: 0 }
    });
  });
  
  console.log('✅ Fallback routes set up with temporary in-memory storage');
  console.log('⚠️  WARNING: All data will be lost when the server restarts!');
  console.log('🔧 Please connect MongoDB Atlas for persistent data storage');
}

// MongoDB Atlas connection
async function connectToDatabase() {
  try {
    // Get MongoDB URI from environment variable or use default
    const MONGODB_URI = process.env.MONGODB_URI || 
      'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority&appName=Cluster0';
    
    console.log('🔌 Attempting to connect to MongoDB Atlas...');
    console.log('🔌 Connection string:', MONGODB_URI.replace(/:[^:@]+@/, ':****@')); // Hide password in logs
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds
    });
    
    console.log('✅ Connected to MongoDB Atlas successfully!');
    console.log('✅ Database:', mongoose.connection.name);
    
    // Create admin user after successful connection
    await createAdminUser();
    
    // Load full API routes
    setupFullRoutes();
    
    return true;
    
  } catch (error) {
    console.error('❌ MongoDB Atlas connection failed:', error.message);
    
    if (error.message.includes('authentication failed')) {
      console.log('🔐 Authentication failed - Please check:');
      console.log('   1. Username is correct: mamanalgerienne');
      console.log('   2. Password is correct: anesaya75');
      console.log('   3. User has proper permissions in MongoDB Atlas');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('🌐 Network error - Please check:');
      console.log('   1. Internet connection');
      console.log('   2. MongoDB Atlas cluster is running');
      console.log('   3. Cluster URL is correct');
    } else if (error.message.includes('serverSelectionTimeoutMS')) {
      console.log('⏱️  Connection timeout - Please check:');
      console.log('   1. MongoDB Atlas Network Access allows your IP (0.0.0.0/0 for all)');
      console.log('   2. Firewall settings');
    }
    
    console.log('⚠️  Falling back to in-memory storage...');
    return false;
  }
}

// Create admin user
async function createAdminUser() {
  try {
    const User = require('./models/User');
    
    const adminEmail = 'mamanalgeriennepartenariat@gmail.com';
    
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (!existingAdmin) {
      console.log('👤 Creating admin user...');
      
      const admin = new User({
        name: 'مدير الموقع',
        email: adminEmail,
        phone: '0555123456',
        password: 'anesaya75', // Will be hashed by pre-save middleware
        isAdmin: true,
        status: 'active'
      });
      
      await admin.save();
      console.log('✅ Admin user created successfully!');
      console.log('📧 Email:', adminEmail);
      console.log('🔑 Password: anesaya75');
    } else {
      // Ensure existing user is admin
      if (!existingAdmin.isAdmin) {
        existingAdmin.isAdmin = true;
        await existingAdmin.save();
        console.log('✅ Existing user promoted to admin');
      } else {
        console.log('✅ Admin user already exists');
      }
      console.log('👤 Admin ID:', existingAdmin._id);
    }
  } catch (error) {
    console.error('❌ Error with admin user:', error.message);
  }
}

// Initialize server
async function startServer() {
  console.log('\n🚀 Starting Maman Algerienne Backend Server...');
  console.log('═══════════════════════════════════════════════');
  console.log('📅 Date:', new Date().toLocaleString('ar-DZ'));
  console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
  console.log('🎯 Frontend URL:', process.env.FRONTEND_URL || 'https://maman-algerienne.onrender.com');
  console.log('═══════════════════════════════════════════════\n');
  
  // Try to connect to MongoDB Atlas
  const dbConnected = await connectToDatabase();
  
  if (!dbConnected) {
    // Use fallback routes if database connection fails
    console.log('\n⚠️  Starting server in FALLBACK MODE');
    setupFallbackRoutes();
  }
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('❌ Server error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  });

  // 404 handler - MUST be LAST
  app.use('*', (req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      message: 'Route not found', 
      path: req.originalUrl,
      method: req.method
    });
  });

  // Start server
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log('\n═══════════════════════════════════════════════');
    console.log('✅ SERVER IS RUNNING');
    console.log('═══════════════════════════════════════════════');
    console.log(`🌐 Port: ${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/health`);
    console.log(`🧪 API Test: http://localhost:${PORT}/api/test`);
    console.log('═══════════════════════════════════════════════');
    console.log('\n📋 Available Routes:');
    console.log(`   📰 Articles: /api/articles`);
    console.log(`   🛍️  Products: /api/products`);
    console.log(`   📢 Posts: /api/posts`);
    console.log(`   💬 Comments: /api/comments`);
    console.log(`   📦 Orders: /api/orders`);
    console.log(`   👤 Auth: /api/auth`);
    console.log(`   ⚙️  Admin: /api/admin`);
    console.log('═══════════════════════════════════════════════');
    console.log('\n🔐 Admin Credentials:');
    console.log('   📧 Email: mamanalgeriennepartenariat@gmail.com');
    console.log('   🔑 Password: anesaya75');
    console.log('═══════════════════════════════════════════════\n');
    
    if (dbConnected) {
      console.log('✅ Server is connected to MongoDB Atlas');
      console.log('💾 All data will persist across restarts\n');
    } else {
      console.log('⚠️  Server is running in FALLBACK MODE');
      console.log('⚠️  Using in-memory storage (data will be lost on restart)');
      console.log('🔧 To enable persistent storage:');
      console.log('   1. Set MONGODB_URI environment variable in Render');
      console.log('   2. Verify MongoDB Atlas credentials');
      console.log('   3. Check Network Access settings (allow 0.0.0.0/0)\n');
    }
  });
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('👋 SIGTERM received, shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('👋 SIGINT received, shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

// Start the server
startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

module.exports = app;
