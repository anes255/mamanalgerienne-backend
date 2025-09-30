const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'maman-algerienne-secret-key-2024';

// ==========================================
// AUTH MIDDLEWARE - Verify JWT Token
// ==========================================
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

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get User model
    const User = mongoose.model('User');
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'رمز المصادقة غير صالح',
        code: 'INVALID_TOKEN'
      });
    }

    // Check if user account is active
    if (user.status !== 'active') {
      return res.status(403).json({ 
        success: false,
        message: 'تم تعليق هذا الحساب',
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;
    
    console.log('✅ Auth successful for user:', user.email, 'ID:', user._id);
    
    next();

  } catch (error) {
    console.error('Auth middleware error:', error.message);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'رمز المصادقة غير صالح',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'انتهت صلاحية رمز المصادقة',
        code: 'TOKEN_EXPIRED'
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'خطأ في التحقق من المصادقة',
      code: 'AUTH_ERROR'
    });
  }
};

// ==========================================
// OPTIONAL AUTH - Don't require token
// ==========================================
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      req.user = null;
      req.userId = null;
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const User = mongoose.model('User');
    const user = await User.findById(decoded.userId).select('-password');

    if (user && user.status === 'active') {
      req.user = user;
      req.userId = user._id;
    } else {
      req.user = null;
      req.userId = null;
    }

    next();

  } catch (error) {
    // If token verification fails, continue without user
    req.user = null;
    req.userId = null;
    next();
  }
};

// ==========================================
// ADMIN AUTH - Require admin privileges
// ==========================================
const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'لا يوجد رمز مصادقة',
        code: 'NO_TOKEN'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const User = mongoose.model('User');
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'رمز المصادقة غير صالح',
        code: 'INVALID_TOKEN'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ 
        success: false,
        message: 'تم تعليق هذا الحساب',
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    // Check if user is admin
    if (!user.isAdmin) {
      return res.status(403).json({ 
        success: false,
        message: 'هذا الإجراء مخصص للمديرين فقط',
        code: 'ADMIN_REQUIRED'
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;
    
    console.log('✅ Admin auth successful for:', user.email, 'ID:', user._id);
    
    next();

  } catch (error) {
    console.error('Admin auth error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'رمز المصادقة غير صالح',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'انتهت صلاحية رمز المصادقة',
        code: 'TOKEN_EXPIRED'
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'خطأ في التحقق من صلاحيات الإدارة',
      code: 'ADMIN_AUTH_ERROR'
    });
  }
};

// ==========================================
// OWNER OR ADMIN - Check resource ownership
// ==========================================
const ownerOrAdmin = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      // First verify authentication
      const token = req.header('Authorization')?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ 
          success: false,
          message: 'لا يوجد رمز مصادقة'
        });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const User = mongoose.model('User');
      const user = await User.findById(decoded.userId).select('-password');

      if (!user) {
        return res.status(401).json({ 
          success: false,
          message: 'رمز المصادقة غير صالح'
        });
      }

      req.user = user;
      req.userId = user._id;

      const resourceOwnerId = getResourceOwnerId(req);
      const userId = user._id.toString();

      // Allow if user is admin or owns the resource
      if (user.isAdmin || resourceOwnerId === userId) {
        return next();
      }

      res.status(403).json({ 
        success: false,
        message: 'ليس لديك صلاحية للوصول لهذا المورد',
        code: 'ACCESS_DENIED'
      });

    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'خطأ في التحقق من الصلاحيات',
        code: 'PERMISSION_ERROR'
      });
    }
  };
};

// ==========================================
// RATE LIMITING
// ==========================================
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
        success: false,
        message: 'تم تجاوز الحد المسموح من الطلبات، يرجى المحاولة لاحقاً',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
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
  rateLimiter
};
