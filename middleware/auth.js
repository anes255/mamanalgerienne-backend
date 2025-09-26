const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'maman-algerienne-secret-key-2024';

// Middleware to verify JWT token
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        message: 'لا يوجد رمز مصادقة، الوصول مرفوض',
        code: 'NO_TOKEN'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ 
        message: 'رمز المصادقة غير صالح',
        code: 'INVALID_TOKEN'
      });
    }

    // Check if user account is active
    if (user.status !== 'active') {
      return res.status(403).json({ 
        message: 'تم تعليق هذا الحساب',
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'رمز المصادقة غير صالح',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'انتهت صلاحية رمز المصادقة',
        code: 'TOKEN_EXPIRED'
      });
    }

    res.status(500).json({ 
      message: 'خطأ في التحقق من المصادقة',
      code: 'AUTH_ERROR'
    });
  }
};

// Optional auth middleware (doesn't require token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      // No token provided, continue without user
      req.user = null;
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (user && user.status === 'active') {
      req.user = user;
    } else {
      req.user = null;
    }

    next();

  } catch (error) {
    // If token verification fails, continue without user
    req.user = null;
    next();
  }
};

// Admin auth middleware
const adminAuth = async (req, res, next) => {
  try {
    // First run the regular auth middleware
    await new Promise((resolve, reject) => {
      auth(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        message: 'هذا الإجراء مخصص للمديرين فقط',
        code: 'ADMIN_REQUIRED'
      });
    }

    next();

  } catch (error) {
    // If auth middleware failed, pass the error through
    if (error.status) {
      return res.status(error.status).json(error.body);
    }
    
    res.status(500).json({ 
      message: 'خطأ في التحقق من صلاحيات الإدارة',
      code: 'ADMIN_AUTH_ERROR'
    });
  }
};

// Middleware to check if user owns resource or is admin
const ownerOrAdmin = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      // First run auth middleware
      await new Promise((resolve, reject) => {
        auth(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const resourceOwnerId = getResourceOwnerId(req);
      const userId = req.user._id.toString();

      // Allow if user is admin or owns the resource
      if (req.user.isAdmin || resourceOwnerId === userId) {
        return next();
      }

      res.status(403).json({ 
        message: 'ليس لديك صلاحية للوصول لهذا المورد',
        code: 'ACCESS_DENIED'
      });

    } catch (error) {
      res.status(500).json({ 
        message: 'خطأ في التحقق من الصلاحيات',
        code: 'PERMISSION_ERROR'
      });
    }
  };
};

// Rate limiting middleware (simple implementation)
const rateLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    for (const [ip, timestamps] of requests.entries()) {
      requests.set(ip, timestamps.filter(time => time > windowStart));
      if (requests.get(ip).length === 0) {
        requests.delete(ip);
      }
    }

    // Check current client
    if (!requests.has(clientIP)) {
      requests.set(clientIP, []);
    }

    const clientRequests = requests.get(clientIP);
    clientRequests.push(now);

    if (clientRequests.length > maxRequests) {
      return res.status(429).json({
        message: 'تم تجاوز الحد المسموح من الطلبات، يرجى المحاولة لاحقاً',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    next();
  };
};

// Validation middleware
const validateUserInput = (validationRules) => {
  return (req, res, next) => {
    const errors = [];

    for (const rule of validationRules) {
      const { field, required, type, minLength, maxLength, pattern } = rule;
      const value = req.body[field];

      if (required && (!value || value.toString().trim() === '')) {
        errors.push(`${field} مطلوب`);
        continue;
      }

      if (value) {
        if (type === 'email' && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(value)) {
          errors.push(`${field} يجب أن يكون بريد إلكتروني صحيح`);
        }

        if (type === 'phone' && !/^[0-9]{10}$/.test(value.replace(/\s/g, ''))) {
          errors.push(`${field} يجب أن يكون رقم هاتف صحيح`);
        }

        if (minLength && value.length < minLength) {
          errors.push(`${field} يجب أن يكون ${minLength} أحرف على الأقل`);
        }

        if (maxLength && value.length > maxLength) {
          errors.push(`${field} يجب أن يكون ${maxLength} حرف على الأكثر`);
        }

        if (pattern && !pattern.test(value)) {
          errors.push(`${field} غير صحيح`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: 'خطأ في التحقق من البيانات',
        errors,
        code: 'VALIDATION_ERROR'
      });
    }

    next();
  };
};

module.exports = {
  auth,
  optionalAuth,
  adminAuth,
  ownerOrAdmin,
  rateLimiter,
  validateUserInput
};
