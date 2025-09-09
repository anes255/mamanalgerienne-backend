const express = require('express');
const multer = require('multer');
const path = require('path');
const Product = require('../models/Product');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Multer setup for product images
const storage = multer.diskStorage({
  destination: './uploads/products/',
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Get all products
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    const category = req.query.category;
    const featured = req.query.featured;
    const onSale = req.query.onSale;
    const search = req.query.search;
    const sort = req.query.sort || '-createdAt';
    const minPrice = req.query.minPrice;
    const maxPrice = req.query.maxPrice;
    const rating = req.query.rating;
    const stock = req.query.stock;

    // Build query
    const query = {};

    if (category) {
      query.category = category;
    }

    if (featured === 'true') {
      query.featured = true;
    }

    if (onSale === 'true') {
      query.onSale = true;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    if (rating) {
      query['rating.average'] = { $gte: parseFloat(rating) };
    }

    if (stock === 'instock') {
      query.inStock = true;
      query.stockQuantity = { $gt: 0 };
    } else if (stock === 'outofstock') {
      query.$or = [
        { inStock: false },
        { stockQuantity: { $lte: 0 } }
      ];
    }

    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(query);

    res.json({
      products,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'خطأ في جلب المنتجات' });
  }
});

// Get single product
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'خطأ في جلب المنتج' });
  }
});

// Create product (admin only)
router.post('/', adminAuth, upload.array('images', 5), async (req, res) => {
  try {
    const { 
      name, description, price, category, stockQuantity, 
      featured, onSale, salePrice, tags, specifications 
    } = req.body;

    if (!name || !description || !price || !category || !stockQuantity) {
      return res.status(400).json({ message: 'جميع الحقول المطلوبة يجب ملؤها' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'يجب إضافة صورة واحدة على الأقل' });
    }

    const images = req.files.map(file => file.filename);

    const product = new Product({
      name,
      description,
      price: parseFloat(price),
      category,
      stockQuantity: parseInt(stockQuantity),
      images,
      featured: featured === 'true',
      onSale: onSale === 'true',
      salePrice: onSale === 'true' && salePrice ? parseFloat(salePrice) : undefined,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      specifications: specifications ? JSON.parse(specifications) : {},
      inStock: parseInt(stockQuantity) > 0
    });

    await product.save();

    res.status(201).json({
      message: 'تم إنشاء المنتج بنجاح',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'خطأ في إنشاء المنتج' });
  }
});

// Update product (admin only)
router.put('/:id', adminAuth, upload.array('images', 5), async (req, res) => {
  try {
    const { 
      name, description, price, category, stockQuantity, 
      featured, onSale, salePrice, tags, specifications 
    } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }

    // Update fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (price) product.price = parseFloat(price);
    if (category) product.category = category;
    if (stockQuantity !== undefined) {
      product.stockQuantity = parseInt(stockQuantity);
      product.inStock = parseInt(stockQuantity) > 0;
    }
    if (featured !== undefined) product.featured = featured === 'true';
    if (onSale !== undefined) {
      product.onSale = onSale === 'true';
      if (onSale === 'true' && salePrice) {
        product.salePrice = parseFloat(salePrice);
      } else {
        product.salePrice = undefined;
      }
    }
    if (tags) product.tags = tags.split(',').map(tag => tag.trim());
    if (specifications) product.specifications = JSON.parse(specifications);

    // Add new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => file.filename);
      product.images = [...product.images, ...newImages];
    }

    await product.save();

    res.json({
      message: 'تم تحديث المنتج بنجاح',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'خطأ في تحديث المنتج' });
  }
});

// Delete product (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({ message: 'تم حذف المنتج بنجاح' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'خطأ في حذف المنتج' });
  }
});

// Add product review
router.post('/:id/review', auth, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'التقييم يجب أن يكون بين 1 و 5' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }

    // Check if user already reviewed this product
    const existingReview = product.reviews.find(
      review => review.user.toString() === req.user._id.toString()
    );

    if (existingReview) {
      return res.status(400).json({ message: 'لقد قمت بتقييم هذا المنتج من قبل' });
    }

    // Add review
    product.reviews.push({
      user: req.user._id,
      rating,
      comment: comment || ''
    });

    // Update rating
    product.updateRating();
    await product.save();

    res.json({
      message: 'تم إضافة التقييم بنجاح',
      rating: product.rating
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({ message: 'خطأ في إضافة التقييم' });
  }
});

// Create order
router.post('/:id/order', async (req, res) => {
  try {
    const { quantity, customerInfo } = req.body;

    if (!quantity || !customerInfo) {
      return res.status(400).json({ message: 'بيانات الطلب ناقصة' });
    }

    const { name, phone, wilaya, address } = customerInfo;

    if (!name || !phone || !wilaya || !address) {
      return res.status(400).json({ message: 'جميع بيانات العميل مطلوبة' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }

    if (!product.inStock || product.stockQuantity < quantity) {
      return res.status(400).json({ message: 'المنتج غير متوفر بالكمية المطلوبة' });
    }

    // Calculate total
    const unitPrice = product.onSale && product.salePrice ? product.salePrice : product.price;
    const total = unitPrice * quantity;

    // For now, just return success (you can implement actual order storage later)
    const orderDetails = {
      product: {
        id: product._id,
        name: product.name,
        price: unitPrice
      },
      quantity,
      total,
      customerInfo
    };

    // Update stock
    product.stockQuantity -= quantity;
    if (product.stockQuantity <= 0) {
      product.inStock = false;
    }
    await product.save();

    res.json({
      message: 'تم إرسال الطلب بنجاح',
      orderDetails
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'خطأ في إنشاء الطلب' });
  }
});

module.exports = router;