const express = require('express');

const router = express.Router();

// Import models only if they exist
let Comment;
try {
  Comment = require('../models/Comment');
} catch (error) {
  console.log('Comment model not found, using fallback');
}

// Import middleware only if it exists
let auth, adminAuth, optionalAuth;
try {
  const authMiddleware = require('../middleware/auth');
  auth = authMiddleware.auth;
  adminAuth = authMiddleware.adminAuth;
  optionalAuth = authMiddleware.optionalAuth;
} catch (error) {
  console.log('Auth middleware not found, using fallback');
  auth = (req, res, next) => {
    req.user = { _id: 'test-user', isAdmin: false };
    next();
  };
  adminAuth = (req, res, next) => {
    req.user = { _id: 'test-admin', isAdmin: true };
    next();
  };
  optionalAuth = (req, res, next) => {
    req.user = null;
    next();
  };
}

// Sample comments for fallback
const sampleComments = [
  {
    _id: '1',
    content: 'مقال رائع ومفيد جداً، شكراً لك على هذه المعلومات القيمة!',
    author: {
      _id: 'user1',
      name: 'أم محمد',
      avatar: null
    },
    targetType: 'Article',
    targetId: '1',
    approved: true,
    likes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: '2',
    content: 'هل يمكن إضافة المزيد من التفاصيل حول هذا الموضوع؟',
    author: {
      _id: 'user2',
      name: 'أم أحمد',
      avatar: null
    },
    targetType: 'Article',
    targetId: '1',
    approved: true,
    likes: [],
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  }
];

// Get comments for a specific target (article, post, product)
router.get('/:targetType/:targetId', optionalAuth, async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!Comment) {
      // Fallback with sample data
      const filteredComments = sampleComments.filter(comment => 
        comment.targetType === targetType && comment.targetId === targetId
      );
      const paginatedComments = filteredComments.slice(skip, skip + limit);

      return res.json({
        comments: paginatedComments,
        pagination: {
          current: page,
          pages: Math.ceil(filteredComments.length / limit),
          total: filteredComments.length
        }
      });
    }

    const query = {
      targetType,
      targetId,
      approved: true
    };

    const comments = await Comment.find(query)
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments(query);

    res.json({
      comments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'خطأ في جلب التعليقات' });
  }
});

// Get single comment
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    if (!Comment) {
      // Fallback with sample data
      const comment = sampleComments.find(c => c._id === req.params.id);
      if (!comment) {
        return res.status(404).json({ message: 'التعليق غير موجود' });
      }
      return res.json(comment);
    }

    const comment = await Comment.findById(req.params.id)
      .populate('author', 'name avatar');
    
    if (!comment) {
      return res.status(404).json({ message: 'التعليق غير موجود' });
    }

    res.json(comment);
  } catch (error) {
    console.error('Get comment error:', error);
    res.status(500).json({ message: 'خطأ في جلب التعليق' });
  }
});

// Create new comment
router.post('/:targetType/:targetId', auth, async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'محتوى التعليق مطلوب' });
    }

    if (!Comment) {
      return res.status(503).json({ message: 'خدمة التعليقات غير متاحة حالياً' });
    }

    // Validate targetType
    const validTargetTypes = ['Article', 'Post', 'Product'];
    if (!validTargetTypes.includes(targetType)) {
      return res.status(400).json({ message: 'نوع الهدف غير صحيح' });
    }

    const comment = new Comment({
      content: content.trim(),
      author: req.user._id,
      targetType,
      targetId,
      approved: true // Auto-approve comments for now
    });

    await comment.save();
    await comment.populate('author', 'name avatar');

    res.status(201).json({
      message: 'تم إضافة التعليق بنجاح',
      comment
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ message: 'خطأ في إضافة التعليق' });
  }
});

// Update comment
router.put('/:id', auth, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'محتوى التعليق مطلوب' });
    }

    if (!Comment) {
      return res.status(503).json({ message: 'خدمة التعليقات غير متاحة حالياً' });
    }

    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ message: 'التعليق غير موجود' });
    }

    // Check if user owns the comment or is admin
    if (comment.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'غير مسموح لك بتعديل هذا التعليق' });
    }

    comment.content = content.trim();
    comment.updatedAt = new Date();
    
    await comment.save();
    await comment.populate('author', 'name avatar');

    res.json({
      message: 'تم تحديث التعليق بنجاح',
      comment
    });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ message: 'خطأ في تحديث التعليق' });
  }
});

// Delete comment
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!Comment) {
      return res.status(503).json({ message: 'خدمة التعليقات غير متاحة حالياً' });
    }

    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ message: 'التعليق غير موجود' });
    }

    // Check if user owns the comment or is admin
    if (comment.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'غير مسموح لك بحذف هذا التعليق' });
    }

    await Comment.findByIdAndDelete(req.params.id);

    res.json({ 
      message: 'تم حذف التعليق بنجاح'
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'خطأ في حذف التعليق' });
  }
});

// Like/Unlike comment
router.post('/:id/like', auth, async (req, res) => {
  try {
    if (!Comment) {
      return res.status(503).json({ message: 'خدمة التعليقات غير متاحة حالياً' });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'التعليق غير موجود' });
    }

    const userIndex = comment.likes.indexOf(req.user._id);
    
    if (userIndex > -1) {
      // Unlike
      comment.likes.splice(userIndex, 1);
    } else {
      // Like
      comment.likes.push(req.user._id);
    }

    await comment.save();

    res.json({
      message: userIndex > -1 ? 'تم إلغاء الإعجاب' : 'تم الإعجاب بالتعليق',
      likesCount: comment.likes.length,
      isLiked: userIndex === -1
    });
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({ message: 'خطأ في الإعجاب بالتعليق' });
  }
});

// Get user's comments
router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!Comment) {
      return res.json({
        comments: [],
        pagination: { current: 1, pages: 0, total: 0 }
      });
    }

    const query = {
      author: req.params.userId,
      approved: true
    };

    const comments = await Comment.find(query)
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments(query);

    res.json({
      comments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get user comments error:', error);
    res.status(500).json({ message: 'خطأ في جلب تعليقات المستخدم' });
  }
});

// Admin: Toggle comment approval
router.patch('/:id/approve', adminAuth, async (req, res) => {
  try {
    if (!Comment) {
      return res.status(503).json({ message: 'خدمة التعليقات غير متاحة حالياً' });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'التعليق غير موجود' });
    }

    comment.approved = !comment.approved;
    await comment.save();

    res.json({
      message: comment.approved ? 'تم الموافقة على التعليق' : 'تم رفض التعليق',
      approved: comment.approved
    });
  } catch (error) {
    console.error('Toggle comment approval error:', error);
    res.status(500).json({ message: 'خطأ في تغيير حالة الموافقة' });
  }
});

// Admin: Get pending comments
router.get('/admin/pending', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!Comment) {
      return res.json({
        comments: [],
        pagination: { current: 1, pages: 0, total: 0 }
      });
    }

    const query = { approved: false };

    const comments = await Comment.find(query)
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments(query);

    res.json({
      comments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get pending comments error:', error);
    res.status(500).json({ message: 'خطأ في جلب التعليقات المعلقة' });
  }
});

module.exports = router;
