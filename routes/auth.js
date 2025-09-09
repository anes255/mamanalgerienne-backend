const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Import the existing User model

const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'mama_algerienne_secret_key_2024';

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Auth routes working',
    timestamp: new Date().toISOString(),
    userModel: !!User
  });
});

// Create admin user
router.get('/create-admin', async (req, res) => {
  try {
    const existingAdmin = await User.findOne({ email: 'mamanalgeriennepartenariat@gmail.com' });
    if (existingAdmin) {
      if (!existingAdmin.isAdmin) {
        existingAdmin.isAdmin = true;
        await existingAdmin.save();
      }
      
      return res.json({ 
        message: 'المدير موجود بالفعل',
        credentials: {
          email: 'mamanalgeriennepartenariat@gmail.com',
          password: 'anesaya75'
        },
        isAdmin: existingAdmin.isAdmin
      });
    }

    const admin = new User({
      name: 'مدير الموقع',
      email: 'mamanalgeriennepartenariat@gmail.com',
      phone: '0555123456',
      password: 'anesaya75',
      isAdmin: true
    });

    await admin.save();

    res.json({ 
      message: 'تم إنشاء حساب المدير بنجاح',
      credentials: {
        email: 'mamanalgeriennepartenariat@gmail.com',
        password: 'anesaya75'
      },
      isAdmin: admin.isAdmin
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ message: 'خطأ في إنشاء حساب المدير', error: error.message });
  }
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { phone }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'المستخدم موجود بالفعل' });
    }

    const user = new User({ 
      name: name.trim(), 
      email: email.toLowerCase().trim(), 
      phone: phone.trim(), 
      password 
    });
    
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ message: 'البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل' });
    }
    
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    // Update last login
    await user.updateLastLogin();

    console.log('User login successful:', { email: user.email, isAdmin: user.isAdmin });

    res.json({
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
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'لا يوجد رمز مصادقة' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'رمز المصادقة غير صالح' });
    }

    res.json({
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
    res.status(401).json({ message: 'رمز المصادقة غير صالح' });
  }
});

module.exports = router;