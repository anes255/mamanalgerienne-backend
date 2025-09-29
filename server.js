require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Create directories
['./uploads/articles', './uploads/products', './uploads/posts', './uploads/avatars'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// CORS
app.use(cors({ origin: '*', credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, './uploads')));

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'OK', dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected', timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API working', dbConnected: mongoose.connection.readyState === 1, database: mongoose.connection.name || 'not connected' });
});

let routesLoaded = false;

// Connect to MongoDB
async function connectDB() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority&appName=Cluster0';
    
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000, socketTimeoutMS: 45000 });
    
    console.log('✅ MongoDB connected!');
    console.log('📊 Database:', mongoose.connection.name);
    
    await createAdmin();
    loadRoutes();
    return true;
  } catch (error) {
    console.error('❌ MongoDB failed:', error.message);
    setupFallback();
    return false;
  }
}

// Create admin
async function createAdmin() {
  try {
    const User = require('./models/User');
    let admin = await User.findOne({ email: 'mamanalgeriennepartenariat@gmail.com' });
    
    if (!admin) {
      admin = new User({
        name: 'مدير الموقع',
        email: 'mamanalgeriennepartenariat@gmail.com',
        phone: '0555123456',
        password: 'anesaya75',
        isAdmin: true,
        status: 'active'
      });
      await admin.save();
      console.log('✅ Admin created!');
    } else {
      if (!admin.isAdmin) {
        admin.isAdmin = true;
        await admin.save();
      }
      console.log('✅ Admin exists');
    }
    console.log('🆔 Admin ID:', admin._id);
  } catch (error) {
    console.error('❌ Admin creation failed:', error.message);
  }
}

// Load routes
function loadRoutes() {
  if (routesLoaded) return;
  try {
    console.log('📋 Loading routes...');
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/articles', require('./routes/articles'));
    app.use('/api/products', require('./routes/products'));
    app.use('/api/posts', require('./routes/posts'));
    app.use('/api/comments', require('./routes/comments'));
    app.use('/api/orders', require('./routes/Orders'));
    app.use('/api/admin', require('./routes/admin'));
    routesLoaded = true;
    console.log('✅ Routes loaded');
  } catch (error) {
    console.error('❌ Routes failed:', error.message);
  }
}

// Fallback
function setupFallback() {
  console.log('⚠️ Fallback mode...');
  
  const fakeId = '507f1f77bcf86cd799439011';
  const storage = { articles: [], products: [], posts: [], orders: [] };
  
  app.post('/api/auth/login', (req, res) => {
    const { email, username, password } = req.body;
    if ((email || username) === 'mamanalgeriennepartenariat@gmail.com' && password === 'anesaya75') {
      res.json({ success: true, token: 'fallback-token', user: { _id: fakeId, id: fakeId, name: 'مدير الموقع', email: 'mamanalgeriennepartenariat@gmail.com', isAdmin: true } });
    } else {
      res.status(400).json({ success: false, message: 'بيانات خاطئة' });
    }
  });
  
  app.get('/api/auth/me', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token === 'fallback-token') {
      res.json({ success: true, user: { _id: fakeId, id: fakeId, name: 'مدير الموقع', email: 'mamanalgeriennepartenariat@gmail.com', isAdmin: true } });
    } else {
      res.status(401).json({ success: false, message: 'غير مصرح' });
    }
  });
  
  app.get('/api/articles', (req, res) => res.json({ articles: storage.articles, pagination: { current: 1, pages: 1, total: storage.articles.length } }));
  app.post('/api/articles', (req, res) => {
    const article = { _id: Date.now().toString(), ...req.body, author: { _id: fakeId, name: 'Admin' }, images: [], published: true, createdAt: new Date().toISOString(), views: 0, likes: [] };
    storage.articles.push(article);
    res.status(201).json({ message: 'تم إنشاء المقال', article });
  });
  app.delete('/api/articles/:id', (req, res) => {
    const idx = storage.articles.findIndex(a => a._id === req.params.id);
    if (idx > -1) { storage.articles.splice(idx, 1); res.json({ message: 'تم الحذف' }); } else { res.status(404).json({ message: 'غير موجود' }); }
  });
  
  app.get('/api/products', (req, res) => res.json({ products: storage.products, pagination: { current: 1, pages: 1, total: storage.products.length } }));
  app.post('/api/products', (req, res) => {
    const product = { _id: Date.now().toString(), ...req.body, seller: { _id: fakeId, name: 'Admin' }, images: [], inStock: true, createdAt: new Date().toISOString(), views: 0, likes: [] };
    storage.products.push(product);
    res.status(201).json({ message: 'تم إضافة المنتج', product });
  });
  app.delete('/api/products/:id', (req, res) => {
    const idx = storage.products.findIndex(p => p._id === req.params.id);
    if (idx > -1) { storage.products.splice(idx, 1); res.json({ message: 'تم الحذف' }); } else { res.status(404).json({ message: 'غير موجود' }); }
  });
  
  app.get('/api/posts', (req, res) => res.json({ posts: storage.posts, pagination: { current: 1, pages: 1, total: storage.posts.length } }));
  app.post('/api/posts/ad', (req, res) => {
    const post = { _id: Date.now().toString(), ...req.body, author: { _id: fakeId, name: 'Admin' }, type: 'ad', images: [], approved: true, createdAt: new Date().toISOString(), views: 0, likes: [] };
    storage.posts.push(post);
    res.status(201).json({ message: 'تم إنشاء الإعلان', post });
  });
  app.delete('/api/posts/:id', (req, res) => {
    const idx = storage.posts.findIndex(p => p._id === req.params.id);
    if (idx > -1) { storage.posts.splice(idx, 1); res.json({ message: 'تم الحذف' }); } else { res.status(404).json({ message: 'غير موجود' }); }
  });
  
  app.get('/api/orders', (req, res) => res.json({ orders: storage.orders, pagination: { current: 1, pages: 1, total: storage.orders.length } }));
  app.get('/api/comments', (req, res) => res.json({ comments: [], pagination: { current: 1, pages: 0, total: 0 } }));
  app.get('/api/admin/comments', (req, res) => res.json({ comments: [], pagination: { current: 1, pages: 0, total: 0 } }));
  
  console.log('✅ Fallback ready');
}

// Start
async function start() {
  console.log('🚀 Starting Maman Algerienne Backend\n');
  
  const dbOk = await connectDB();
  
  app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  });
  
  app.use('*', (req, res) => res.status(404).json({ message: 'Not found' }));
  
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ Server running on port ${PORT}`);
    console.log(`📊 Health: https://mamanalgerienne-backend.onrender.com/health`);
    console.log(`🔐 Login: mamanalgeriennepartenariat@gmail.com / anesaya75`);
    console.log(dbOk ? '✅ MongoDB connected' : '⚠️ Fallback mode\n');
  });
}

start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});

module.exports = app;
