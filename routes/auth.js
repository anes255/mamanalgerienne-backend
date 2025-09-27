const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;

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
      name,
      email,
      phone,
      password // Will be hashed by the pre-save middleware
    });

    await user.save();

    // Create token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback-secret-key',
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
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Login - FIXED VERSION
router.post('/login', async (req, res) => {
  try {
    console.log('Login request body:', req.body);
    
    // Extract email/username and password - handle both field names
    const { email, username, password } = req.body;
    const loginField = email || username;

    // Validation
    if (!loginField || !password) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
      });
    }

    console.log('Looking for user with:', loginField);

    // Find user by email or phone
    const user = await User.findOne({
      $or: [
        { email: loginField },
        { phone: loginField }
      ]
    });

    if (!user) {
      console.log('User not found');
      return res.status(400).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    console.log('User found:', user.email);

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log('Password mismatch');
      return res.status(400).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    console.log('Password matches');

    // Create token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '30d' }
    );

    console.log('Login successful for:', user.email);

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
router.get('/me', auth, async (req, res) => {
  try {
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

// Update profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone } = req.body;

    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // Update fields
    if (name) user.name = name;
    if (phone) user.phone = phone;

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
        avatar: user.avatar
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

// Change password
router.put('/password', auth, async (req, res) => {
  try {
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

    // Update password
    user.password = newPassword; // Will be hashed by pre-save middleware
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
