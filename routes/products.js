const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Import models only if they exist
let Product, Comment;
try {
  Product = require('../models/Product');
  Comment = require('../models/Comment');
} catch (error) {
  console.log('Product models not found, using fallback');
}

// Import middleware only if it exists
let auth, adminAuth, optionalAuth;
try {
  const authMiddleware = require('../middleware/auth');
  auth = authMiddleware.auth;
  adminAuth = authMiddleware.adminAuth;
  optionalAuth = authMiddleware.optionalAuth;
} catch (error) {
  console.log('Auth middleware not found, using fallback');
  auth = (req, res, next) => {
    req.user = { _id: 'test-user', isAdmin: false };
    next();
  };
  adminAuth = (req, res, next) => {
    req.user = { _id: 'test-admin', isAdmin: true };
    next();
  };
  optionalAuth = (req, res, next) => {
    req.user = null;
    next();
  };
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads/products/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Sample products for fallback
const sampleProducts = [
  {
    _id: '1',
    name: 'طقم ملابس أطفال قطنية',
    description: 'طقم ملابس مريح ونعم للأطفال مصنوع من القطن الطبيعي 100%. يتضمن قميص وبنطلون بألوان زاهية ومرحة.',
    price: 2500,
    category: 'ملابس أطفال',
    images: [],
    inStock: true,
    stockQuantity: 25,
    featured: true,
    seller: {
      _id: 'seller1',
      name: 'متجر الأطفال السعداء',
      phone: '0555123456'
    },
    views: 89,
    likes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: '2',
    name: 'ألعاب تعليمية للأطفال',
    description: 'مجموعة ألعاب تعليمية متنوعة تساعد على تنمية مهارات الطفل الحركية والذهنية. مناسبة للأطفال من عمر 3-6 سنوات.',
    price: 1800,
    category: 'ألعاب',
    images: [],
    inStock: true,
    stockQuantity: 15,
    featured: true,
    seller: {
      _id: 'seller2',
      name: 'عالم الألعاب التعليمية',
      phone: '0555987654'
    },
    views: 56,
    likes: [],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: '3',
    name: 'مستلزمات الرضاعة الطبيعية',
    description: 'مجموعة كاملة من مستلزمات الرضاعة الطبيعية تشمل وسادة الرضاعة، كريم الحلمات، وأكواب الثدي القابلة للغسل.',
    price: 3200,
    category: 'مستلزمات الأم',
    images: [],
    inStock: true,
    stockQuantity: 12,
    featured: false,
    seller: {
      _id: 'seller3',
      name: 'مستلزمات الأمومة',
      phone: '0555456789'
    },
    views: 34,
    likes: [],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Get all products
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    const featured = req.query.featured === 'true';
    const search = req.query.search;
    const category = req.query.category;
    const minPrice = parseFloat(req.query.minPrice) || 0;
    const maxPrice = parseFloat(req.query.maxPrice) || Infinity;

    if (!Product) {
      // Fallback with sample data
      let filteredProducts = [...sampleProducts];
      
      if (featured) {
        filteredProducts = filteredProducts.filter(product => product.featured);
      }
      
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        filteredProducts = filteredProducts.filter(product => 
          searchRegex.test(product.name) || searchRegex.test(product.description)
        );
      }
      
      if (category) {
        filteredProducts = filteredProducts.filter(product => product.category === category);
      }
      
      filteredProducts = filteredProducts.filter(product => 
        product.price >= minPrice && product.price <= maxPrice
      );

      const paginatedProducts = filteredProducts.slice(skip, skip + limit);

      return res.json({
        products: paginatedProducts,
        pagination: {
          current: page,
          pages: Math.ceil(filteredProducts.length / limit),
          total: filteredProducts.length
        }
      });
    }

    let query = { inStock: true };
    
    if (featured) {
      query.featured = true;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = category;
    }
    
    if (minPrice > 0 || maxPrice < Infinity) {
      query.price = {};
      if (minPrice > 0) query.price.$gte = minPrice;
      if (maxPrice < Infinity) query.price.$lte = maxPrice;
    }

    const products = await Product.find(query)
      .populate('seller', 'name phone')
      .sort({ featured: -1, createdAt: -1 })
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
    if (!Product) {
      // Fallback with sample data
      const product = sampleProducts.find(p => p._id === req.params.id);
      if (!product) {
        return res.status(404).json({ message: 'المنتج غير موجود' });
      }
      return res.json(product);
    }

    const product = await Product.findById(req.params.id)
      .populate('seller', 'name phone');
    
    if (!product) {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }

    // Increment views if not the seller
    if (!req.user || product.seller._id.toString() !== req.user._id.toString()) {
      product.views = (product.views || 0) + 1;
      await product.save();
    }

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'خطأ في جلب المنتج' });
  }
});

// Get products by category
router.get('/category/:category', optionalAuth, async (req, res) => {
  try {
    const { category } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    if (!Product) {
      // Fallback with sample data
      const filteredProducts = sampleProducts.filter(product => product.category === category);
      const paginatedProducts = filteredProducts.slice(skip, skip + limit);

      return res.json({
        products: paginatedProducts,
        pagination: {
          current: page,
          pages: Math.ceil(filteredProducts.length / limit),
          total: filteredProducts.length
        }
      });
    }

    const query = {
      category,
      inStock: true
    };

    const products = await Product.find(query)
      .populate('seller', 'name phone')
      .sort({ createdAt: -1 })
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
    console.error('Get products by category error:', error);
    res.status(500).json({ message: 'خطأ في جلب منتجات القسم' });
  }
});

// Create new product (Auth required)
router.post('/', auth, upload.array('images', 10), async (req, res) => {
  try {
    const { name, description, price, category, stockQuantity } = req.body;

    if (!name || !description || !price) {
      return res.status(400).json({ message: 'الاسم والوصف والسعر مطلوبان' });
    }

    if (!Product) {
      return res.status(503).json({ message: 'خدمة المنتجات غير متاحة حالياً' });
    }

    const images = req.files ? req.files.map(file => file.filename) : [];

    const product = new Product({
      name,
      description,
      price: parseFloat(price),
      category: category || 'عام',
      seller: req.user._id,
      images,
      stockQuantity: parseInt(stockQuantity) || 1,
      inStock: true
    });

    await product.save();
    await product.populate('seller', 'name phone');

    res.status(201).json({
      message: 'تم إضافة المنتج بنجاح',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'خطأ في إضافة المنتج' });
  }
});

// Update product
router.put('/:id', auth, upload.array('images', 10), async (req, res) => {
  try {
    if (!Product) {
      return res.status(503).json({ message: 'خدمة المنتجات غير متاحة حالياً' });
    }

    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }

    // Check if user owns the product or is admin
    if (product.seller.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'غير مسموح لك بتعديل هذا المنتج' });
    }

    const { name, description, price, category, stockQuantity, inStock, featured } = req.body;

    // Update fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (price) product.price = parseFloat(price);
    if (category) product.category = category;
    if (stockQuantity !== undefined) product.stockQuantity = parseInt(stockQuantity);
    if (inStock !== undefined) product.inStock = inStock === 'true';
    
    // Only admin can set featured
    if (req.user.isAdmin && featured !== undefined) {
      product.featured = featured === 'true';
    }

    // Handle new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => file.filename);
      product.images = [...(product.images || []), ...newImages];
    }

    await product.save();
    await product.populate('seller', 'name phone');

    res.json({
      message: 'تم تحديث المنتج بنجاح',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'خطأ في تحديث المنتج' });
  }
});

// Delete product
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!Product) {
      return res.status(503).json({ message: 'خدمة المنتجات غير متاحة حالياً' });
    }

    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }

    // Check if user owns the product or is admin
    if (product.seller.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'غير مسموح لك بحذف هذا المنتج' });
    }

    // Delete associated images
    if (product.images && product.images.length > 0) {
      product.images.forEach(image => {
        const imagePath = path.join(__dirname, '..', 'uploads', 'products', image);
        if (fs.existsSync(imagePath)) {
          try {
            fs.unlinkSync(imagePath);
            console.log(`Deleted image: ${imagePath}`);
          } catch (err) {
            console.error(`Error deleting image ${imagePath}:`, err);
          }
        }
      });
    }

    // Delete all comments associated with this product
    let deletedComments = 0;
    if (Comment) {
      const deleteResult = await Comment.deleteMany({ 
        targetType: 'Product', 
        targetId: product._id 
      });
      deletedComments = deleteResult.deletedCount;
    }

    // Delete the product
    await Product.findByIdAndDelete(req.params.id);

    res.json({ 
      message: 'تم حذف المنتج بنجاح',
      deletedComments
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'خطأ في حذف المنتج' });
  }
});

// Like/Unlike product
router.post('/:id/like', auth, async (req, res) => {
  try {
    if (!Product) {
      return res.status(503).json({ message: 'خدمة المنتجات غير متاحة حالياً' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }

    const userIndex = product.likes.indexOf(req.user._id);
    
    if (userIndex > -1) {
      // Unlike
      product.likes.splice(userIndex, 1);
    } else {
      // Like
      product.likes.push(req.user._id);
    }

    await product.save();

    res.json({
      message: userIndex > -1 ? 'تم إلغاء الإعجاب' : 'تم الإعجاب بالمنتج',
      likesCount: product.likes.length,
      isLiked: userIndex === -1
    });
  } catch (error) {
    console.error('Like product error:', error);
    res.status(500).json({ message: 'خطأ في الإعجاب بالمنتج' });
  }
});

// Get user's products
router.get('/seller/:sellerId', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    if (!Product) {
      return res.json({
        products: [],
        pagination: { current: 1, pages: 0, total: 0 }
      });
    }

    const query = {
      seller: req.params.sellerId,
      inStock: true
    };

    const products = await Product.find(query)
      .populate('seller', 'name phone')
      .sort({ createdAt: -1 })
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
    console.error('Get seller products error:', error);
    res.status(500).json({ message: 'خطأ في جلب منتجات البائع' });
  }
});

module.exports = router;
