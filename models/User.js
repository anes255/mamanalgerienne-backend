const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'الاسم مطلوب'],
    trim: true,
    minlength: [2, 'الاسم يجب أن يكون أكثر من حرفين'],
    maxlength: [50, 'الاسم يجب أن يكون أقل من 50 حرف']
  },
  email: {
    type: String,
    required: [true, 'البريد الإلكتروني مطلوب'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'يرجى إدخال بريد إلكتروني صحيح']
  },
  password: {
    type: String,
    required: [true, 'كلمة المرور مطلوبة'],
    minlength: [6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل']
  },
  phone: {
    type: String,
    required: [true, 'رقم الهاتف مطلوب'],
    trim: true,
    match: [/^[0-9]{10}$/, 'يرجى إدخال رقم هاتف صحيح']
  },
  avatar: {
    type: String, // Filename of uploaded avatar
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
    maxlength: [500, 'النبذة الشخصية يجب أن تكون أقل من 500 حرف'],
    trim: true
  },
  location: {
    type: String,
    trim: true,
    maxlength: [100, 'الموقع يجب أن يكون أقل من 100 حرف']
  },
  birthDate: {
    type: Date
  },
  preferences: {
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      posts: {
        type: Boolean,
        default: true
      },
      comments: {
        type: Boolean,
        default: true
      }
    },
    privacy: {
      showEmail: {
        type: Boolean,
        default: false
      },
      showPhone: {
        type: Boolean,
        default: false
      }
    }
  },
  stats: {
    postsCount: {
      type: Number,
      default: 0
    },
    commentsCount: {
      type: Number,
      default: 0
    },
    likesReceived: {
      type: Number,
      default: 0
    }
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'banned'],
    default: 'active'
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  emailVerificationToken: String,
  emailVerificationExpires: Date
}, {
  timestamps: true
});

// Index for better performance
UserSchema.index({ email: 1 });
UserSchema.index({ isAdmin: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ createdAt: -1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
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

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Get public profile (without sensitive data)
UserSchema.methods.getPublicProfile = function() {
  return {
    _id: this._id,
    name: this.name,
    avatar: this.avatar,
    bio: this.bio,
    location: this.location,
    stats: this.stats,
    createdAt: this.createdAt,
    isAdmin: this.isAdmin
  };
};

// Static method to find by email
UserSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Virtual for user's age
UserSchema.virtual('age').get(function() {
  if (!this.birthDate) return null;
  const today = new Date();
  const birthDate = new Date(this.birthDate);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Virtual for full avatar URL
UserSchema.virtual('avatarUrl').get(function() {
  if (!this.avatar) return null;
  return `/uploads/avatars/${this.avatar}`;
});

// Ensure virtual fields are serialized
UserSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    // Remove sensitive fields from JSON output
    delete ret.password;
    delete ret.resetPasswordToken;
    delete ret.resetPasswordExpires;
    delete ret.emailVerificationToken;
    delete ret.emailVerificationExpires;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', UserSchema);
