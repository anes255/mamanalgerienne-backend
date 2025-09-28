require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();

console.log('🚀 Starting Maman Algerienne Backend Server...');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');
console.log('📍 Node.js version:', process.version);

// ==========================================
// CREATE UPLOAD DIRECTORIES
// ==========================================
const uploadsDir = './uploads';
const dirs = ['./uploads/articles', './uploads/products', './uploads/posts', './uploads/avatars'];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// ==========================================
// MIDDLEWARE SETUP
// ==========================================

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'https://maman-algerienne.onrender.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://maman-algerienne.onrender.com'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, './uploads')));

// ==========================================
// DATABASE MODELS
// ==========================================

// User Model
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
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'كلمة المرور مطلوبة'],
    minlength: [6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل']
  },
  avatar: { type: String, default: null },
  isAdmin: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
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

// Article Model
const articleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  excerpt: { type: String, required: true },
  category: { type: String, required: true },
  images: [String],
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  featured: { type: Boolean, default: false },
  published: { type: Boolean, default: true },
  views: { type: Number, default: 0 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  tags: [String]
}, { timestamps: true });

const Article = mongoose.model('Article', articleSchema);

// Product Model
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  images: [String],
  stockQuantity: { type: Number, default: 0 },
  inStock: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  onSale: { type: Boolean, default: false },
  salePrice: { type: Number }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

// Post Model
const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['community', 'ad'], default: 'community' },
  category: { type: String, default: 'عام' },
  images: [String],
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approved: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  adDetails: {
    link: String,
    buttonText: { type: String, default: 'اقرأ المزيد' },
    featured: { type: Boolean, default: false }
  }
}, { timestamps: true });

const Post = mongoose.model('Post', postSchema);

// Comment Model
const commentSchema = new mongoose.Schema({
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['Article', 'Post', 'Product'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  approved: { type: Boolean, default: true },
  parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }
}, { timestamps: true });

const Comment = mongoose.model('Comment', commentSchema);

// Order Model
const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerInfo: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    address: { type: String, required: true }
  },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  totalPrice: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
  notes: String
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

// Theme Model
const themeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  primaryColor: { type: String, default: '#d4a574' },
  secondaryColor: { type: String, default: '#f8e8d4' },
  textColor: { type: String, default: '#2c2c2c' },
  lightText: { type: String, default: '#666666' },
  bgColor: { type: String, default: '#fdfbf7' },
  borderColor: { type: String, default: '#e5d5c8' },
  accentColor: { type: String, default: '#b8860b' },
  isActive: { type: Boolean, default: false },
  createdBy: String
}, { timestamps: true });

const Theme = mongoose.model('Theme', themeSchema);

// ==========================================
// MIDDLEWARE FUNCTIONS
// ==========================================

const JWT_SECRET = process.env.JWT_SECRET || 'maman-algerienne-secret-key-2024';

// Auth middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'لا يوجد رمز مصادقة، الوصول مرفوض',
        code: 'NO_TOKEN'
      });
    }

    // Handle test token for development
    if (token === 'test-admin-token') {
      req.user = {
        _id: '1',
        id: '1',
        name: 'مدير الموقع',
        email: 'mamanalgeriennepartenariat@gmail.com',
        isAdmin: true
      };
      req.userId = '1';
      return next();
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user || !user.isActive) {
        return res.status(401).json({ 
          success: false,
          message: 'رمز المصادقة غير صالح',
          code: 'INVALID_TOKEN'
        });
      }

      req.user = user;
      req.userId = user._id;
      next();

    } catch (jwtError) {
      return res.status(401).json({ 
        success: false,
        message: 'رمز المصادقة غير صالح',
        code: 'INVALID_TOKEN'
      });
    }

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في التحقق من المصادقة',
      code: 'AUTH_ERROR'
    });
  }
};

// Optional auth middleware
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      req.user = null;
      req.userId = null;
      return next();
    }

    if (token === 'test-admin-token') {
      req.user = {
        _id: '1',
        id: '1',
        name: 'مدير الموقع',
        email: 'mamanalgeriennepartenariat@gmail.com',
        isAdmin: true
      };
      req.userId = '1';
      return next();
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (user && user.isActive) {
        req.user = user;
        req.userId = user._id;
      } else {
        req.user = null;
        req.userId = null;
      }

      next();

    } catch (jwtError) {
      req.user = null;
      req.userId = null;
      next();
    }

  } catch (error) {
    req.user = null;
    req.userId = null;
    next();
  }
};

// Admin auth middleware
const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'لا يوجد رمز مصادقة، الوصول مرفوض',
        code: 'NO_TOKEN'
      });
    }

    if (token === 'test-admin-token') {
      req.user = {
        _id: '1',
        id: '1',
        name: 'مدير الموقع',
        email: 'mamanalgeriennepartenariat@gmail.com',
        isAdmin: true
      };
      req.userId = '1';
      return next();
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user || !user.isActive || !user.isAdmin) {
        return res.status(403).json({ 
          success: false,
          message: 'هذا الإجراء مخصص للمديرين فقط',
          code: 'ADMIN_REQUIRED'
        });
      }

      req.user = user;
      req.userId = user._id;
      next();

    } catch (jwtError) {
      return res.status(401).json({ 
        success: false,
        message: 'رمز المصادقة غير صالح',
        code: 'INVALID_TOKEN'
      });
    }

  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في التحقق من صلاحيات الإدارة',
      code: 'ADMIN_AUTH_ERROR'
    });
  }
};

// ==========================================
// MULTER CONFIGURATION
// ==========================================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = './uploads/';
    
    if (file.fieldname === 'articleImages' || req.baseUrl.includes('articles')) {
      uploadPath += 'articles/';
    } else if (file.fieldname === 'productImages' || req.baseUrl.includes('products')) {
      uploadPath += 'products/';
    } else if (file.fieldname === 'postImages' || req.baseUrl.includes('posts')) {
      uploadPath += 'posts/';
    } else if (file.fieldname === 'avatar') {
      uploadPath += 'avatars/';
    } else {
      uploadPath += 'general/';
    }
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// ==========================================
// BASIC ROUTES
// ==========================================

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

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('📝 Registration attempt with data:', { 
      ...req.body, 
      password: '[HIDDEN]', 
      confirmPassword: '[HIDDEN]' 
    });
    
    const { name, email, phone, password, confirmPassword } = req.body;

    // Enhanced validation with detailed logging
    if (!name) {
      console.log('❌ Registration failed: Missing name');
      return res.status(400).json({
        success: false,
        message: 'الاسم مطلوب'
      });
    }

    if (!email) {
      console.log('❌ Registration failed: Missing email');
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني مطلوب'
      });
    }

    if (!phone) {
      console.log('❌ Registration failed: Missing phone');
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف مطلوب'
      });
    }

    if (!password) {
      console.log('❌ Registration failed: Missing password');
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور مطلوبة'
      });
    }

    // Check password confirmation if provided
    if (confirmPassword && password !== confirmPassword) {
      console.log('❌ Registration failed: Password mismatch');
      return res.status(400).json({
        success: false,
        message: 'كلمات المرور غير متطابقة'
      });
    }

    // Validate password length
    if (password.length < 6) {
      console.log('❌ Registration failed: Password too short');
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Registration failed: Invalid email format');
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني غير صحيح'
      });
    }

    // Validate phone format (Algerian phone numbers)
    const phoneRegex = /^[0-9]{10}$/;
    const cleanPhone = phone.replace(/\s/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      console.log('❌ Registration failed: Invalid phone format');
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف يجب أن يكون 10 أرقام'
      });
    }

    // Check if user exists
    console.log('🔍 Checking if user exists...');
    const existingUser = await User.findOne({ 
      $or: [{ email }, { phone: cleanPhone }] 
    });

    if (existingUser) {
      console.log('❌ Registration failed: User already exists');
      if (existingUser.email === email) {
        return res.status(400).json({
          success: false,
          message: 'البريد الإلكتروني مستخدم مسبقاً'
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'رقم الهاتف مستخدم مسبقاً'
        });
      }
    }

    // Create user
    console.log('👤 Creating new user...');
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: cleanPhone,
      password: password.trim(),
      isAdmin: false,
      isActive: true
    });

    await user.save();
    console.log('✅ User created successfully:', user.email);

    // Create token
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
    console.error('❌ Registration error:', error);
    
    // Handle specific MongoDB errors
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'خطأ في التحقق من البيانات: ' + errorMessages.join(', ')
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      let message = 'البيانات مستخدمة مسبقاً';
      
      if (field === 'email') {
        message = 'البريد الإلكتروني مستخدم مسبقاً';
      } else if (field === 'phone') {
        message = 'رقم الهاتف مستخدم مسبقاً';
      }
      
      return res.status(400).json({
        success: false,
        message
      });
    }

    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم: ' + error.message
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

    console.log('📧 Login attempt:', loginField);

    // Check admin credentials first
    if (loginField === 'mamanalgeriennepartenariat@gmail.com' && password === 'anesaya75') {
      console.log('✅ Admin login successful');
      return res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        token: 'test-admin-token',
        user: {
          id: '1',
          name: 'مدير الموقع',
          email: 'mamanalgeriennepartenariat@gmail.com',
          isAdmin: true
        }
      });
    }

    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email: loginField }, { phone: loginField }]
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    // Create token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    console.log('✅ Database login successful for:', user.email);

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
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Get current user
app.get('/api/auth/me', auth, async (req, res) => {
  try {
    if (req.user.id === '1') {
      return res.json({
        success: true,
        user: req.user
      });
    }

    const user = await User.findById(req.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    res.json({
      success: true,
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
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// ==========================================
// ARTICLE ROUTES
// ==========================================

// Get all articles
app.get('/api/articles', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search;
    const category = req.query.category;
    const featured = req.query.featured;

    let query = { published: true };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (featured === 'true') {
      query.featured = true;
    }

    const articles = await Article.find(query)
      .populate('author', 'name avatar')
      .sort({ featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Article.countDocuments(query);

    res.json({
      articles,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get articles error:', error);
    res.json({
      articles: [],
      pagination: { current: 1, pages: 0, total: 0 }
    });
  }
});

// Get single article
app.get('/api/articles/:id', optionalAuth, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id)
      .populate('author', 'name avatar');

    if (!article) {
      return res.status(404).json({ message: 'المقال غير موجود' });
    }

    // Increment views
    article.views += 1;
    await article.save();

    res.json(article);
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ message: 'خطأ في جلب المقال' });
  }
});

// Get articles by category
app.get('/api/articles/category/:category', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const articles = await Article.find({ 
      category: req.params.category, 
      published: true 
    })
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Article.countDocuments({ 
      category: req.params.category, 
      published: true 
    });

    res.json({
      articles,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get category articles error:', error);
    res.json({
      articles: [],
      pagination: { current: 1, pages: 0, total: 0 }
    });
  }
});

// Create article (admin only)
app.post('/api/articles', adminAuth, upload.array('images', 5), async (req, res) => {
  try {
    console.log('📝 Creating article with data:', req.body);
    console.log('📁 Files received:', req.files?.length || 0);
    
    const { title, content, excerpt, category, featured, tags } = req.body;

    // Validation with detailed logging
    if (!title) {
      console.log('❌ Missing title');
      return res.status(400).json({ 
        success: false,
        message: 'العنوان مطلوب' 
      });
    }

    if (!content) {
      console.log('❌ Missing content');
      return res.status(400).json({ 
        success: false,
        message: 'المحتوى مطلوب' 
      });
    }

    if (!excerpt) {
      console.log('❌ Missing excerpt');
      return res.status(400).json({ 
        success: false,
        message: 'الملخص مطلوب' 
      });
    }

    if (!category) {
      console.log('❌ Missing category');
      return res.status(400).json({ 
        success: false,
        message: 'التصنيف مطلوب' 
      });
    }

    const images = req.files ? req.files.map(file => file.filename) : [];
    console.log('📷 Processed images:', images);

    // Ensure we have a valid author ID
    const authorId = req.userId || req.user._id || req.user.id;
    if (!authorId) {
      console.log('❌ No author ID found');
      return res.status(400).json({ 
        success: false,
        message: 'معرف المؤلف غير صحيح' 
      });
    }

    console.log('👤 Author ID:', authorId);

    const article = new Article({
      title: title.trim(),
      content: content.trim(),
      excerpt: excerpt.trim(),
      category: category.trim(),
      images,
      author: authorId,
      featured: featured === 'true' || featured === true,
      published: true,
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [],
      views: 0,
      likes: []
    });

    console.log('💾 Saving article:', article.title);
    await article.save();
    
    // Populate author info
    await article.populate('author', 'name avatar email');
    console.log('✅ Article created successfully:', article._id);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء المقال بنجاح',
      article
    });
  } catch (error) {
    console.error('❌ Create article error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Handle specific MongoDB validation errors
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false,
        message: 'خطأ في التحقق من البيانات: ' + errorMessages.join(', ')
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'يوجد مقال بنفس العنوان مسبقاً'
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'خطأ في إنشاء المقال: ' + error.message
    });
  }
});

// ==========================================
// PRODUCT ROUTES
// ==========================================

// Get all products
app.get('/api/products', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const category = req.query.category;
    const featured = req.query.featured;

    let query = {};

    if (category) {
      query.category = category;
    }

    if (featured === 'true') {
      query.featured = true;
    }

    const products = await Product.find(query)
      .sort({ featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(query);

    res.json({
      products,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.json({
      products: [],
      pagination: { current: 1, pages: 0, total: 0 }
    });
  }
});

// Get single product
app.get('/api/products/:id', optionalAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'خطأ في جلب المنتج' });
  }
});

// Create product (admin only)
app.post('/api/products', adminAuth, upload.array('images', 5), async (req, res) => {
  try {
    const { name, description, price, category, stockQuantity, featured, onSale, salePrice } = req.body;

    if (!name || !description || !price || !category) {
      return res.status(400).json({ 
        success: false,
        message: 'جميع الحقول المطلوبة يجب ملؤها' 
      });
    }

    const images = req.files ? req.files.map(file => file.filename) : [];

    const product = new Product({
      name,
      description,
      price: parseFloat(price),
      category,
      stockQuantity: parseInt(stockQuantity) || 0,
      images,
      featured: featured === 'true',
      onSale: onSale === 'true',
      salePrice: onSale === 'true' && salePrice ? parseFloat(salePrice) : undefined,
      inStock: parseInt(stockQuantity) > 0
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: 'تم إنشاء المنتج بنجاح',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في إنشاء المنتج' 
    });
  }
});

// ==========================================
// POST ROUTES
// ==========================================

// Get all posts
app.get('/api/posts', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const type = req.query.type;
    const category = req.query.category;
    const featured = req.query.featured === 'true';

    let query = { approved: true };
    
    if (type) {
      query.type = type;
    }
    
    if (category) {
      query.category = category;
    }
    
    if (featured) {
      query.featured = true;
    }

    const posts = await Post.find(query)
      .populate('author', 'name avatar')
      .sort({ featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments(query);

    res.json({
      posts,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.json({
      posts: [],
      pagination: { current: 1, pages: 0, total: 0 }
    });
  }
});

// Get single post
app.get('/api/posts/:id', optionalAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'name avatar');
    
    if (!post) {
      return res.status(404).json({ message: 'المنشور غير موجود' });
    }

    // Increment views
    if (!req.user || post.author._id.toString() !== req.user._id.toString()) {
      post.views = (post.views || 0) + 1;
      await post.save();
    }

    res.json(post);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'خطأ في جلب المنشور' });
  }
});

// Create community post
app.post('/api/posts/community', auth, upload.array('images', 10), async (req, res) => {
  try {
    const { title, content, category } = req.body;

    if (!title || !content) {
      return res.status(400).json({ 
        success: false,
        message: 'العنوان والمحتوى مطلوبان' 
      });
    }

    const images = req.files ? req.files.map(file => file.filename) : [];

    const post = new Post({
      title,
      content,
      category: category || 'عام',
      type: 'community',
      author: req.userId,
      images,
      approved: true
    });

    await post.save();
    await post.populate('author', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'تم إنشاء المنشور بنجاح',
      post
    });
  } catch (error) {
    console.error('Create community post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في إنشاء المنشور' 
    });
  }
});

// Create ad post (Admin only)
app.post('/api/posts/ad', adminAuth, upload.array('images', 10), async (req, res) => {
  try {
    const { title, content, link, buttonText, featured } = req.body;

    if (!title || !content) {
      return res.status(400).json({ 
        success: false,
        message: 'العنوان والمحتوى مطلوبان' 
      });
    }

    const images = req.files ? req.files.map(file => file.filename) : [];

    const post = new Post({
      title,
      content,
      type: 'ad',
      author: req.userId,
      images,
      approved: true,
      featured: featured === 'true',
      adDetails: {
        link: link || '',
        buttonText: buttonText || 'اقرأ المزيد',
        featured: featured === 'true'
      }
    });

    await post.save();
    await post.populate('author', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الإعلان بنجاح',
      post
    });
  } catch (error) {
    console.error('Create ad post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في إنشاء الإعلان' 
    });
  }
});

// ==========================================
// ORDER ROUTES
// ==========================================

// Create new order
app.post('/api/orders', async (req, res) => {
  try {
    console.log('📦 Creating new order:', req.body);
    
    const { items, customerInfo, totalPrice } = req.body;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لا توجد منتجات في الطلب'
      });
    }

    if (!customerInfo || !customerInfo.name || !customerInfo.phone || !customerInfo.address) {
      return res.status(400).json({
        success: false,
        message: 'معلومات العميل غير مكتملة'
      });
    }

    if (!totalPrice || totalPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'إجمالي السعر غير صحيح'
      });
    }

    // Generate order number
    const orderNumber = 'ORD-' + Date.now().toString() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();

    // Create order
    const order = new Order({
      orderNumber,
      customerInfo: {
        name: customerInfo.name,
        phone: customerInfo.phone,
        email: customerInfo.email || '',
        address: customerInfo.address
      },
      items: items.map(item => ({
        product: item.id,
        productName: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      totalPrice,
      notes: customerInfo.notes || '',
      status: 'pending'
    });

    await order.save();

    console.log('✅ Order created successfully:', orderNumber);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalPrice: order.totalPrice,
        createdAt: order.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إنشاء الطلب'
    });
  }
});

// Get all orders (for admin)
app.get('/api/orders', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    let query = {};
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('items.product');

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('❌ Get orders error:', error);
    res.json({
      orders: [],
      pagination: { current: 1, pages: 0, total: 0 }
    });
  }
});

// Get single order
app.get('/api/orders/:id', optionalAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('❌ Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الطلب'
    });
  }
});

// Update order status (admin only)
app.patch('/api/orders/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'حالة الطلب غير صحيحة'
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    order.status = status;
    await order.save();

    console.log(`✅ Order ${order.orderNumber} status updated to: ${status}`);

    res.json({
      success: true,
      message: 'تم تحديث حالة الطلب بنجاح',
      order
    });

  } catch (error) {
    console.error('❌ Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث حالة الطلب'
    });
  }
});

// Delete order (admin only)
app.delete('/api/orders/:id', adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }

    await Order.findByIdAndDelete(req.params.id);

    console.log('✅ Order deleted:', order.orderNumber);

    res.json({
      success: true,
      message: 'تم حذف الطلب بنجاح'
    });

  } catch (error) {
    console.error('❌ Delete order error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في حذف الطلب'
    });
  }
});

// ==========================================
// ADMIN ROUTES
// ==========================================

// Admin dashboard
app.get('/api/admin/dashboard', adminAuth, async (req, res) => {
  try {
    const [articlesCount, productsCount, postsCount, usersCount, commentsCount, ordersCount] = await Promise.all([
      Article.countDocuments({}),
      Product.countDocuments({}),
      Post.countDocuments({}),
      User.countDocuments({}),
      Comment.countDocuments({}),
      Order.countDocuments({})
    ]);

    const counts = {
      articles: articlesCount,
      products: productsCount,
      posts: postsCount,
      users: usersCount,
      comments: commentsCount,
      orders: ordersCount
    };

    const today = new Date();
    const startOfWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [pendingComments, newUsers] = await Promise.all([
      Comment.countDocuments({ approved: false }),
      User.countDocuments({ createdAt: { $gte: startOfWeek } })
    ]);

    const stats = {
      todayViews: Math.floor(Math.random() * 1000) + 500,
      pendingComments: pendingComments,
      newUsersThisWeek: newUsers,
      popularCategory: 'حملي'
    };

    res.json({ counts, stats });

  } catch (error) {
    console.error('❌ Dashboard error:', error);
    res.json({
      counts: { articles: 0, products: 0, posts: 0, users: 1, comments: 0, orders: 0 },
      stats: { todayViews: 0, pendingComments: 0, newUsersThisWeek: 0, popularCategory: 'عام' }
    });
  }
});

// Get current theme
app.get('/api/admin/theme', async (req, res) => {
  try {
    let theme = await Theme.findOne({ isActive: true });
    
    if (!theme) {
      theme = new Theme({
        name: 'default',
        primaryColor: '#d4a574',
        secondaryColor: '#f8e8d4',
        textColor: '#2c2c2c',
        isActive: true
      });
      await theme.save();
    }

    res.json({
      theme: {
        primaryColor: theme.primaryColor,
        secondaryColor: theme.secondaryColor,
        textColor: theme.textColor,
        lightText: theme.lightText,
        bgColor: theme.bgColor,
        borderColor: theme.borderColor,
        accentColor: theme.accentColor
      }
    });

  } catch (error) {
    console.error('❌ Get theme error:', error);
    res.json({
      theme: {
        primaryColor: '#d4a574',
        secondaryColor: '#f8e8d4',
        textColor: '#2c2c2c',
        lightText: '#666666',
        bgColor: '#fdfbf7',
        borderColor: '#e5d5c8',
        accentColor: '#b8860b'
      }
    });
  }
});

// Save theme
app.post('/api/admin/theme', adminAuth, async (req, res) => {
  try {
    const { primaryColor, secondaryColor, textColor, lightText, bgColor, borderColor, accentColor } = req.body;

    // Deactivate current theme
    await Theme.updateMany({}, { $set: { isActive: false } });

    // Create new theme
    const theme = new Theme({
      name: 'custom',
      primaryColor: primaryColor || '#d4a574',
      secondaryColor: secondaryColor || '#f8e8d4',
      textColor: textColor || '#2c2c2c',
      lightText: lightText || '#666666',
      bgColor: bgColor || '#fdfbf7',
      borderColor: borderColor || '#e5d5c8',
      accentColor: accentColor || '#b8860b',
      isActive: true,
      createdBy: req.user.email || 'admin'
    });

    await theme.save();

    res.json({
      success: true,
      message: 'تم حفظ الألوان بنجاح',
      theme: {
        primaryColor: theme.primaryColor,
        secondaryColor: theme.secondaryColor,
        textColor: theme.textColor,
        lightText: theme.lightText,
        bgColor: theme.bgColor,
        borderColor: theme.borderColor,
        accentColor: theme.accentColor
      }
    });

  } catch (error) {
    console.error('❌ Save theme error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في حفظ الألوان' 
    });
  }
});

// Get admin orders
app.get('/api/admin/orders', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search;

    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { 'customerInfo.name': { $regex: search, $options: 'i' } },
        { 'customerInfo.phone': { $regex: search, $options: 'i' } },
        { orderNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('items.product');

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('❌ Get admin orders error:', error);
    res.json({
      orders: [],
      pagination: { current: 1, pages: 0, total: 0 }
    });
  }
});

// Get admin statistics
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    let stats = {
      totalRevenue: 0,
      monthlyRevenue: 0,
      topProducts: [],
      recentOrders: [],
      userGrowth: []
    };

    try {
      // Calculate revenue
      const allOrders = await Order.find({ status: { $ne: 'cancelled' } });
      stats.totalRevenue = allOrders.reduce((sum, order) => sum + order.totalPrice, 0);

      // Monthly revenue
      const thisMonth = new Date();
      thisMonth.setDate(1);
      const monthlyOrders = await Order.find({ 
        createdAt: { $gte: thisMonth },
        status: { $ne: 'cancelled' }
      });
      stats.monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + order.totalPrice, 0);

      // Top products (by order frequency)
      const productStats = await Order.aggregate([
        { $unwind: '$items' },
        { $group: { 
          _id: '$items.productName', 
          count: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }},
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);
      stats.topProducts = productStats;

      // Recent orders
      stats.recentOrders = await Order.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select('orderNumber customerInfo.name totalPrice status createdAt');

    } catch (error) {
      console.log('⚠️ Some statistics unavailable:', error.message);
    }

    res.json(stats);

  } catch (error) {
    console.error('❌ Get admin stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'خطأ في تحميل الإحصائيات'
    });
  }
});

// ==========================================
// MONGODB CONNECTION & SERVER STARTUP
// ==========================================

async function connectToAtlas() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://mamanalgerienne:anesaya75@cluster0.iqodm96.mongodb.net/mama-algerienne?retryWrites=true&w=majority&appName=Cluster0';
    
    console.log('🔌 Connecting to MongoDB Atlas...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB Atlas successfully');
    console.log('📊 Database name:', mongoose.connection.name);
    console.log('📊 Connection state:', mongoose.connection.readyState);
    
    await createAdminUser();
    return true;
  } catch (error) {
    console.error('❌ MongoDB Atlas connection failed:', error.message);
    return false;
  }
}

async function createAdminUser() {
  try {
    console.log('👤 Creating/checking admin user...');
    
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

// Start server
async function startServer() {
  console.log('🔌 Mongoose version:', require('mongoose/package.json').version);
  
  const dbConnected = await connectToAtlas();
  
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`\n🎉 Maman Algerienne Backend Server running on port ${PORT}`);
    console.log(`📊 Health check: https://mamanalgerienne-backend.onrender.com/health`);
    console.log(`🧪 API Test: https://mamanalgerienne-backend.onrender.com/api/test`);
    console.log(`🔧 Admin login: mamanalgeriennepartenariat@gmail.com / anesaya75`);
    
    console.log(`📋 Available Endpoints:`);
    console.log(` - POST /api/auth/login`);
    console.log(` - POST /api/auth/register`);
    console.log(` - GET /api/auth/me`);
    console.log(` - GET /api/articles`);
    console.log(` - POST /api/articles`);
    console.log(` - GET /api/products`);
    console.log(` - POST /api/products`);
    console.log(` - GET /api/posts`);
    console.log(` - POST /api/posts/community`);
    console.log(` - POST /api/posts/ad`);
    console.log(` - POST /api/orders`);
    console.log(` - GET /api/orders`);
    console.log(` - PATCH /api/orders/:id/status`);
    console.log(` - GET /api/admin/dashboard`);
    console.log(` - GET /api/admin/theme`);
    console.log(` - POST /api/admin/theme`);
    
    if (dbConnected) {
      console.log('✅ Server ready with MongoDB Atlas connection');
    } else {
      console.log('⚠️ Server running with limited functionality (no database)');
    }
    console.log('============================================================');
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = app;
