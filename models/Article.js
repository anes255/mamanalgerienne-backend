const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'العنوان مطلوب'],
    trim: true,
    maxlength: [200, 'العنوان لا يمكن أن يتجاوز 200 حرف']
  },
  category: {
    type: String,
    required: [true, 'التصنيف مطلوب'],
    enum: ['حملي', 'طفلي', 'بيتي', 'كوزينتي', 'مدرستي', 'تحويستي', 'صحتي', 'ديني', 'الاسماء'],
    default: 'حملي'
  },
  excerpt: {
    type: String,
    required: [true, 'المقتطف مطلوب'],
    trim: true,
    maxlength: [500, 'المقتطف لا يمكن أن يتجاوز 500 حرف']
  },
  content: {
    type: String,
    required: [true, 'المحتوى مطلوب']
  },
  images: [{
    type: String
  }],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'مؤلف المقال مطلوب']
  },
  published: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tags: [{
    type: String,
    trim: true
  }],
  slug: {
    type: String,
    unique: true,
    sparse: true
  },
  metaDescription: {
    type: String,
    maxlength: [160, 'وصف الميتا لا يمكن أن يتجاوز 160 حرف']
  },
  readTime: {
    type: Number,
    default: 5
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create slug from title before saving
ArticleSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim() + '-' + Date.now();
  }
  
  if (this.isModified('content')) {
    const wordCount = this.content.split(/\s+/).length;
    this.readTime = Math.max(1, Math.ceil(wordCount / 200));
  }
  
  next();
});

// Indexes
ArticleSchema.index({ title: 'text', content: 'text', excerpt: 'text' });
ArticleSchema.index({ category: 1 });
ArticleSchema.index({ published: 1 });
ArticleSchema.index({ featured: 1 });
ArticleSchema.index({ createdAt: -1 });
ArticleSchema.index({ slug: 1 });
ArticleSchema.index({ author: 1 });
ArticleSchema.index({ views: -1 });

// Virtual for likes count
ArticleSchema.virtual('likesCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Check if user liked the article
ArticleSchema.methods.isLikedBy = function(userId) {
  if (!userId) return false;
  return this.likes.some(like => like.toString() === userId.toString());
};

module.exports = mongoose.model('Article', ArticleSchema);
