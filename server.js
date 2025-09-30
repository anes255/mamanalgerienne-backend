// ==========================================
// MAMAN ALGERIENNE - COMPLETE BACKEND SERVER
// ==========================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
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
    
    if (allowedOrigins.indexOf(origin) !== -1) {
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
    
    // Create admin user after connection
    await createAdminUser();
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('⚠️  Server will run without database (limited functionality)');
    dbConnected = false;
  }
}

// ==========================================
// USER MODEL
// ==========================================
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'الاسم مطلوب'],
    trim: true,
    minlength: [2, 'الاسم يجب أن يكون حرفان على الأقل']
  },
  email: {
    type: String,
    required: [true, 'البريد الإلكتروني مطلوب'],
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'رقم الهاتف مطلوب'],
    trim: true
  },
  password: {
    type: String,
    required: [true, 'كلمة المرور مطلوبة'],
    minlength: [6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل']
  },
  avatar: { type: String, default: null },
  isAdmin: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active'
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model('User', userSchema);

// ==========================================
// CREATE ADMIN USER
// ==========================================
async function createAdminUser() {
  try {
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
      console.log('🆔 ID:', admin._id);
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
    console.error('❌ Error creating admin user:', error.message);
  }
}

// ==========================================
// AUTH MIDDLEWARE
// ==========================================
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'لا يوجد رمز مصادقة، الوصول مرفوض'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'رمز المصادقة غير صالح'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ 
        success: false,
        message: 'تم تعليق هذا الحساب'
      });
    }

    req.user = user;
    req.userId = user._id;
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      success: false,
      message: 'رمز المصادقة غير صالح'
    });
  }
};

// Admin middleware
const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'لا يوجد رمز مصادقة'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isAdmin) {
      return res.status(403).json({ 
        success: false,
        message: 'هذا الإجراء مخصص للمديرين فقط'
      });
    }

    req.user = user;
    req.userId = user._id;
    next();

  } catch (error) {
    res.status(401).json({ 
      success: false,
      message: 'رمز المصادقة غير صالح'
    });
  }
};

// ==========================================
// MULTER CONFIGURATION
// ==========================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = './uploads/';
    
    if (req.path.includes('article')) {
      uploadPath = './uploads/articles/';
    } else if (req.path.includes('product')) {
      uploadPath = './uploads/products/';
    } else if (req.path.includes('post')) {
      uploadPath = './uploads/posts/';
    } else if (req.path.includes('avatar')) {
      uploadPath = './uploads/avatars/';
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('فقط ملفات الصور مسموح بها!'), false);
    }
  }
});

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
  res.json({ message: 'API is working' });
});

// ==========================================
// ROUTES - AUTHENTICATION
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'كلمات المرور غير متطابقة'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
      });
    }

    const existingUser = await User.findOne({ 
      $or: [{ email }, { phone }] 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'المستخدم موجود مسبقاً'
      });
    }

    const user = new User({ name, email, phone, password });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        avatar: user.avatar
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const loginField = email || username;

    if (!loginField || !password) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
      });
    }

    const user = await User.findOne({
      $or: [{ email: loginField }, { phone: loginField }]
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        avatar: user.avatar
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Get current user
app.get('/api/auth/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        isAdmin: req.user.isAdmin,
        avatar: req.user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// ==========================================
// ROUTES - IMPORT FROM EXTERNAL FILES
// ==========================================
try {
  // Import route modules if they exist
  const articlesRouter = require('./routes/articles');
  const postsRouter = require('./routes/posts');
  const productsRouter = require('./routes/products');
  const commentsRouter = require('./routes/comments');
  const ordersRouter = require('./routes/Orders');
  const adminRouter = require('./routes/admin');
  
  app.use('/api/articles', articlesRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/comments', commentsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/admin', adminRouter);
  
  console.log('✅ All routes loaded successfully');
} catch (error) {
  console.log('⚠️  Using inline routes (external route files not found)');
}

// ==========================================
// BASIC INLINE ROUTES (FALLBACK)
// ==========================================

// Articles
app.get('/api/articles', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json({ articles: [], pagination: { current: 1, pages: 0, total: 0 } });
    }
    
    const Article = mongoose.model('Article', new mongoose.Schema({
      title: String,
      content: String,
      excerpt: String,
      category: String,
      images: [String],
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      published: { type: Boolean, default: true },
      featured: { type: Boolean, default: false },
      views: { type: Number, default: 0 }
    }, { timestamps: true }));
    
    const articles = await Article.find({ published: true })
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({ articles, pagination: { current: 1, pages: 1, total: articles.length } });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في جلب المقالات' });
  }
});

// Products
app.get('/api/products', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json({ products: [], pagination: { current: 1, pages: 0, total: 0 } });
    }
    
    const Product = mongoose.model('Product', new mongoose.Schema({
      name: String,
      description: String,
      price: Number,
      images: [String],
      category: String,
      inStock: { type: Boolean, default: true }
    }, { timestamps: true }));
    
    const products = await Product.find({ inStock: true })
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({ products, pagination: { current: 1, pages: 1, total: products.length } });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في جلب المنتجات' });
  }
});

// Posts
app.get('/api/posts', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json({ posts: [], pagination: { current: 1, pages: 0, total: 0 } });
    }
    
    const Post = mongoose.model('Post', new mongoose.Schema({
      content: String,
      images: [String],
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }, { timestamps: true }));
    
    const posts = await Post.find()
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({ posts, pagination: { current: 1, pages: 1, total: posts.length } });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في جلب المنشورات' });
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
async function startServer() {
  await connectDatabase();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('✅ SERVER IS RUNNING');
    console.log('✅ Server listening on port:', PORT);
    console.log('✅ Server URL:', `http://localhost:${PORT}`);
    console.log('✅ Health check:', `http://localhost:${PORT}/health`);
    console.log('✅ Database status:', dbConnected ? 'Connected' : 'Running without DB');
    console.log('==========================================');
  });
}

startServer();
