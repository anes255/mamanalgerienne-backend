const express = require('express');

const router = express.Router();

// Import models only if they exist
let Order, Product, User;
try {
  Order = require('../models/Order');
  Product = require('../models/Product');
  User = require('../models/User');
} catch (error) {
  console.log('Order models not found, using fallback');
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

// Sample orders for fallback
const sampleOrders = [
  {
    _id: '1',
    orderNumber: 'ORD-2024-001',
    customer: {
      _id: 'user1',
      name: 'أم محمد',
      email: 'user1@example.com',
      phone: '0555123456'
    },
    items: [
      {
        product: {
          _id: 'product1',
          name: 'طقم ملابس أطفال',
          price: 2500
        },
        quantity: 2,
        price: 2500
      }
    ],
    total: 5000,
    status: 'pending',
    shippingAddress: {
      street: 'شارع الاستقلال',
      city: 'الجزائر',
      state: 'الجزائر',
      postalCode: '16000',
      country: 'الجزائر'
    },
    paymentMethod: 'cash_on_delivery',
    notes: 'توصيل بعد الظهر',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Get all orders (Admin only)
router.get('/admin', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    if (!Order) {
      // Fallback with sample data
      let filteredOrders = [...sampleOrders];
      
      if (status) {
        filteredOrders = filteredOrders.filter(order => order.status === status);
      }

      const paginatedOrders = filteredOrders.slice(skip, skip + limit);

      return res.json({
        orders: paginatedOrders,
        pagination: {
          current: page,
          pages: Math.ceil(filteredOrders.length / limit),
          total: filteredOrders.length
        }
      });
    }

    let query = {};
    
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('customer', 'name email phone')
      .populate('items.product', 'name price images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get admin orders error:', error);
    res.status(500).json({ message: 'خطأ في جلب الطلبات' });
  }
});

// Get user's orders
router.get('/user', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!Order) {
      // Fallback with sample data
      const userOrders = sampleOrders.filter(order => order.customer._id === req.user._id);
      const paginatedOrders = userOrders.slice(skip, skip + limit);

      return res.json({
        orders: paginatedOrders,
        pagination: {
          current: page,
          pages: Math.ceil(userOrders.length / limit),
          total: userOrders.length
        }
      });
    }

    const query = { customer: req.user._id };

    const orders = await Order.find(query)
      .populate('items.product', 'name price images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ message: 'خطأ في جلب طلباتك' });
  }
});

// Get single order
router.get('/:id', auth, async (req, res) => {
  try {
    if (!Order) {
      // Fallback with sample data
      const order = sampleOrders.find(o => o._id === req.params.id);
      if (!order) {
        return res.status(404).json({ message: 'الطلب غير موجود' });
      }
      
      // Check if user owns the order or is admin
      if (order.customer._id !== req.user._id && !req.user.isAdmin) {
        return res.status(403).json({ message: 'غير مسموح لك بعرض هذا الطلب' });
      }
      
      return res.json(order);
    }

    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('items.product', 'name price images');
    
    if (!order) {
      return res.status(404).json({ message: 'الطلب غير موجود' });
    }

    // Check if user owns the order or is admin
    if (order.customer._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'غير مسموح لك بعرض هذا الطلب' });
    }

    res.json(order);

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'خطأ في جلب الطلب' });
  }
});

// Create new order
router.post('/', auth, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'يجب إضافة منتجات للطلب' });
    }

    if (!shippingAddress || !shippingAddress.street || !shippingAddress.city) {
      return res.status(400).json({ message: 'عنوان التوصيل مطلوب' });
    }

    if (!Order) {
      return res.status(503).json({ message: 'خدمة الطلبات غير متاحة حالياً' });
    }

    // Validate and calculate total
    let total = 0;
    const orderItems = [];

    for (const item of items) {
      if (!Product) {
        // Fallback calculation
        total += item.price * item.quantity;
        orderItems.push({
          product: item.productId,
          quantity: item.quantity,
          price: item.price
        });
        continue;
      }

      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({ message: `المنتج ${item.productId} غير موجود` });
      }

      if (!product.inStock || product.stockQuantity < item.quantity) {
        return res.status(400).json({ message: `المنتج ${product.name} غير متوفر بالكمية المطلوبة` });
      }

      const itemTotal = product.price * item.quantity;
      total += itemTotal;

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price
      });

      // Update product stock
      product.stockQuantity -= item.quantity;
      if (product.stockQuantity === 0) {
        product.inStock = false;
      }
      await product.save();
    }

    // Generate order number
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const order = new Order({
      orderNumber,
      customer: req.user._id,
      items: orderItems,
      total,
      shippingAddress,
      paymentMethod: paymentMethod || 'cash_on_delivery',
      notes: notes || '',
      status: 'pending'
    });

    await order.save();
    await order.populate('customer', 'name email phone');
    await order.populate('items.product', 'name price images');

    res.status(201).json({
      message: 'تم إنشاء الطلب بنجاح',
      order
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'خطأ في إنشاء الطلب' });
  }
});

// Update order status (Admin only)
router.patch('/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'حالة الطلب غير صحيحة' });
    }

    if (!Order) {
      return res.status(503).json({ message: 'خدمة الطلبات غير متاحة حالياً' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'الطلب غير موجود' });
    }

    // If cancelling order, restore product stock
    if (status === 'cancelled' && order.status !== 'cancelled' && Product) {
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          product.stockQuantity += item.quantity;
          product.inStock = true;
          await product.save();
        }
      }
    }

    order.status = status;
    order.updatedAt = new Date();
    await order.save();

    res.json({
      message: 'تم تحديث حالة الطلب بنجاح',
      order
    });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'خطأ في تحديث حالة الطلب' });
  }
});

// Cancel order (User can cancel pending orders)
router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    if (!Order) {
      return res.status(503).json({ message: 'خدمة الطلبات غير متاحة حالياً' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'الطلب غير موجود' });
    }

    // Check if user owns the order
    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'غير مسموح لك بإلغاء هذا الطلب' });
    }

    // Can only cancel pending orders
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'لا يمكن إلغاء هذا الطلب' });
    }

    // Restore product stock
    if (Product) {
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          product.stockQuantity += item.quantity;
          product.inStock = true;
          await product.save();
        }
      }
    }

    order.status = 'cancelled';
    order.updatedAt = new Date();
    await order.save();

    res.json({
      message: 'تم إلغاء الطلب بنجاح',
      order
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ message: 'خطأ في إلغاء الطلب' });
  }
});

// Get order statistics (Admin only)
router.get('/admin/stats', adminAuth, async (req, res) => {
  try {
    if (!Order) {
      return res.json({
        total: 1,
        pending: 1,
        confirmed: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        totalRevenue: 5000,
        averageOrderValue: 5000
      });
    }

    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$total' }
        }
      }
    ]);

    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    const result = {
      total: totalOrders,
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
      averageOrderValue: totalOrders > 0 ? (totalRevenue.length > 0 ? totalRevenue[0].total / totalOrders : 0) : 0
    };

    stats.forEach(stat => {
      if (result.hasOwnProperty(stat._id)) {
        result[stat._id] = stat.count;
      }
    });

    res.json(result);

  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ message: 'خطأ في جلب إحصائيات الطلبات' });
  }
});

// Delete order (Admin only - for cleanup)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    if (!Order) {
      return res.status(503).json({ message: 'خدمة الطلبات غير متاحة حالياً' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'الطلب غير موجود' });
    }

    // If order is not cancelled, restore product stock
    if (order.status !== 'cancelled' && Product) {
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          product.stockQuantity += item.quantity;
          product.inStock = true;
          await product.save();
        }
      }
    }

    await Order.findByIdAndDelete(req.params.id);

    res.json({
      message: 'تم حذف الطلب بنجاح'
    });

  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ message: 'خطأ في حذف الطلب' });
  }
});

module.exports = router;
