const express = require('express');
const Comment = require('../models/Comment');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get comments for a specific target (Article, Post, or Product)
router.get('/:targetType/:targetId', optionalAuth, async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Validate targetType
    if (!['Article', 'Post', 'Product'].includes(targetType)) {
      return res.status(400).json({ message: 'نوع الهدف غير صالح' });
    }

    // Get main comments (not replies) - Remove caching by always fetching fresh
    const comments = await Comment.find({
      targetType,
      targetId,
      parentComment: null,
      approved: true
    })
      .populate('author', 'name avatar')
      .populate({
        path: 'replies',
        populate: {
          path: 'author',
          select: 'name avatar'
        },
        match: { approved: true }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({
      targetType,
      targetId,
      parentComment: null,
      approved: true
    });

    // Set no-cache headers to prevent caching issues
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

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

// Create new comment
router.post('/', auth, async (req, res) => {
  try {
    const { content, targetType, targetId, parentComment } = req.body;

    if (!content || !targetType || !targetId) {
      return res.status(400).json({ message: 'المحتوى ونوع الهدف والهدف مطلوبان' });
    }

    // Validate targetType
    if (!['Article', 'Post', 'Product'].includes(targetType)) {
      return res.status(400).json({ message: 'نوع الهدف غير صالح' });
    }

    const comment = new Comment({
      content,
      author: req.user._id,
      targetType,
      targetId,
      parentComment: parentComment || null
    });

    await comment.save();

    // If this is a reply, add it to parent's replies array
    if (parentComment) {
      await Comment.findByIdAndUpdate(
        parentComment,
        { $push: { replies: comment._id } }
      );
    }

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

    if (!content) {
      return res.status(400).json({ message: 'المحتوى مطلوب' });
    }

    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ message: 'التعليق غير موجود' });
    }

    // Check if user owns the comment
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'غير مسموح لك بتعديل هذا التعليق' });
    }

    comment.content = content;
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
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ message: 'التعليق غير موجود' });
    }

    // Check if user owns the comment or is admin
    if (comment.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'غير مسموح لك بحذف هذا التعليق' });
    }

    // If this comment has replies, delete them too
    if (comment.replies && comment.replies.length > 0) {
      await Comment.deleteMany({ _id: { $in: comment.replies } });
    }

    // If this is a reply, remove it from parent's replies array
    if (comment.parentComment) {
      await Comment.findByIdAndUpdate(
        comment.parentComment,
        { $pull: { replies: comment._id } }
      );
    }

    await Comment.findByIdAndDelete(req.params.id);

    res.json({ message: 'تم حذف التعليق بنجاح' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'خطأ في حذف التعليق' });
  }
});

// Like/Unlike comment
router.post('/:id/like', auth, async (req, res) => {
  try {
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

// Report comment
router.post('/:id/report', auth, async (req, res) => {
  try {
    const { reason, description } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'سبب البلاغ مطلوب' });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'التعليق غير موجود' });
    }

    // Check if user already reported this comment
    const existingReport = comment.reported.reasons.find(
      report => report.user.toString() === req.user._id.toString()
    );

    if (existingReport) {
      return res.status(400).json({ message: 'لقد قمت بالإبلاغ عن هذا التعليق من قبل' });
    }

    // Add report
    comment.reported.reasons.push({
      user: req.user._id,
      reason,
      description: description || ''
    });
    comment.reported.count += 1;

    await comment.save();

    res.json({ message: 'تم إرسال البلاغ بنجاح' });
  } catch (error) {
    console.error('Report comment error:', error);
    res.status(500).json({ message: 'خطأ في إرسال البلاغ' });
  }
});

// Get reported comments (Admin only)
router.get('/admin/reported', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({
      'reported.count': { $gt: 0 }
    })
      .populate('author', 'name avatar email')
      .populate('reported.reasons.user', 'name email')
      .sort({ 'reported.count': -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({
      'reported.count': { $gt: 0 }
    });

    res.json({
      comments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get reported comments error:', error);
    res.status(500).json({ message: 'خطأ في جلب التعليقات المبلغ عنها' });
  }
});

// Approve/Disapprove comment (Admin only)
router.patch('/:id/approve', adminAuth, async (req, res) => {
  try {
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
    console.error('Approve comment error:', error);
    res.status(500).json({ message: 'خطأ في الموافقة على التعليق' });
  }
});

// Get user's comments
router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({
      author: req.params.userId,
      approved: true
    })
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({
      author: req.params.userId,
      approved: true
    });

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

module.exports = router;