const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'الكمية يجب أن تكون 1 على الأقل']
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'السعر يجب أن يكون أكبر من أو يساوي صفر']
    },
    subtotal: {
      type: Number,
      default: function() {
        return this.quantity * this.price;
      }
    }
  }],
  total: {
    type: Number,
    required: true,
    min: [0, 'المجموع يجب أن يكون أكبر من أو يساوي صفر']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash_on_delivery', 'bank_transfer', 'mobile_payment', 'card'],
    default: 'cash_on_delivery'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  shippingAddress: {
    street: {
      type: String,
      required: [true, 'عنوان الشارع مطلوب'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'المدينة مطلوبة'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'الولاية مطلوبة'],
      trim: true
    },
    postalCode: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      default: 'الجزائر',
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [200, 'ملاحظات العنوان يجب أن تكون أقل من 200 حرف']
    }
  },
  billingAddress: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: { type: String, default: 'الجزائر' },
    sameAsShipping: { type: Boolean, default: true }
  },
  shipping: {
    method: {
      type: String,
      enum: ['standard', 'express', 'pickup'],
      default: 'standard'
    },
    cost: {
      type: Number,
      default: 0,
      min: 0
    },
    estimatedDelivery: Date,
    trackingNumber: String,
    carrier: String
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'الملاحظات يجب أن تكون أقل من 500 حرف']
  },
  adminNotes: {
    type: String,
    trim: true,
    maxlength: [1000, 'ملاحظات الإدارة يجب أن تكون أقل من 1000 حرف']
  },
  timeline: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  refund: {
    requested: { type: Boolean, default: false },
    reason: String,
    amount: Number,
    processedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  discount: {
    code: String,
    amount: { type: Number, default: 0 },
    type: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed'
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
OrderSchema.index({ customer: 1, status: 1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ 'shipping.trackingNumber': 1 });

// Pre-save middleware to calculate totals and add timeline
OrderSchema.pre('save', function(next) {
  // Calculate subtotals for items
  this.items.forEach(item => {
    item.subtotal = item.quantity * item.price;
  });
  
  // Calculate total
  const itemsTotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
  this.total = itemsTotal + (this.shipping.cost || 0) - (this.discount.amount || 0);
  
  // Add to timeline if status changed
  if (this.isModified('status') && !this.isNew) {
    this.timeline.push({
      status: this.status,
      timestamp: new Date(),
      note: `تم تغيير حالة الطلب إلى ${this.getStatusText()}`
    });
  }
  
  // Set initial timeline for new orders
  if (this.isNew) {
    this.timeline = [{
      status: this.status,
      timestamp: new Date(),
      note: 'تم إنشاء الطلب'
    }];
  }
  
  next();
});

// Virtual for formatted order number
OrderSchema.virtual('formattedOrderNumber').get(function() {
  return `#${this.orderNumber}`;
});

// Virtual for total items count
OrderSchema.virtual('itemsCount').get(function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Virtual for formatted total
OrderSchema.virtual('formattedTotal').get(function() {
  return `${this.total.toLocaleString()} دج`;
});

// Virtual for estimated delivery date
OrderSchema.virtual('estimatedDeliveryDate').get(function() {
  if (this.shipping.estimatedDelivery) {
    return this.shipping.estimatedDelivery.toLocaleDateString('ar-DZ');
  }
  
  // Calculate based on shipping method if not set
  const days = this.shipping.method === 'express' ? 2 : 5;
  const delivery = new Date(this.createdAt);
  delivery.setDate(delivery.getDate() + days);
  return delivery.toLocaleDateString('ar-DZ');
});

// Method to get status text in Arabic
OrderSchema.methods.getStatusText = function() {
  const statusMap = {
    'pending': 'في انتظار التأكيد',
    'confirmed': 'مؤكد',
    'processing': 'قيد التحضير',
    'shipped': 'تم الشحن',
    'delivered': 'تم التوصيل',
    'cancelled': 'ملغى',
    'refunded': 'مسترد'
  };
  return statusMap[this.status] || this.status;
};

// Method to get payment status text in Arabic
OrderSchema.methods.getPaymentStatusText = function() {
  const statusMap = {
    'pending': 'في انتظار الدفع',
    'paid': 'مدفوع',
    'failed': 'فشل الدفع',
    'refunded': 'مسترد'
  };
  return statusMap[this.paymentStatus] || this.paymentStatus;
};

// Method to check if order can be cancelled
OrderSchema.methods.canBeCancelled = function() {
  return ['pending', 'confirmed'].includes(this.status);
};

// Method to check if order can be refunded
OrderSchema.methods.canBeRefunded = function() {
  return ['delivered'].includes(this.status) && !this.refund.requested;
};

// Method to add status update
OrderSchema.methods.addStatusUpdate = function(newStatus, note = '', updatedBy = null) {
  this.status = newStatus;
  this.timeline.push({
    status: newStatus,
    timestamp: new Date(),
    note: note || `تم تغيير حالة الطلب إلى ${this.getStatusText()}`,
    updatedBy
  });
};

// Method to request refund
OrderSchema.methods.requestRefund = function(reason, amount = null) {
  this.refund = {
    requested: true,
    reason,
    amount: amount || this.total
  };
  this.addStatusUpdate('refunded', `طلب استرداد: ${reason}`);
};

// Method to get shipping method text
OrderSchema.methods.getShippingMethodText = function() {
  const methodMap = {
    'standard': 'توصيل عادي (3-5 أيام)',
    'express': 'توصيل سريع (1-2 يوم)',
    'pickup': 'استلام من المتجر'
  };
  return methodMap[this.shipping.method] || this.shipping.method;
};

// Static method to get orders by status
OrderSchema.statics.getByStatus = function(status, options = {}) {
  const { limit = 20, skip = 0 } = options;
  
  return this.find({ status })
    .populate('customer', 'name email phone')
    .populate('items.product', 'name price images')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get orders by customer
OrderSchema.statics.getByCustomer = function(customerId, options = {}) {
  const { limit = 20, skip = 0, status } = options;
  
  let query = { customer: customerId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('items.product', 'name price images')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get sales statistics
OrderSchema.statics.getSalesStats = async function(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        },
        status: { $nin: ['cancelled', 'refunded'] }
      }
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        averageOrderValue: { $avg: '$total' },
        totalItems: { $sum: { $sum: '$items.quantity' } }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    totalItems: 0
  };
};

// Static method to generate order number
OrderSchema.statics.generateOrderNumber = async function() {
  const year = new Date().getFullYear();
  const count = await this.countDocuments({
    createdAt: {
      $gte: new Date(year, 0, 1),
      $lt: new Date(year + 1, 0, 1)
    }
  });
  
  return `ORD-${year}-${String(count + 1).padStart(6, '0')}`;
};

// Ensure virtual fields are serialized
OrderSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Order', OrderSchema);
