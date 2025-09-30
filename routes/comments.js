// ==========================================
// routes/comments.js
// ==========================================
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { auth, optionalAuth } = require('../middleware/auth');

// GET comments for a post
router.get('/:postId', optionalAuth, async (req, res) => {
  try {
    const Comment = mongoose.model('Comment');
    const comments = await Comment.find({ post: req.params.postId })
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      comments
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب التعليقات', error: error.message });
  }
});

// CREATE comment
router.post('/', auth, async (req, res) => {
  try {
    const Comment = mongoose.model('Comment');
    const Post = mongoose.model('Post');
    const { content, postId, parentCommentId } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'محتوى التعليق مطلوب' });
    }

    if (!postId) {
      return res.status(400).json({ success: false, message: 'معرف المنشور مطلوب' });
    }

    const comment = new Comment({
      content: content.trim(),
      author: req.user._id,
      post: postId,
      parentComment: parentCommentId || null
    });

    await comment.save();
    await comment.populate('author', 'name avatar');

    // Update post comment count
    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

    res.status(201).json({
      success: true,
      message: 'تم إضافة التعليق بنجاح',
      comment
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في إضافة التعليق', error: error.message });
  }
});

// DELETE comment
router.delete('/:id', auth, async (req, res) => {
  try {
    const Comment = mongoose.model('Comment');
    const Post = mongoose.model('Post');
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ success: false, message: 'التعليق غير موجود' });
    }

    // Check if user owns the comment or is admin
    if (comment.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية لحذف هذا التعليق' });
    }

    await Comment.findByIdAndDelete(req.params.id);

    // Update post comment count
    await Post.findByIdAndUpdate(comment.post, { $inc: { commentsCount: -1 } });

    res.json({ success: true, message: 'تم حذف التعليق بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في حذف التعليق', error: error.message });
  }
});

module.exports = router;
