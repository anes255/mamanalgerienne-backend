const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'الاسم مطلوب'],
    trim: true,
    maxlength: [50, 'الاسم يجب أن يكون أقل من 50 حرف']
  },
  email: {
    type: String,
    required: [true, 'البريد الإلكتروني مطلوب'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'البريد الإلكتروني غير صحيح'
    ]
  },
  phone: {
    type: String,
    required: [true, 'رقم الهاتف مطلوب'],
    unique: true,
    trim: true,
    match: [/^[0-9]{10}$/, 'رقم الهاتف يجب أن يكون 10 أرقام']
  },
  password: {
    type: String,
    required: [true, 'كلمة المرور مطلوبة'],
    minlength: [6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل']
  },
  avatar: {
    type: String,
    default: null
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  bio: {
    type: String,
    maxlength: [500, 'النبذة الشخصية يجب أن تكون أقل من 500 حرف']
  },
  location: {
    type: String,
    maxlength: [100, 'الموقع يجب أن يكون أقل من 100 حرف']
  },
  dateOfBirth: {
    type: Date
  },
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    privacy: {
      showEmail: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false }
    }
  },
  loginHistory: [{
    date: { type: Date, default: Date.now },
    ip: String,
    userAgent: String
  }],
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Instance method to update last active
userSchema.methods.updateLastActive = function() {
  this.lastActive = new Date();
  return this.save();
};

// Virtual for user's age
userSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Static method to find by email or phone
userSchema.statics.findByEmailOrPhone = function(emailOrPhone) {
  return this.findOne({
    $or: [
      { email: emailOrPhone },
      { phone: emailOrPhone }
    ]
  });
};

// Static method to find admins
userSchema.statics.findAdmins = function() {
  return this.find({ isAdmin: true });
};

// Index for better performance
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ isAdmin: 1 });
userSchema.index({ lastActive: -1 });

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.loginHistory;
  return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
