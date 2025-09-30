require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Create directories
const dirs = ['./uploads/articles', './uploads/products', './uploads/posts', './uploads/avatars'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// CORS
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = [
      process.env.FRONTEND_URL || 'https://maman-algerienne.onrender.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://maman-algerienne.onrender.com'
    ];
    allowed.indexOf(origin) !== -1 ? callback(null, true) : callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, './uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API working', environment: process.env.NODE_ENV });
});

let routesLoaded = false;

function setupFullRoutes() {
  if (routesLoaded) return;
  try {
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
    console.log('✅ Routes loaded');
  } catch (error) {
    console.error('Route loading error:', error.message);
    setupFallbackRoutes();
  }
}

function setupFallbackRoutes() {
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'mamanalgeriennepartenariat@gmail.com' && password === 'anesaya75') {
      res.json({
        token: 'test-admin-token',
        user: { id: '1', name: 'مدير الموقع', email, isAdmin: true }
      });
    } else {
      res.status(400).json({ message: 'بيانات خاطئة' });
    }
  });
  
  app.get('/api/auth/me', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token === 'test-admin-token') {
      res.json({ user: { id: '1', name: 'مدير الموقع', email: 'mamanalgeriennepartenariat@gmail.com', isAdmin: true } });
    } else {
      res.status(401).json({ message: 'غير مصرح' });
    }
  });
  
  ['/api/articles', '/api/products', '/api/posts', '/api/comments'].forEach(route => {
    app.get(route, (req, res) => {
      res.json({ articles: [], products: [], posts: [], comments: [], pagination: { current: 1, pages: 0, total: 0 } });
    });
  });
}

async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority&appName=Cluster0';
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ MongoDB connected');
    
    const User = require('./models/User');
    const admin = await User.findOne({ email: 'mamanalgeriennepartenariat@gmail.com' });
    if (!admin) {
      await new User({
        name: 'مدير الموقع',
        email: 'mamanalgeriennepartenariat@gmail.com',
        phone: '0555123456',
        password: 'anesaya75',
        isAdmin: true
      }).save();
      console.log('✅ Admin created');
    }
    
    setupFullRoutes();
    return true;
  } catch (error) {
    console.error('❌ MongoDB failed:', error.message);
    return false;
  }
}

let server;

process.on('SIGTERM', () => {
  if (server) server.close(() => mongoose.connection.close(false, () => process.exit(0)));
});

async function startServer() {
  console.log('🚀 Starting server...');
  
  const dbConnected = await connectDB();
  if (!dbConnected) setupFallbackRoutes();
  
  app.use((err, req, res, next) => {
    res.status(500).json({ message: 'Server error' });
  });

  app.use('*', (req, res) => {
    res.status(404).json({ message: 'Not found' });
  });

  const PORT = process.env.PORT || 5000;
  
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server on port ${PORT}`);
    console.log(`📊 ${process.env.FRONTEND_URL || 'https://mamanalgerienne-backend.onrender.com'}/health`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} in use! Another server is running.`);
      console.error('Check for: index.js, app.js, or other server files\n');
      process.exit(1);
    }
  });
}

startServer();

module.exports = app;
