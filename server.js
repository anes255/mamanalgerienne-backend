require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const net = require('net');

const app = express();

// ================= Prevent double server =================
if (global.serverInstance) {
  console.log('⚠️ Server already running, exiting...');
  process.exit(0);
}
global.serverInstance = true;

// ================= Directories =================
['./uploads/articles', './uploads/products', './uploads/posts', './uploads/avatars']
  .forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });

// ================= CORS =================
const corsOptions = {
  origin: function (origin, callback) {
    const allowed = [
      process.env.FRONTEND_URL || 'https://maman-algerienne.onrender.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    if (!origin || allowed.includes(origin)) {
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

// ================= Health & test =================
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    db: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    env: process.env.NODE_ENV || 'development',
    time: new Date().toISOString()
  });
});
app.get('/api/test', (req, res) => {
  res.json({ message: 'API working' });
});

// ================= Safe route loader =================
function safeRoute(file, pathName) {
  try {
    const route = require(file);
    app.use(pathName, route);
    console.log(`✅ Loaded route: ${pathName}`);
    return true;
  } catch (err) {
    console.warn(`⚠️ Missing route: ${file}`);
    return false;
  }
}

// ================= Routes =================
function setupRoutes() {
  let ok = true;
  ok &= safeRoute('./routes/auth', '/api/auth');
  ok &= safeRoute('./routes/articles', '/api/articles');
  ok &= safeRoute('./routes/products', '/api/products');
  ok &= safeRoute('./routes/posts', '/api/posts');
  ok &= safeRoute('./routes/comments', '/api/comments');
  ok &= safeRoute('./routes/admin', '/api/admin');
  ok &= safeRoute('./routes/Orders', '/api/orders');
  return ok;
}

// ================= Fallback routes =================
function setupFallback() {
  console.log('⚠️ Using fallback in-memory routes');
  app.get('/api/articles', (req, res) => res.json([]));
  app.get('/api/products', (req, res) => res.json([]));
  app.get('/api/posts', (req, res) => res.json([]));
  app.get('/api/comments', (req, res) => res.json([]));
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'mamanalgeriennepartenariat@gmail.com' && password === 'anesaya75') {
      return res.json({ token: 'test-admin-token', user: { email, isAdmin: true } });
    }
    res.status(401).json({ message: 'Unauthorized' });
  });
}

// ================= MongoDB =================
async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI ||
      'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority';
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Connected to MongoDB Atlas');
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    return false;
  }
}

// ================= Port check =================
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.close();
        resolve(true);
      })
      .listen(port, '0.0.0.0');
  });
}

// ================= Graceful shutdown =================
let server;
function shutdown() {
  console.log('🔻 Shutting down server...');
  if (server) {
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.log('✅ Closed DB connection');
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ================= Start server =================
async function start() {
  const PORT = process.env.PORT || 5000;

  if (!(await isPortAvailable(PORT))) {
    console.error(`❌ Port ${PORT} already in use`);
    process.exit(1);
  }

  const dbOK = await connectDB();
  const routesOK = setupRoutes();
  if (!dbOK || !routesOK) setupFallback();

  app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  });

  app.use('*', (req, res) => {
    res.status(404).json({ message: 'Route not found', path: req.originalUrl });
  });

  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
