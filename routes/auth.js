const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'maman-algerienne-secret-key-2024';

// ==========================================
// REGISTER - Create new user account
// ==========================================
router.post('/register', async (req, res) => {
  try {
    const User = mongoose.model('User');
    const { name, email, phone, password, confirmPassword } = req.body;

    console.log('📝 Registration attempt for:', email);

    // Validation
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

    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { phone }] 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'المستخدم موجود مسبقاً'
      });
    }

    // Create user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password // Will be hashed by the pre-save middleware
    });

    await user.save();
    console.log('✅ User registered:', user.email, 'ID:', user._id);

    // Create token
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

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
    console.error('❌ Register error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// ==========================================
// LOGIN - Authenticate user
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const User = mongoose.model('User');
    const { email, username, password } = req.body;
    const loginField = email || username;

    console.log('🔑 Login attempt for:', loginField);

    // Validation
    if (!loginField || !password) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
      });
    }

    // Find user by email or phone
    const user = await User.findOne({
      $or: [
        { email: loginField.toLowerCase().trim() },
        { phone: loginField.trim() }
      ]
    });

    if (!user) {
      console.log('❌ User not found');
      return res.status(400).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    console.log('✅ User found:', user.email, 'ID:', user._id);

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(403).json({
        success: false,
        message: 'تم قفل الحساب مؤقتاً بسبب محاولات تسجيل دخول فاشلة متعددة'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log('❌ Password mismatch');
      
      // Increment login attempts
      await user.incLoginAttempts();
      
      return res.status(400).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    // Check account status
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'تم تعليق هذا الحساب'
      });
    }

    console.log('✅ Password matches');

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Create token
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('✅ Login successful for:', user.email);

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
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

// ==========================================
// GET CURRENT USER
// ==========================================
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        isAdmin: req.user.isAdmin,
        avatar: req.user.avatar,
        bio: req.user.bio,
        location: req.user.location,
        stats: req.user.stats
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
// UPDATE PROFILE
// ==========================================
router.put('/profile', auth, async (req, res) => {
  try {
    const User = mongoose.model('User');
    const { name, phone, bio, location } = req.body;

    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // Update fields
    if (name) user.name = name.trim();
    if (phone) user.phone = phone.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (location !== undefined) user.location = location.trim();

    await user.save();

    res.json({
      success: true,
      message: 'تم تحديث الملف الشخصي بنجاح',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isAdmin: user.isAdmin,
        avatar: user.avatar,
        bio: user.bio,
        location: user.location
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// ==========================================
// CHANGE PASSWORD
// ==========================================
router.put('/password', auth, async (req, res) => {
  try {
    const User = mongoose.model('User');
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'كلمات المرور الجديدة غير متطابقة'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
      });
    }

    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور الحالية غير صحيحة'
      });
    }

    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

module.exports = router;
