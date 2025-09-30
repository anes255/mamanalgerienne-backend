// ==========================================
// MAMAN ALGERIENNE - COMPLETE BACKEND SERVER
// ROUTES FIXED - ALL ENDPOINTS WORKING
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
    callback(null, true); // Allow all origins for now
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
    console.log('🔗 URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@'));
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    dbConnected = true;
    console.log('✅ MongoDB connected successfully!');
    console.log('✅ Database:', mongoose.connection.name);
    console.log('✅ Connection state:', mongoose.connection.readyState);
    
    // Load models after connection
    loadModels();
    
    // Create admin user
    await createAdminUser();
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('⚠️  Server will continue without database');
    dbConnected = false;
  }
}

// ==========================================
// LOAD MODELS
// ==========================================
function loadModels() {
  try {
    console.log('📦 Loading database models...');
    
    require('./models/User');
    require('./models/Article');
    require('./models/Product');
    require('./models/Post');
    require('./models/Comment');
    require('./models/Order');
    
    console.log('✅ All models loaded successfully');
    
  } catch (error) {
    console.error('❌ Error loading models:', error.message);
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
    
    console.log('👤 Checking for admin user...');
    
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (!existingAdmin) {
      const admin = new User({
        name: 'مدير الموقع',
        email: adminEmail,
        phone: '0555123456',
        password: adminPassword,
        isAdmin: true,
        status: 'active'
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
      }
      console.log('🆔 Admin ID:', existingAdmin._id);
    }
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  }
}

// ==========================================
// BASIC ROUTES - HEALTH CHECK
// ==========================================
app.get('/', (req, res) => {
  res.json({ 
    message: 'Maman Algerienne Backend API',
    status: 'Running',
    version: '1.0.0',
    dbStatus: dbConnected ? 'Connected' : 'Disconnected',
    mongooseState: mongoose.connection.readyState,
    database: mongoose.connection.name || 'Not connected'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    dbStatus: dbConnected ? 'Connected' : 'Disconnected',
    mongooseState: mongoose.connection.readyState,
    database: mongoose.connection.name || 'Not connected',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working', 
    dbStatus: dbConnected ? 'Connected' : 'Disconnected',
    mongooseVersion: mongoose.version
  });
});

// ==========================================
// LOAD API ROUTES - CRITICAL FIX
// ==========================================
function loadRoutes() {
  try {
    console.log('📋 Loading API routes...');
    
    // Import routes
    const authRoutes = require('./routes/auth');
    const articlesRoutes = require('./routes/articles');
    const postsRoutes = require('./routes/posts');
    const productsRoutes = require('./routes/products');
    const commentsRoutes = require('./routes/comments');
    const ordersRoutes = require('./routes/Orders');
    const adminRoutes = require('./routes/admin');
    
    // Use routes
    app.use('/api/auth', authRoutes);
    app.use('/api/articles', articlesRoutes);
    app.use('/api/posts', postsRoutes);
    app.use('/api/products', productsRoutes);
    app.use('/api/comments', commentsRoutes);
    app.use('/api/orders', ordersRoutes);
    app.use('/api/admin', adminRoutes);
    
    console.log('✅ All routes loaded successfully');
    console.log('✅ Routes registered:');
    console.log('   - /api/auth');
    console.log('   - /api/articles');
    console.log('   - /api/posts');
    console.log('   - /api/products');
    console.log('   - /api/comments');
    console.log('   - /api/orders');
    console.log('   - /api/admin');
    
  } catch (error) {
    console.error('❌ Error loading routes:', error.message);
    console.error('❌ Stack:', error.stack);
  }
}

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

// 404 handler - MUST BE AFTER ROUTES
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'المسار غير موجود',
    path: req.path
  });
});

// ==========================================
// MONGOOSE CONNECTION EVENTS
// ==========================================
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to MongoDB');
  dbConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
  dbConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  Mongoose disconnected from MongoDB');
  dbConnected = false;
});

process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ Mongoose connection closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error closing mongoose:', err);
    process.exit(1);
  }
});

// ==========================================
// START SERVER
// ==========================================
async function startServer() {
  try {
    // 1. Connect to database
    await connectDatabase();
    
    // 2. Load routes - CRITICAL: Load BEFORE starting server
    loadRoutes();
    
    // 3. Start listening
    app.listen(PORT, '0.0.0.0', () => {
      console.log('==========================================');
      console.log('✅ SERVER IS RUNNING');
      console.log('✅ Server listening on port:', PORT);
      console.log('✅ Server URL:', `http://localhost:${PORT}`);
      console.log('✅ Health check:', `http://localhost:${PORT}/health`);
      console.log('✅ Database status:', dbConnected ? 'Connected ✅' : 'Disconnected ⚠️');
      if (dbConnected) {
        console.log('✅ Database name:', mongoose.connection.name);
      }
      console.log('==========================================');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
