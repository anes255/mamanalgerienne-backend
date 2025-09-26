const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'عنوان المقال مطلوب'],
    trim: true,
    maxlength: [200, 'عنوان المقال يجب أن يكون أقل من 200 حرف']
  },
  content: {
    type: String,
    required: [true, 'محتوى المقال مطلوب'],
    minlength: [100, 'محتوى المقال يجب أن يكون 100 حرف على الأقل']
  },
  excerpt: {
    type: String,
    maxlength: [300, 'ملخص المقال يجب أن يكون أقل من 300 حرف'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'قسم المقال مطلوب'],
    enum: [
      'حملي', 'طفلي', 'بيتي', 'كوزينتي', 'مدرستي', 
      'تحويستي', 'صحتي', 'ديني', 'الاسماء', 'عام'
    ],
    default: 'عام'
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  images: [{
    type: String, // Filename of uploaded images
    validate: {
      validator: function(v) {
        return /\.(jpg|jpeg|png|gif|webp)$/i.test(v);
      },
      message: 'صيغة الصورة غير مدعومة'
    }
  }],
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'الوسم يجب أن يكون أقل من 30 حرف']
  }],
  featured: {
    type: Boolean,
    default: false
  },
  published: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0,
    min: 0
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  readingTime: {
    type: Number, // in minutes
    default: 0
  },
  seo: {
    metaDescription: {
      type: String,
      maxlength: [160, 'وصف الميتا يجب أن يكون أقل من 160 حرف']
    },
    metaKeywords: [{
      type: String,
      maxlength: [50, 'كلمة مفتاحية يجب أن تكون أقل من 50 حرف']
    }],
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true
    }
  },
  comments: {
    enabled: {
      type: Boolean,
      default: true
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published'
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
ArticleSchema.index({ category: 1, published: 1 });
ArticleSchema.index({ author: 1 });
ArticleSchema.index({ featured: 1, published: 1 });
ArticleSchema.index({ createdAt: -1 });
ArticleSchema.index({ views: -1 });
ArticleSchema.index({ 'seo.slug': 1 });
ArticleSchema.index({ 
  title: 'text', 
  content: 'text', 
  excerpt: 'text',
  tags: 'text'
}, {
  weights: {
    title: 10,
    excerpt: 5,
    tags: 3,
    content: 1
  }
});

// Pre-save middleware
ArticleSchema.pre('save', function(next) {
  // Update lastModified
  this.lastModified = new Date();
  
  // Generate excerpt if not provided
  if (!this.excerpt && this.content) {
    this.excerpt = this.content.substring(0, 200).trim() + '...';
  }
  
  // Calculate reading time (average 200 words per minute)
  if (this.content) {
    const wordCount = this.content.split(/\s+/).length;
    this.readingTime = Math.ceil(wordCount / 200);
  }
  
  // Generate SEO slug if not provided
  if (!this.seo.slug && this.title) {
    this.seo.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, '') // Keep Arabic, English, numbers, spaces, hyphens
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  
  next();
});

// Virtual for article URL
ArticleSchema.virtual('url').get(function() {
  return `/articles/${this._id}`;
});

// Virtual for SEO URL
ArticleSchema.virtual('seoUrl').get(function() {
  return this.seo.slug ? `/articles/${this.seo.slug}` : this.url;
});

// Virtual for formatted publish date
ArticleSchema.virtual('formattedDate').get(function() {
  return this.publishedAt.toLocaleDateString('ar-DZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Method to get related articles
ArticleSchema.methods.getRelatedArticles = async function(limit = 5) {
  return await this.constructor.find({
    _id: { $ne: this._id },
    category: this.category,
    published: true,
    status: 'published'
  })
  .sort({ views: -1, createdAt: -1 })
  .limit(limit)
  .populate('author', 'name avatar');
};

// Method to toggle like
ArticleSchema.methods.toggleLike = function(userId) {
  const index = this.likes.indexOf(userId);
  if (index > -1) {
    this.likes.splice(index, 1);
    return false; // unliked
  } else {
    this.likes.push(userId);
    return true; // liked
  }
};

// Static method to get popular articles
ArticleSchema.statics.getPopular = function(limit = 10) {
  return this.find({ 
    published: true, 
    status: 'published' 
  })
  .sort({ views: -1, likes: -1 })
  .limit(limit)
  .populate('author', 'name avatar');
};

// Static method to get featured articles
ArticleSchema.statics.getFeatured = function(limit = 6) {
  return this.find({ 
    featured: true, 
    published: true, 
    status: 'published' 
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('author', 'name avatar');
};

// Static method to search articles
ArticleSchema.statics.search = function(query, options = {}) {
  const {
    category,
    tags,
    author,
    limit = 20,
    skip = 0,
    sortBy = 'relevance'
  } = options;

  let searchQuery = {
    $text: { $search: query },
    published: true,
    status: 'published'
  };

  if (category) searchQuery.category = category;
  if (tags && tags.length > 0) searchQuery.tags = { $in: tags };
  if (author) searchQuery.author = author;

  let sort = {};
  switch (sortBy) {
    case 'date':
      sort = { createdAt: -1 };
      break;
    case 'views':
      sort = { views: -1 };
      break;
    case 'likes':
      sort = { 'likes.length': -1 };
      break;
    default: // relevance
      sort = { score: { $meta: 'textScore' } };
  }

  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('author', 'name avatar');
};

// Ensure virtual fields are serialized
ArticleSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Article', ArticleSchema);
