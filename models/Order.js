const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'المستخدم مطلوب']
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
      min: [1, 'الكمية يجب أن تكون أكبر من 0']
    },
    price: {
      type: Number,
      required: true
    }
  }],
  totalAmount: {
    type: Number,
    required: [true, 'المبلغ الإجمالي مطلوب'],
    min: [0, 'المبلغ الإجمالي يجب أن يكون أكبر من أو يساوي 0']
  },
  shippingAddress: {
    fullName: {
      type: String,
      required: [true, 'الاسم الكامل مطلوب']
    },
    phone: {
      type: String,
      required: [true, 'رقم الهاتف مطلوب']
    },
    address: {
      type: String,
      required: [true, 'العنوان مطلوب']
    },
    city: {
      type: String,
      required: [true, 'المدينة مطلوبة']
    },
    postalCode: String
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'online'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  notes: String
}, {
  timestamps: true
});

// Indexes
OrderSchema.index({ user: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', OrderSchema);
