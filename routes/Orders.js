const express = require('express');
const router = express.Router();

console.log('✅ Loading Orders routes...');

// Test route to verify router works
router.get('/test', (req, res) => {
    res.json({ 
        message: 'Orders route working',
        timestamp: new Date().toISOString()
    });
});

// GET /api/orders - Get all orders (admin) or user orders
router.get('/', async (req, res) => {
    try {
        console.log('📦 Loading orders...');
        
        // Try to load Order model and auth middleware
        const Order = require('../models/Order');
        
        const orders = await Order.find({})
            .populate('items.product')
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({
            orders: orders || [],
            pagination: {
                current: 1,
                pages: 1,
                total: orders ? orders.length : 0
            }
        });

    } catch (error) {
        console.error('❌ Orders load error:', error);
        // Return empty response if model doesn't exist
        res.json({
            orders: [],
            pagination: {
                current: 1,
                pages: 0,
                total: 0
            }
        });
    }
});

// GET /api/orders/stats/dashboard - Get dashboard stats
router.get('/stats/dashboard', async (req, res) => {
    try {
        const Order = require('../models/Order');
        
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        
        const [totalOrders, pendingOrders, todayOrders, monthRevenue] = await Promise.all([
            Order.countDocuments({}),
            Order.countDocuments({ status: 'pending' }),
            Order.countDocuments({ createdAt: { $gte: startOfDay } }),
            Order.aggregate([
                { $match: { createdAt: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: '$totalPrice' } } }
            ])
        ]);

        res.json({
            totalOrders: totalOrders || 0,
            pendingOrders: pendingOrders || 0,
            todayOrders: todayOrders || 0,
            monthRevenue: monthRevenue[0]?.total || 0
        });

    } catch (error) {
        console.error('❌ Orders stats error:', error);
        res.json({
            totalOrders: 0,
            pendingOrders: 0,
            todayOrders: 0,
            monthRevenue: 0
        });
    }
});

// GET /api/orders/:id - Get single order
router.get('/:id', async (req, res) => {
    try {
        const Order = require('../models/Order');
        
        const order = await Order.findById(req.params.id)
            .populate('items.product');

        if (!order) {
            return res.status(404).json({ message: 'الطلب غير موجود' });
        }

        res.json(order);

    } catch (error) {
        console.error('❌ Get order error:', error);
        res.status(500).json({ message: 'خطأ في تحميل الطلب' });
    }
});

// POST /api/orders - Create new order
router.post('/', async (req, res) => {
    try {
        const Order = require('../models/Order');
        
        const {
            customerInfo,
            items,
            totalPrice,
            deliveryPrice
        } = req.body;

        // Validate required fields
        if (!customerInfo || !items || !totalPrice) {
            return res.status(400).json({ 
                message: 'معلومات الطلب غير مكتملة' 
            });
        }

        // Create order
        const order = new Order({
            customerInfo,
            items,
            totalPrice,
            deliveryPrice: deliveryPrice || 0,
            status: 'pending',
            orderNumber: `ORD-${Date.now()}`
        });

        await order.save();

        console.log('✅ Order created:', order.orderNumber);

        res.status(201).json({
            message: 'تم إنشاء الطلب بنجاح',
            order: order,
            orderNumber: order.orderNumber
        });

    } catch (error) {
        console.error('❌ Create order error:', error);
        res.status(500).json({ 
            message: 'خطأ في إنشاء الطلب',
            error: error.message 
        });
    }
});

// PATCH /api/orders/:id/status - Update order status
router.patch('/:id/status', async (req, res) => {
    try {
        const Order = require('../models/Order');
        
        const { status, trackingNumber, notes } = req.body;

        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({ message: 'الطلب غير موجود' });
        }

        // Update order
        order.status = status;
        if (trackingNumber) order.trackingNumber = trackingNumber;
        if (notes) order.notes = notes;

        await order.save();

        console.log(`✅ Order ${order.orderNumber} status updated to: ${status}`);

        res.json({
            message: 'تم تحديث حالة الطلب بنجاح',
            order
        });

    } catch (error) {
        console.error('❌ Update order status error:', error);
        res.status(500).json({ 
            message: 'خطأ في تحديث حالة الطلب',
            error: error.message 
        });
    }
});

// DELETE /api/orders/:id - Delete order
router.delete('/:id', async (req, res) => {
    try {
        const Order = require('../models/Order');
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({ message: 'الطلب غير موجود' });
        }

        await Order.findByIdAndDelete(req.params.id);

        console.log(`✅ Order ${order.orderNumber} deleted`);

        res.json({
            message: 'تم حذف الطلب بنجاح'
        });

    } catch (error) {
        console.error('❌ Delete order error:', error);
        res.status(500).json({ 
            message: 'خطأ في حذف الطلب',
            error: error.message 
        });
    }
});

module.exports = router;
