const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'محتوى التعليق مطلوب'],
    trim: true,
    minlength: [1, 'التعليق يجب أن يحتوي على حرف واحد على الأقل'],
    maxlength: [1000, 'التعليق يجب أن يكون أقل من 1000 حرف']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetType: {
    type: String,
    required: true,
    enum: ['Article', 'Post', 'Product']
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'targetType'
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  approved: {
    type: Boolean,
    default: true
  },
  reported: {
    type: Boolean,
    default: false
  },
  reportCount: {
    type: Number,
    default: 0,
    min: 0
  },
  reportReasons: [{
    type: String,
    enum: ['spam', 'inappropriate', 'offensive', 'fake', 'other']
  }],
  edited: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    content: String,
    editedAt: { type: Date, default: Date.now },
    reason: String
  }],
  metadata: {
    ipAddress: String,
    userAgent: String,
    source: {
      type: String,
      enum: ['web', 'mobile', 'api'],
      default: 'web'
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
CommentSchema.index({ targetType: 1, targetId: 1, approved: 1 });
CommentSchema.index({ author: 1 });
CommentSchema.index({ parentComment: 1 });
CommentSchema.index({ createdAt: -1 });
CommentSchema.index({ approved: 1, reported: 1 });

// Validate that parentComment belongs to the same target
CommentSchema.pre('validate', async function(next) {
  if (this.parentComment) {
    try {
      const parentComment = await this.constructor.findById(this.parentComment);
      if (!parentComment) {
        throw new Error('التعليق الأصلي غير موجود');
      }
      if (parentComment.targetType !== this.targetType || 
          parentComment.targetId.toString() !== this.targetId.toString()) {
        throw new Error('التعليق الأصلي لا ينتمي لنفس المنشور');
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Post-save middleware to update parent comment replies
CommentSchema.post('save', async function(doc) {
  if (doc.parentComment) {
    try {
      await this.constructor.findByIdAndUpdate(
        doc.parentComment,
        { $addToSet: { replies: doc._id } }
      );
    } catch (error) {
      console.error('Error updating parent comment replies:', error);
    }
  }
});

// Pre-remove middleware to clean up references
CommentSchema.pre('remove', async function(next) {
  try {
    // Remove this comment from parent's replies array
    if (this.parentComment) {
      await this.constructor.findByIdAndUpdate(
        this.parentComment,
        { $pull: { replies: this._id } }
      );
    }
    
    // Remove all replies to this comment
    if (this.replies && this.replies.length > 0) {
      await this.constructor.deleteMany({ _id: { $in: this.replies } });
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Virtual for reply count
CommentSchema.virtual('replyCount').get(function() {
  return this.replies ? this.replies.length : 0;
});

// Virtual for like count
CommentSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Virtual for formatted date
CommentSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('ar-DZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for time since creation
CommentSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  if (hours < 24) return `منذ ${hours} ساعة`;
  if (days < 30) return `منذ ${days} يوم`;
  
  return this.formattedDate;
});

// Method to check if user can edit this comment
CommentSchema.methods.canEdit = function(userId, userRole) {
  // Admin can edit any comment
  if (userRole === 'admin') return true;
  
  // Author can edit their own comment within 24 hours
  if (this.author.toString() === userId.toString()) {
    const hoursSinceCreation = (new Date() - this.createdAt) / (1000 * 60 * 60);
    return hoursSinceCreation < 24;
  }
  
  return false;
};

// Method to check if user can delete this comment
CommentSchema.methods.canDelete = function(userId, userRole) {
  // Admin can delete any comment
  if (userRole === 'admin') return true;
  
  // Author can delete their own comment
  return this.author.toString() === userId.toString();
};

// Method to toggle like
CommentSchema.methods.toggleLike = function(userId) {
  const index = this.likes.indexOf(userId);
  if (index > -1) {
    this.likes.splice(index, 1);
    return false; // unliked
  } else {
    this.likes.push(userId);
    return true; // liked
  }
};

// Method to add report
CommentSchema.methods.addReport = function(reason = 'other') {
  if (!this.reportReasons.includes(reason)) {
    this.reportReasons.push(reason);
  }
  this.reportCount += 1;
  
  // Auto-hide if too many reports
  if (this.reportCount >= 5) {
    this.approved = false;
    this.reported = true;
  }
};

// Method to edit comment content
CommentSchema.methods.editContent = function(newContent, reason = '') {
  // Save edit history
  this.editHistory.push({
    content: this.content,
    reason: reason
  });
  
  this.content = newContent;
  this.edited = true;
};

// Static method to get comments for target
CommentSchema.statics.getForTarget = function(targetType, targetId, options = {}) {
  const {
    includeReplies = true,
    sortBy = 'newest',
    limit = 20,
    skip = 0,
    approved = true
  } = options;

  let query = {
    targetType,
    targetId,
    approved
  };

  // Only get top-level comments if not including replies
  if (!includeReplies) {
    query.parentComment = null;
  }

  let sort = {};
  switch (sortBy) {
    case 'oldest':
      sort = { createdAt: 1 };
      break;
    case 'popular':
      sort = { 'likes.length': -1, createdAt: -1 };
      break;
    default: // newest
      sort = { createdAt: -1 };
  }

  return this.find(query)
    .populate('author', 'name avatar')
    .populate({
      path: 'replies',
      populate: {
        path: 'author',
        select: 'name avatar'
      }
    })
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

// Static method to get user's comments
CommentSchema.statics.getByUser = function(userId, options = {}) {
  const {
    limit = 20,
    skip = 0,
    approved = true
  } = options;

  return this.find({ 
    author: userId, 
    approved 
  })
  .populate('author', 'name avatar')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit);
};

// Static method to get pending comments (for moderation)
CommentSchema.statics.getPending = function(options = {}) {
  const {
    limit = 50,
    skip = 0
  } = options;

  return this.find({ 
    approved: false,
    reported: { $ne: true }
  })
  .populate('author', 'name avatar email')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit);
};

// Static method to get reported comments
CommentSchema.statics.getReported = function(options = {}) {
  const {
    limit = 50,
    skip = 0
  } = options;

  return this.find({ 
    reported: true 
  })
  .populate('author', 'name avatar email')
  .sort({ reportCount: -1, createdAt: -1 })
  .skip(skip)
  .limit(limit);
};

// Ensure virtual fields are serialized
CommentSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Comment', CommentSchema);
