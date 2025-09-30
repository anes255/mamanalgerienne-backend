const mongoose = require('mongoose');

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

// Indexes
PostSchema.index({ author: 1 });
PostSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Post', PostSchema);
