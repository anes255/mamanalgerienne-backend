const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  excerpt: {
    type: String,
    required: true,
    maxlength: 200
  },
  category: {
    type: String,
    required: true,
    enum: ['حملي', 'طفلي', 'بيتي', 'كوزينتي', 'مدرستي', 'تحويستي', 'صحتي', 'ديني', 'الاسماء']
  },
  images: [{
    type: String
  }],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  featured: {
    type: Boolean,
    default: false
  },
  published: {
    type: Boolean,
    default: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  }
}, {
  timestamps: true
});

// Index for better search performance
ArticleSchema.index({ title: 'text', content: 'text', tags: 'text' });
ArticleSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model('Article', ArticleSchema);