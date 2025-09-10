const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

// Updated CORS configuration for mobile access
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // Allow localhost and 127.0.0.1 on any port
    if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/)) {
      return callback(null, true);
    }
    
    // Allow your production URLs
    const allowedOrigins = [
      'https://your-frontend-domain.com', // Replace with your actual domain
      'https://maman-algerienne.onrender.com',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // For development, allow any origin that includes your local IP
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight requests
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
  
  // Handle React routing, return all requests to the app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working', routes: 'loaded' });
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
    // You need to replace YOUR_PASSWORD with your actual database password
    const MONGODB_URI = 'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority&appName=Cluster0';
    
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

// Get local IP address for mobile testing
function getLocalIP() {
  const networkInterfaces = os.networkInterfaces();
  
  // Try different interface names
  const possibleInterfaces = ['Wi-Fi', 'en0', 'wlan0', 'eth0', 'Ethernet'];
  
  for (const interfaceName of possibleInterfaces) {
    const networkInterface = networkInterfaces[interfaceName];
    if (networkInterface) {
      const ipv4 = networkInterface.find(addr => addr.family === 'IPv4' && !addr.internal);
      if (ipv4) {
        return ipv4.address;
      }
    }
  }
  
  // Fallback: find any non-internal IPv4 address
  for (const interfaceName in networkInterfaces) {
    const networkInterface = networkInterfaces[interfaceName];
    const ipv4 = networkInterface.find(addr => addr.family === 'IPv4' && !addr.internal);
    if (ipv4) {
      return ipv4.address;
    }
  }
  
  return 'localhost';
}

// Initialize server
async function startServer() {
  console.log('🚀 Starting server...');
  
  // Try to connect to MongoDB Atlas
  const dbConnected = await connectToAtlas();
  
  if (!dbConnected) {
    // Use fallback routes if database connection fails
    setupFallbackRoutes();
  }
  
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

  // Start server with network interface binding for mobile access
  const PORT = process.env.PORT || 5000;
  const HOST = process.env.HOST || '0.0.0.0'; // This allows external connections
  const localIP = getLocalIP();

  app.listen(PORT, HOST, () => {
    console.log(`\n🚀 Server running on ${HOST}:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🧪 API Test: http://localhost:${PORT}/api/test`);
    console.log(`📰 Articles: http://localhost:${PORT}/api/articles`);
    console.log(`🛍️ Products: http://localhost:${PORT}/api/products`);
    console.log(`📢 Posts: http://localhost:${PORT}/api/posts`);
    
    // Show IP addresses for mobile testing
    if (localIP !== 'localhost') {
      console.log(`\n📱 MOBILE ACCESS URLS:`);
      console.log(`   Server: http://${localIP}:${PORT}`);
      console.log(`   Health: http://${localIP}:${PORT}/health`);
      console.log(`   API: http://${localIP}:${PORT}/api/test`);
      console.log(`\n💡 UPDATE YOUR FRONTEND LOCAL_IP TO: ${localIP}`);
      console.log(`   Replace 192.168.1.100 with ${localIP} in your frontend files`);
    }
    
    console.log(`\n🔧 Admin login credentials:`);
    console.log(`   Email: mamanalgeriennepartenariat@gmail.com`);
    console.log(`   Password: anesaya75\n`);
    
    if (dbConnected) {
      console.log('✅ Server ready with MongoDB Atlas');
    } else {
      console.log('⚠️ Server running in fallback mode');
      console.log('🔍 To fix: Replace YOUR_PASSWORD in the MongoDB URI with your actual password');
      console.log('🔍 The connection string should look like:');
      console.log('   mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/...');
    }
    
    console.log(`\n📋 MOBILE SETUP INSTRUCTIONS:`);
    console.log(`1. Make sure your mobile device is on the same WiFi network`);
    console.log(`2. Update LOCAL_IP in your frontend files to: ${localIP}`);
    console.log(`3. Access your frontend using: http://${localIP}:3000 (or your frontend port)`);
    console.log(`4. The mobile device will now connect to: http://${localIP}:${PORT}/api`);
  });
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = app;
