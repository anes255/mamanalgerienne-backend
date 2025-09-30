// ==========================================
// MAMAN ALGERIENNE - DEBUG SERVER
// This version has extensive logging to find the problem
// ==========================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

console.log('='.repeat(60));
console.log('🚀 STARTING MAMAN ALGERIENNE BACKEND - DEBUG MODE');
console.log('='.repeat(60));

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// MIDDLEWARE - LOAD FIRST
// ==========================================
console.log('\n📦 Loading middleware...');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Create uploads directories
const uploadDirs = ['./uploads', './uploads/articles', './uploads/products', './uploads/posts', './uploads/avatars'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.use('/uploads', express.static(path.join(__dirname, './uploads')));

// Request logger
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});

console.log('✅ Middleware loaded');

// ==========================================
// DATABASE CONNECTION
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority&appName=Cluster0';

let dbConnected = false;

async function connectDatabase() {
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    dbConnected = true;
    console.log('✅ MongoDB connected:', mongoose.connection.name);
  } catch (error) {
    console.error('❌ MongoDB failed:', error.message);
    dbConnected = false;
  }
}

// ==========================================
// LOAD MODELS
// ==========================================
async function loadModels() {
  if (!dbConnected) {
    console.log('⚠️  Skipping models (no database)');
    return;
  }
  
  try {
    console.log('\n📦 Loading models...');
    
    const modelFiles = ['User', 'Article', 'Product', 'Post', 'Comment', 'Order'];
    
    for (const model of modelFiles) {
      try {
        require(`./models/${model}`);
        console.log(`  ✅ ${model} loaded`);
      } catch (err) {
        console.error(`  ❌ ${model} failed:`, err.message);
      }
    }
    
    console.log('✅ All models loaded');
    
    // Create admin
    const User = mongoose.model('User');
    const admin = await User.findOne({ email: 'mamanalgeriennepartenariat@gmail.com' });
    if (!admin) {
      const newAdmin = new User({
        name: 'مدير الموقع',
        email: 'mamanalgeriennepartenariat@gmail.com',
        phone: '0555123456',
        password: 'anesaya75',
        isAdmin: true,
        status: 'active'
      });
      await newAdmin.save();
      console.log('✅ Admin created:', newAdmin._id);
    } else {
      console.log('✅ Admin exists:', admin._id);
    }
    
  } catch (error) {
    console.error('❌ Models error:', error.message);
  }
}

// ==========================================
// BASIC ROUTES - ALWAYS WORK
// ==========================================
console.log('\n🌐 Setting up basic routes...');

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

console.log('✅ Basic routes ready');

// ==========================================
// LOAD API ROUTES - WITH DETAILED LOGGING
// ==========================================
function loadRoutes() {
  console.log('\n📋 LOADING API ROUTES...');
  console.log('='.repeat(60));
  
  const routeFiles = [
    { path: '/api/auth', file: './routes/auth' },
    { path: '/api/articles', file: './routes/articles' },
    { path: '/api/posts', file: './routes/posts' },
    { path: '/api/products', file: './routes/products' },
    { path: '/api/comments', file: './routes/comments' },
    { path: '/api/orders', file: './routes/Orders' },
    { path: '/api/admin', file: './routes/admin' }
  ];
  
  let loadedCount = 0;
  let failedCount = 0;
  
  for (const route of routeFiles) {
    try {
      console.log(`\n🔍 Loading: ${route.file}`);
      
      // Check if file exists
      const filePath = require.resolve(route.file);
      console.log(`  📁 File exists: ${filePath}`);
      
      // Try to require it
      const router = require(route.file);
      console.log(`  📦 Module loaded: ${typeof router}`);
      
      // Try to use it
      app.use(route.path, router);
      console.log(`  ✅ Route registered: ${route.path}`);
      
      loadedCount++;
      
    } catch (error) {
      console.error(`  ❌ FAILED: ${route.file}`);
      console.error(`  ❌ Error: ${error.message}`);
      console.error(`  ❌ Stack:`, error.stack);
      failedCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Route Loading Summary:`);
  console.log(`   ✅ Loaded: ${loadedCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log('='.repeat(60));
  
  if (loadedCount === 0) {
    console.log('\n⚠️  WARNING: NO ROUTES LOADED!');
    console.log('⚠️  All API endpoints will return 404!');
    console.log('\n🔍 Possible causes:');
    console.log('   1. Route files do not exist in ./routes/ folder');
    console.log('   2. Route files have syntax errors');
    console.log('   3. Route files are missing dependencies');
    console.log('\n🛠️  To fix:');
    console.log('   1. Check that all route files exist');
    console.log('   2. Check Render logs for specific error messages');
    console.log('   3. Verify all required npm packages are installed');
  }
}

// ==========================================
// ERROR HANDLERS - MUST BE LAST
// ==========================================
function setupErrorHandlers() {
  console.log('\n⚠️  Setting up error handlers...');
  
  // 404 handler - catches unmatched routes
  app.use((req, res) => {
    console.log(`❌ 404: ${req.method} ${req.path}`);
    res.status(404).json({ 
      success: false,
      message: 'المسار غير موجود',
      path: req.path,
      hint: 'This path does not exist. Check if routes are loaded correctly.'
    });
  });
  
  // Error handler
  app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في الخادم',
      error: err.message
    });
  });
  
  console.log('✅ Error handlers ready');
}

// ==========================================
// START SERVER
// ==========================================
async function startServer() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 STARTING SERVER SEQUENCE...');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Connect to database
    await connectDatabase();
    
    // Step 2: Load models
    await loadModels();
    
    // Step 3: Load routes (CRITICAL)
    loadRoutes();
    
    // Step 4: Setup error handlers (MUST BE LAST)
    setupErrorHandlers();
    
    // Step 5: Start listening
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n' + '='.repeat(60));
      console.log('✅ SERVER IS RUNNING!');
      console.log('='.repeat(60));
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`🏥 Health: http://localhost:${PORT}/health`);
      console.log(`📊 Database: ${dbConnected ? 'Connected ✅' : 'Disconnected ⚠️'}`);
      console.log('='.repeat(60));
      console.log('\n🔍 DEBUGGING INFO:');
      console.log('   If you get 404 errors on /api/* endpoints:');
      console.log('   1. Check the "Route Loading Summary" above');
      console.log('   2. Look for "FAILED" messages');
      console.log('   3. Check the error messages for each failed route');
      console.log('='.repeat(60) + '\n');
    });
    
  } catch (error) {
    console.error('\n❌ STARTUP FAILED:', error);
    process.exit(1);
  }
}

// Start everything
startServer();
