const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'اسم المستخدم مطلوب'],
    unique: true,
    trim: true,
    minlength: [3, 'اسم المستخدم يجب أن يكون على الأقل 3 أحرف'],
    maxlength: [30, 'اسم المستخدم لا يمكن أن يتجاوز 30 حرف']
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
    minlength: [6, 'كلمة المرور يجب أن تكون على الأقل 6 أحرف']
  },
  fullName: {
    type: String,
    required: [true, 'الاسم الكامل مطلوب'],
    trim: true,
    maxlength: [100, 'الاسم الكامل لا يمكن أن يتجاوز 100 حرف']
  },
  avatar: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: [500, 'النبذة التعريفية لا يمكن أن تتجاوز 500 حرف'],
    default: ''
  },
  location: {
    type: String,
    maxlength: [100, 'الموقع لا يمكن أن يتجاوز 100 حرف'],
    default: ''
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: null
  },
  preferences: {
    newsletter: {
      type: Boolean,
      default: true
    },
    notifications: {
      type: Boolean,
      default: true
    },
    privacy: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'public'
    }
  },
  socialMedia: {
    facebook: String,
    instagram: String,
    twitter: String
  },
  stats: {
    postsCount: {
      type: Number,
      default: 0
    },
    likesReceived: {
      type: Number,
      default: 0
    },
    commentsCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { 
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  }
});

// Indexes for better performance
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ lastLogin: -1 });

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Error comparing passwords');
  }
};

// Instance method to get public profile
UserSchema.methods.getPublicProfile = function() {
  const user = this.toObject();
  delete user.password;
  delete user.email; // Hide email in public profile
  return user;
};

// Instance method to get safe profile (for logged-in user)
UserSchema.methods.getSafeProfile = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Static method to find user by email or username
UserSchema.statics.findByEmailOrUsername = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier }
    ]
  });
};

// Static method to create admin user
UserSchema.statics.createAdmin = async function(adminData) {
  try {
    const existingAdmin = await this.findOne({ 
      $or: [
        { email: adminData.email },
        { role: 'admin' }
      ]
    });

    if (existingAdmin) {
      return { success: false, message: 'Admin user already exists' };
    }

    const admin = new this({
      ...adminData,
      role: 'admin',
      emailVerified: true,
      isActive: true
    });

    await admin.save();
    return { success: true, user: admin };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// Virtual for full profile URL
UserSchema.virtual('profileUrl').get(function() {
  return `/users/${this.username}`;
});

// Virtual for display name
UserSchema.virtual('displayName').get(function() {
  return this.fullName || this.username;
});

// Method to update last login
UserSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

// Method to increment post count
UserSchema.methods.incrementPostCount = function() {
  this.stats.postsCount += 1;
  return this.save();
};

// Method to increment likes received
UserSchema.methods.incrementLikesReceived = function() {
  this.stats.likesReceived += 1;
  return this.save();
};

// Method to increment comments count
UserSchema.methods.incrementCommentsCount = function() {
  this.stats.commentsCount += 1;
  return this.save();
};

// Pre-remove middleware to clean up related data
UserSchema.pre('remove', async function(next) {
  try {
    // Here you could remove user's posts, comments, etc.
    // const Post = mongoose.model('Post');
    // await Post.deleteMany({ author: this._id });
    
    console.log(`Cleaning up data for user: ${this.username}`);
    next();
  } catch (error) {
    next(error);
  }
});

// Model validation for unique fields
UserSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    let message = '';
    
    switch (field) {
      case 'email':
        message = 'هذا البريد الإلكتروني مستخدم بالفعل';
        break;
      case 'username':
        message = 'اسم المستخدم هذا مأخوذ بالفعل';
        break;
      default:
        message = 'هذه البيانات مستخدمة بالفعل';
    }
    
    error.message = message;
    next(error);
  } else {
    next(error);
  }
});

const User = mongoose.model('User', UserSchema);

module.exports = User;
