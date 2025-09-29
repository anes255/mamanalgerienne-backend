require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const net = require('net');
const app = express();

// ============= Helper: Check if port is available =============
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.close();
        resolve(true);
      })
      .listen(port, '0.0.0.0');
  });
}

// Prevent multiple instances (in same process)
if (global.serverInstance) {
  console.log('⚠️ Server already running, exiting...');
  process.exit(0);
}
global.serverInstance = true;

// Create upload directories if not exist
const dirs = [
  './uploads/articles',
  './uploads/products',
  './uploads/posts',
  './uploads/avatars'
];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// CORS setup
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = [
      process.env.FRONTEND_URL || 'https://maman-algerienne.onrender.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://maman-algerienne.onrender.com'
    ];
    if (allowed.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, './uploads')));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Health check and test endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server running',
    timestamp: new Date().toISOString(),
    dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API working',
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
  } catch (err) {
    console.error('Error loading routes:', err.message);
    setupFallbackRoutes();
  }
}
function setupFallbackRoutes() {
  console.log('Setting up fallback (no DB) routes...');
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (
      email === 'mamanalgeriennepartenariat@gmail.com' &&
      password === 'anesaya75'
    ) {
      res.json({
        token: 'test-admin-token',
        user: { id: '1', name: 'مدير الموقع', email, isAdmin: true }
      });
    } else {
      res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
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

  const emptyRoutes = ['/api/articles','/api/products','/api/posts','/api/comments'];
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
      counts: {
        articles: 0,
        products: 0,
        posts: 0,
        users: 1,
        comments: 0
      },
      stats: {
        todayViews: 0,
        pendingComments: 0,
        newUsersThisWeek: 0,
        popularCategory: 'عام'
      }
    });
  });
  console.log('✅ Fallback routes set up');
}

// DB connection
async function connectToAtlas() {
  try {
    const uri = process.env.MONGODB_URI ||
      'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority&appName=Cluster0';
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB Atlas successfully');
    await createAdminUser();
    setupFullRoutes();
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    return false;
  }
}

async function createAdminUser() {
  try {
    const User = require('./models/User');
    const existing = await User.findOne({ email: 'mamanalgeriennepartenariat@gmail.com' });
    if (!existing) {
      const admin = new User({
        name: 'مدير الموقع',
        email: 'mamanalgeriennepartenariat@gmail.com',
        phone: '0555123456',
        password: 'anesaya75',
        isAdmin: true
      });
      await admin.save();
      console.log('✅ Admin user created');
    } else {
      if (!existing.isAdmin) {
        existing.isAdmin = true;
        await existing.save();
        console.log('✅ Promoted existing user to admin');
      } else {
        console.log('✅ Admin user already exists');
      }
    }
  } catch (err) {
    console.error('Error in createAdminUser:', err.message);
  }
}

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  if (server) {
    server.close(() => {
      console.log('Server closed');
      mongoose.connection.close(false, () => {
        console.log('DB connection closed');
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
});
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  if (server) {
    server.close(() => {
      console.log('Server closed');
      mongoose.connection.close(false, () => {
        console.log('DB connection closed');
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
});

let server;
async function startServer() {
  console.log('Starting server...');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Frontend URL:', process.env.FRONTEND_URL || 'https://maman-algerienne.onrender.com');

  const PORT = process.env.PORT || 5000;

  console.log(`Checking port ${PORT} availability...`);
  const available = await isPortAvailable(PORT);
  if (!available) {
    console.error(`❌ Port ${PORT} is already in use. Exiting.`);
    process.exit(1);
  }
  console.log(`✅ Port ${PORT} is available.`);

  const connected = await connectToAtlas();
  if (!connected) {
    console.warn('⚠️ Database connection failed. Using fallback routes.');
    setupFallbackRoutes();
  }

  // Error-handling middleware
  app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  });

  // 404 fallback
  app.use('*', (req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    res.status(404).json({ message: 'Route not found', path: req.originalUrl, method: req.method });
  });

  try {
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`Health: http://<your-backend-domain>/health`);
      console.log(`Test: http://<your-backend-domain>/api/test`);
    });
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`FATAL: Port ${PORT} in use!`);
      } else {
        console.error('Server error on listen:', error);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('Fatal failure starting server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('Fatal start error:', err);
    process.exit(1);
  });
}

module.exports = app;
