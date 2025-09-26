const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم المنتج مطلوب'],
    trim: true,
    maxlength: [200, 'اسم المنتج يجب أن يكون أقل من 200 حرف']
  },
  description: {
    type: String,
    required: [true, 'وصف المنتج مطلوب'],
    trim: true,
    minlength: [10, 'وصف المنتج يجب أن يكون 10 أحرف على الأقل'],
    maxlength: [2000, 'وصف المنتج يجب أن يكون أقل من 2000 حرف']
  },
  shortDescription: {
    type: String,
    trim: true,
    maxlength: [300, 'الوصف المختصر يجب أن يكون أقل من 300 حرف']
  },
  price: {
    type: Number,
    required: [true, 'سعر المنتج مطلوب'],
    min: [0, 'السعر يجب أن يكون أكبر من أو يساوي صفر']
  },
  originalPrice: {
    type: Number,
    min: [0, 'السعر الأصلي يجب أن يكون أكبر من أو يساوي صفر']
  },
  category: {
    type: String,
    required: [true, 'فئة المنتج مطلوبة'],
    enum: [
      'ملابس أطفال', 'ألعاب', 'مستلزمات الأم', 'مستلزمات الطفل',
      'كتب تعليمية', 'أغذية أطفال', 'عناية شخصية', 'أثاث أطفال',
      'إكسسوارات', 'هدايا', 'عام'
    ],
    default: 'عام'
  },
  subcategory: {
    type: String,
    trim: true
  },
  brand: {
    type: String,
    trim: true,
    maxlength: [100, 'اسم العلامة التجارية يجب أن يكون أقل من 100 حرف']
  },
  sku: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true
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
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  inStock: {
    type: Boolean,
    default: true
  },
  stockQuantity: {
    type: Number,
    default: 0,
    min: [0, 'كمية المخزون يجب أن تكون أكبر من أو تساوي صفر']
  },
  lowStockThreshold: {
    type: Number,
    default: 5,
    min: [0, 'حد التنبيه للمخزون يجب أن يكون أكبر من أو يساوي صفر']
  },
  weight: {
    type: Number,
    min: [0, 'الوزن يجب أن يكون أكبر من أو يساوي صفر']
  },
  dimensions: {
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    unit: { type: String, enum: ['cm', 'mm', 'm'], default: 'cm' }
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'الوسم يجب أن يكون أقل من 30 حرف']
  }],
  featured: {
    type: Boolean,
    default: false
  },
  onSale: {
    type: Boolean,
    default: false
  },
  saleStartDate: Date,
  saleEndDate: Date,
  views: {
    type: Number,
    default: 0,
    min: 0
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0, min: 0 }
  },
  reviews: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false }
  }],
  shipping: {
    free: { type: Boolean, default: false },
    cost: { type: Number, default: 0, min: 0 },
    estimatedDays: { type: Number, default: 3, min: 1 },
    restrictions: [String]
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft', 'archived'],
    default: 'active'
  },
  approved: {
    type: Boolean,
    default: false
  },
  ageRange: {
    min: { type: Number, min: 0 },
    max: { type: Number, min: 0 },
    unit: { type: String, enum: ['months', 'years'], default: 'years' }
  },
  material: String,
  color: [String],
  size: [String],
  variants: [{
    name: String,
    values: [String],
    price: Number,
    sku: String,
    stock: Number
  }]
}, {
  timestamps: true
});

// Indexes for better performance
ProductSchema.index({ category: 1, status: 1, approved: 1 });
ProductSchema.index({ seller: 1 });
ProductSchema.index({ featured: 1, status: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ views: -1 });
ProductSchema.index({ 'rating.average': -1 });
ProductSchema.index({ 'seo.slug': 1 });
ProductSchema.index({ sku: 1 });
ProductSchema.index({ 
  name: 'text', 
  description: 'text', 
  shortDescription: 'text',
  tags: 'text',
  brand: 'text'
}, {
  weights: {
    name: 10,
    shortDescription: 5,
    tags: 3,
    brand: 2,
    description: 1
  }
});

// Pre-save middleware
ProductSchema.pre('save', function(next) {
  // Generate SKU if not provided
  if (!this.sku && this.isNew) {
    this.sku = this.generateSKU();
  }
  
  // Generate SEO slug if not provided
  if (!this.seo.slug && this.name) {
    this.seo.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, '') // Keep Arabic, English, numbers, spaces, hyphens
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  
  // Generate short description if not provided
  if (!this.shortDescription && this.description) {
    this.shortDescription = this.description.substring(0, 200).trim() + '...';
  }
  
  // Update stock status
  this.inStock = this.stockQuantity > 0;
  
  // Check if on sale
  if (this.originalPrice && this.price < this.originalPrice) {
    this.onSale = true;
  }
  
  // Validate sale dates
  if (this.saleStartDate && this.saleEndDate && this.saleStartDate >= this.saleEndDate) {
    const error = new Error('تاريخ انتهاء التخفيض يجب أن يكون بعد تاريخ البداية');
    return next(error);
  }
  
  next();
});

// Method to generate SKU
ProductSchema.methods.generateSKU = function() {
  const categoryCode = this.category.substring(0, 3).toUpperCase();
  const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${categoryCode}-${randomCode}`;
};

// Virtual for discount percentage
ProductSchema.virtual('discountPercentage').get(function() {
  if (this.originalPrice && this.price < this.originalPrice) {
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }
  return 0;
});

// Virtual for formatted price
ProductSchema.virtual('formattedPrice').get(function() {
  return `${this.price.toLocaleString()} دج`;
});

// Virtual for stock status
ProductSchema.virtual('stockStatus').get(function() {
  if (this.stockQuantity === 0) return 'نفدت الكمية';
  if (this.stockQuantity <= this.lowStockThreshold) return 'كمية قليلة';
  return 'متوفر';
});

// Virtual for average rating text
ProductSchema.virtual('ratingText').get(function() {
  if (this.rating.count === 0) return 'لا توجد تقييمات';
  return `${this.rating.average.toFixed(1)} (${this.rating.count} تقييم)`;
});

// Method to check if product is on sale
ProductSchema.methods.isCurrentlyOnSale = function() {
  if (!this.onSale) return false;
  
  const now = new Date();
  if (this.saleStartDate && now < this.saleStartDate) return false;
  if (this.saleEndDate && now > this.saleEndDate) return false;
  
  return true;
};

// Method to get current price (considering sales)
ProductSchema.methods.getCurrentPrice = function() {
  return this.isCurrentlyOnSale() ? this.price : (this.originalPrice || this.price);
};

// Method to check if low stock
ProductSchema.methods.isLowStock = function() {
  return this.stockQuantity <= this.lowStockThreshold && this.stockQuantity > 0;
};

// Method to add review
ProductSchema.methods.addReview = function(userId, rating, comment = '') {
  // Check if user already reviewed
  const existingReview = this.reviews.find(r => r.user.toString() === userId.toString());
  if (existingReview) {
    throw new Error('لقد قمت بتقييم هذا المنتج مسبقاً');
  }
  
  this.reviews.push({
    user: userId,
    rating,
    comment: comment.trim()
  });
  
  this.updateRating();
};

// Method to update rating
ProductSchema.methods.updateRating = function() {
  if (this.reviews.length === 0) {
    this.rating.average = 0;
    this.rating.count = 0;
    return;
  }
  
  const sum = this.reviews.reduce((total, review) => total + review.rating, 0);
  this.rating.average = sum / this.reviews.length;
  this.rating.count = this.reviews.length;
};

// Method to toggle like
ProductSchema.methods.toggleLike = function(userId) {
  const index = this.likes.indexOf(userId);
  if (index > -1) {
    this.likes.splice(index, 1);
    return false; // unliked
  } else {
    this.likes.push(userId);
    return true; // liked
  }
};

// Method to reduce stock
ProductSchema.methods.reduceStock = function(quantity) {
  if (this.stockQuantity < quantity) {
    throw new Error('الكمية المطلوبة غير متوفرة');
  }
  
  this.stockQuantity -= quantity;
  this.inStock = this.stockQuantity > 0;
};

// Method to increase stock
ProductSchema.methods.increaseStock = function(quantity) {
  this.stockQuantity += quantity;
  this.inStock = true;
};

// Static method to get featured products
ProductSchema.statics.getFeatured = function(limit = 8) {
  return this.find({ 
    featured: true, 
    status: 'active', 
    approved: true,
    inStock: true 
  })
  .populate('seller', 'name')
  .sort({ createdAt: -1 })
  .limit(limit);
};

// Static method to get on sale products
ProductSchema.statics.getOnSale = function(limit = 12) {
  return this.find({ 
    onSale: true, 
    status: 'active', 
    approved: true,
    inStock: true 
  })
  .populate('seller', 'name')
  .sort({ createdAt: -1 })
  .limit(limit);
};

// Static method to search products
ProductSchema.statics.search = function(query, options = {}) {
  const {
    category,
    minPrice,
    maxPrice,
    inStock = true,
    onSale,
    limit = 20,
    skip = 0,
    sortBy = 'relevance'
  } = options;

  let searchQuery = {
    $text: { $search: query },
    status: 'active',
    approved: true
  };

  if (category) searchQuery.category = category;
  if (inStock) searchQuery.inStock = true;
  if (onSale) searchQuery.onSale = true;
  if (minPrice !== undefined || maxPrice !== undefined) {
    searchQuery.price = {};
    if (minPrice !== undefined) searchQuery.price.$gte = minPrice;
    if (maxPrice !== undefined) searchQuery.price.$lte = maxPrice;
  }

  let sort = {};
  switch (sortBy) {
    case 'price_low':
      sort = { price: 1 };
      break;
    case 'price_high':
      sort = { price: -1 };
      break;
    case 'newest':
      sort = { createdAt: -1 };
      break;
    case 'popular':
      sort = { views: -1 };
      break;
    case 'rating':
      sort = { 'rating.average': -1 };
      break;
    default: // relevance
      sort = { score: { $meta: 'textScore' } };
  }

  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .populate('seller', 'name')
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

// Static method to get related products
ProductSchema.statics.getRelated = function(productId, category, limit = 4) {
  return this.find({
    _id: { $ne: productId },
    category,
    status: 'active',
    approved: true,
    inStock: true
  })
  .populate('seller', 'name')
  .sort({ views: -1, createdAt: -1 })
  .limit(limit);
};

// Ensure virtual fields are serialized
ProductSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Product', ProductSchema);
