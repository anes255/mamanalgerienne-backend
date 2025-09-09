const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['community', 'ad'],
    default: 'community'
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  images: [{
    type: String
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  views: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }],
  // For ad posts
  adDetails: {
    link: String,
    buttonText: String,
    featured: {
      type: Boolean,
      default: false
    }
  },
  // Community post specific
  category: {
    type: String,
    enum: ['عام', 'نصائح', 'تجارب', 'أسئلة', 'مشاركات']
  },
  pinned: {
    type: Boolean,
    default: false
  },
  approved: {
    type: Boolean,
    default: function() {
      return this.type === 'ad' ? false : true; // Ad posts need approval
    }
  }
}, {
  timestamps: true
});

// Index for better performance
PostSchema.index({ type: 1, createdAt: -1 });
PostSchema.index({ author: 1 });
PostSchema.index({ approved: 1 });

module.exports = mongoose.model('Post', PostSchema);