const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم المنتج مطلوب'],
    trim: true,
    maxlength: [200, 'اسم المنتج لا يمكن أن يتجاوز 200 حرف']
  },
  description: {
    type: String,
    required: [true, 'وصف المنتج مطلوب'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'السعر مطلوب'],
    min: [0, 'السعر يجب أن يكون أكبر من أو يساوي 0']
  },
  images: [{
    type: String
  }],
  category: {
    type: String,
    required: [true, 'التصنيف مطلوب']
  },
  inStock: {
    type: Boolean,
    default: true
  },
  stockQuantity: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Indexes
ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ category: 1 });
ProductSchema.index({ inStock: 1 });
ProductSchema.index({ featured: 1 });
ProductSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Product', ProductSchema);
