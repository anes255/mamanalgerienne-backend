// routes/products.js - Product Routes
// ==========================================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { adminAuth, optionalAuth } = require('../middleware/auth');

// Ensure upload directory exists
const uploadDir = './uploads/products';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    cb(mimetype && extname ? null : new Error('فقط الصور مسموح بها'), mimetype && extname);
  }
});

// GET all products
router.get('/', optionalAuth, async (req, res) => {
  try {
    const Product = mongoose.model('Product');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    const category = req.query.category;
    const search = req.query.search;
    const featured = req.query.featured;

    const query = { inStock: true };
    if (category && category !== 'all') query.category = category;
    if (featured === 'true') query.featured = true;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      products,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب المنتجات', error: error.message });
  }
});

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const Product = mongoose.model('Product');
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
    }
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في جلب المنتج', error: error.message });
  }
});

// CREATE product (admin only)
router.post('/', adminAuth, upload.array('images', 5), async (req, res) => {
  try {
    const Product = mongoose.model('Product');
    const { name, description, price, category, stockQuantity, featured, tags } = req.body;

    if (!name || !description || !price || !category) {
      return res.status(400).json({ success: false, message: 'جميع الحقول المطلوبة يجب ملؤها' });
    }

    const images = req.files ? req.files.map(file => `/uploads/products/${file.filename}`) : [];
    const tagsArray = tags ? (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags) : [];

    const product = new Product({
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      category,
      stockQuantity: parseInt(stockQuantity) || 0,
      images,
      featured: featured === 'true' || featured === true,
      tags: tagsArray,
      inStock: true
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: 'تم إنشاء المنتج بنجاح',
      product
    });
  } catch (error) {
    if (req.files) {
      req.files.forEach(file => fs.unlink(file.path, err => err && console.error('Error deleting file:', err)));
    }
    res.status(500).json({ success: false, message: 'خطأ في إنشاء المنتج', error: error.message });
  }
});

// UPDATE product (admin only)
router.put('/:id', adminAuth, upload.array('images', 5), async (req, res) => {
  try {
    const Product = mongoose.model('Product');
    const { name, description, price, category, stockQuantity, featured, tags, removeImages } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
    }

    if (name) product.name = name.trim();
    if (description) product.description = description.trim();
    if (price) product.price = parseFloat(price);
    if (category) product.category = category;
    if (stockQuantity !== undefined) product.stockQuantity = parseInt(stockQuantity);
    if (featured !== undefined) product.featured = featured === 'true' || featured === true;
    if (tags) product.tags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;

    if (removeImages) {
      const imagesToRemove = typeof removeImages === 'string' ? removeImages.split(',') : removeImages;
      product.images = product.images.filter(img => !imagesToRemove.includes(img));
    }

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => `/uploads/products/${file.filename}`);
      product.images = [...product.images, ...newImages];
    }

    await product.save();

    res.json({
      success: true,
      message: 'تم تحديث المنتج بنجاح',
      product
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في تحديث المنتج', error: error.message });
  }
});

// DELETE product (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const Product = mongoose.model('Product');
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'تم حذف المنتج بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'خطأ في حذف المنتج', error: error.message });
  }
});

module.exports = router;
