const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'mama_algerienne_secret_key_2024';

// Middleware to verify JWT token
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'لا يوجد رمز مصادقة، الوصول مرفوض' });
    }

    // Handle legacy test token from fallback mode
    if (token === 'test-admin-token') {
      // Create a mock user for the test token
      req.user = {
        _id: '1',
        id: '1',
        name: 'مدير الموقع',
        email: 'mamanalgeriennepartenariat@gmail.com',
        isAdmin: true,
        isActive: true
      };
      return next();
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'رمز المصادقة غير صالح' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'الحساب غير مفعل' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'رمز المصادقة غير صالح - يرجى تسجيل الدخول مرة أخرى',
        code: 'TOKEN_INVALID'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'انتهت صلاحية رمز المصادقة - يرجى تسجيل الدخول مرة أخرى',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    res.status(401).json({ message: 'رمز المصادقة غير صالح' });
  }
};

// Middleware to check if user is admin
const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'لا يوجد رمز مصادقة، الوصول مرفوض' });
    }

    // Handle legacy test token from fallback mode
    if (token === 'test-admin-token') {
      // Create a mock admin user for the test token
      req.user = {
        _id: '1',
        id: '1',
        name: 'مدير الموقع',
        email: 'mamanalgeriennepartenariat@gmail.com',
        isAdmin: true,
        isActive: true
      };
      return next();
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'رمز المصادقة غير صالح' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'الحساب غير مفعل' });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ message: 'الوصول مرفوض، يجب أن تكون مدير' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'رمز المصادقة غير صالح - يرجى تسجيل الدخول مرة أخرى',
        code: 'TOKEN_INVALID'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'انتهت صلاحية رمز المصادقة - يرجى تسجيل الدخول مرة أخرى',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    res.status(401).json({ message: 'فشل في التحقق من صلاحية المدير' });
  }
};

// Optional auth - doesn't require token but adds user info if present
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      // Handle legacy test token
      if (token === 'test-admin-token') {
        req.user = {
          _id: '1',
          id: '1',
          name: 'مدير الموقع',
          email: 'mamanalgeriennepartenariat@gmail.com',
          isAdmin: true,
          isActive: true
        };
        return next();
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        if (user && user.isActive) {
          req.user = user;
        }
      } catch (error) {
        // Continue without user info if token is invalid
        console.log('Optional auth token invalid, continuing without user');
      }
    }
    
    next();
  } catch (error) {
    // Continue without user info if there's any error
    next();
  }
};

module.exports = { auth, adminAuth, optionalAuth, JWT_SECRET };