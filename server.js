// ==========================================
// MAMAN ALGERIENNE - COMPLETE BACKEND SERVER
// ==========================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'maman-algerienne-secret-key-2024';

console.log('🚀 Starting Maman Algerienne Backend Server...');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');
console.log('📍 Port:', PORT);

// ==========================================
// CREATE UPLOAD DIRECTORIES
// ==========================================
const uploadDirs = [
  './uploads',
  './uploads/articles',
  './uploads/products',
  './uploads/posts',
  './uploads/avatars'
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// ==========================================
// CORS CONFIGURATION
// ==========================================
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'https://maman-algerienne.onrender.com',
      'http://localhost:3000',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8080',
      'https://maman-algerienne.onrender.com',
      'https://anes255.github.io'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all in development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from uploads
app.use('/uploads', express.static(path.join(__dirname, './uploads')));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ==========================================
// DATABASE CONNECTION
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority&appName=Cluster0';

let dbConnected = false;

async function connectDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    
    dbConnected = true;
    console.log('✅ MongoDB connected successfully!');
    console.log('✅ Database:', mongoose.connection.name);
    
    // Import models after connection
    require('./models/User');
    require('./models/Article');
    require('./models/Product');
    require('./models/Post');
    require('./models/Comment');
    require('./models/Order');
    
    // Create admin user after connection
    await createAdminUser();
    
    console.log('✅ All models loaded');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('⚠️  Server will run without database');
    dbConnected = false;
  }
}

// ==========================================
// CREATE ADMIN USER
// ==========================================
async function createAdminUser() {
  try {
    const User = mongoose.model('User');
    const adminEmail = 'mamanalgeriennepartenariat@gmail.com';
    const adminPassword = 'anesaya75';
    
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (!existingAdmin) {
      const admin = new User({
        name: 'مدير الموقع',
        email: adminEmail,
        phone: '0555123456',
        password: adminPassword,
        isAdmin: true
      });
      
      await admin.save();
      console.log('✅ Admin user created successfully!');
      console.log('🆔 Admin ID:', admin._id);
    } else {
      if (!existingAdmin.isAdmin) {
        existingAdmin.isAdmin = true;
        await existingAdmin.save();
        console.log('✅ Existing user promoted to admin');
      } else {
        console.log('✅ Admin user already exists');
        console.log('🆔 Admin ID:', existingAdmin._id);
      }
    }
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  }
}

// ==========================================
// ROUTES - HEALTH CHECK
// ==========================================
app.get('/', (req, res) => {
  res.json({ 
    message: 'Maman Algerienne Backend API',
    status: 'Running',
    dbStatus: dbConnected ? 'Connected' : 'Disconnected'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    dbStatus: dbConnected ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working', dbStatus: dbConnected ? 'Connected' : 'Disconnected' });
});

// ==========================================
// LOAD ROUTES
// ==========================================
connectDatabase().then(() => {
  if (dbConnected) {
    try {
      // Import and use routes
      const authRoutes = require('./routes/auth');
      const articlesRoutes = require('./routes/articles');
      const postsRoutes = require('./routes/posts');
      const productsRoutes = require('./routes/products');
      const commentsRoutes = require('./routes/comments');
      const ordersRoutes = require('./routes/Orders');
      const adminRoutes = require('./routes/admin');
      
      app.use('/api/auth', authRoutes);
      app.use('/api/articles', articlesRoutes);
      app.use('/api/posts', postsRoutes);
      app.use('/api/products', productsRoutes);
      app.use('/api/comments', commentsRoutes);
      app.use('/api/orders', ordersRoutes);
      app.use('/api/admin', adminRoutes);
      
      console.log('✅ All routes loaded successfully');
    } catch (error) {
      console.error('❌ Error loading routes:', error.message);
      console.log('⚠️  Some routes may not be available');
    }
  }
});

// ==========================================
// ERROR HANDLING
// ==========================================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false,
    message: 'خطأ في الخادم',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'المسار غير موجود',
    path: req.path
  });
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
  console.log('==========================================');
  console.log('✅ SERVER IS RUNNING');
  console.log('✅ Server listening on port:', PORT);
  console.log('✅ Server URL:', `http://localhost:${PORT}`);
  console.log('✅ Health check:', `http://localhost:${PORT}/health`);
  console.log('✅ Database status:', dbConnected ? 'Connected' : 'Starting...');
  console.log('==========================================');
});
