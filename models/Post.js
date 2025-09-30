const PostSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'محتوى المنشور مطلوب'],
    trim: true,
    maxlength: [5000, 'المحتوى لا يمكن أن يتجاوز 5000 حرف']
  },
  images: [{
    type: String
  }],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'مؤلف المنشور مطلوب']
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  commentsCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

PostSchema.index({ author: 1 });
PostSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Post', PostSchema);

// ==========================================
// models/Comment.js
// ==========================================
const CommentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'محتوى التعليق مطلوب'],
    trim: true,
    maxlength: [1000, 'التعليق لا يمكن أن يتجاوز 1000 حرف']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'مؤلف التعليق مطلوب']
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: [true, 'المنشور مطلوب']
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

CommentSchema.index({ post: 1 });
CommentSchema.index({ author: 1 });
CommentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Comment', CommentSchema);
