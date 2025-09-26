const mongoose = require('mongoose');

const ThemeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم المظهر مطلوب'],
    trim: true,
    unique: true,
    maxlength: [100, 'اسم المظهر يجب أن يكون أقل من 100 حرف']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [300, 'وصف المظهر يجب أن يكون أقل من 300 حرف']
  },
  colors: {
    primary: {
      type: String,
      required: [true, 'اللون الأساسي مطلوب'],
      validate: {
        validator: function(v) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: 'اللون الأساسي يجب أن يكون بصيغة hex صحيحة'
      }
    },
    secondary: {
      type: String,
      required: [true, 'اللون الثانوي مطلوب'],
      validate: {
        validator: function(v) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: 'اللون الثانوي يجب أن يكون بصيغة hex صحيحة'
      }
    },
    accent: {
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: 'لون التمييز يجب أن يكون بصيغة hex صحيحة'
      }
    },
    background: {
      type: String,
      default: '#ffffff',
      validate: {
        validator: function(v) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: 'لون الخلفية يجب أن يكون بصيغة hex صحيحة'
      }
    },
    text: {
      type: String,
      default: '#333333',
      validate: {
        validator: function(v) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: 'لون النص يجب أن يكون بصيغة hex صحيحة'
      }
    },
    border: {
      type: String,
      default: '#e0e0e0',
      validate: {
        validator: function(v) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: 'لون الحدود يجب أن يكون بصيغة hex صحيحة'
      }
    }
  },
  fonts: {
    primary: {
      type: String,
      default: 'Cairo, sans-serif'
    },
    secondary: {
      type: String,
      default: 'Arial, sans-serif'
    },
    sizes: {
      small: { type: Number, default: 14, min: 10, max: 20 },
      medium: { type: Number, default: 16, min: 12, max: 24 },
      large: { type: Number, default: 18, min: 14, max: 28 },
      xlarge: { type: Number, default: 24, min: 18, max: 36 }
    }
  },
  layout: {
    containerWidth: {
      type: Number,
      default: 1200,
      min: 800,
      max: 1600
    },
    borderRadius: {
      type: Number,
      default: 8,
      min: 0,
      max: 20
    },
    spacing: {
      small: { type: Number, default: 8, min: 4, max: 16 },
      medium: { type: Number, default: 16, min: 8, max: 24 },
      large: { type: Number, default: 24, min: 16, max: 32 },
      xlarge: { type: Number, default: 32, min: 24, max: 48 }
    }
  },
  customCSS: {
    type: String,
    maxlength: [10000, 'كود CSS المخصص يجب أن يكون أقل من 10000 حرف']
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'الوسم يجب أن يكون أقل من 30 حرف']
  }],
  preview: {
    type: String, // Base64 encoded image or file path
    maxlength: [1000000, 'صورة المعاينة كبيرة جداً']
  },
  version: {
    type: String,
    default: '1.0.0'
  },
  compatibility: {
    minVersion: String,
    maxVersion: String
  }
}, {
  timestamps: true
});

// Indexes for better performance
ThemeSchema.index({ isDefault: 1 });
ThemeSchema.index({ isActive: 1 });
ThemeSchema.index({ createdBy: 1 });
ThemeSchema.index({ usageCount: -1 });
ThemeSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Ensure only one default theme
ThemeSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Remove default from other themes
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

// Virtual for CSS variables
ThemeSchema.virtual('cssVariables').get(function() {
  return {
    '--primary-color': this.colors.primary,
    '--secondary-color': this.colors.secondary,
    '--accent-color': this.colors.accent || this.colors.primary,
    '--background-color': this.colors.background,
    '--text-color': this.colors.text,
    '--border-color': this.colors.border,
    '--font-primary': this.fonts.primary,
    '--font-secondary': this.fonts.secondary,
    '--font-size-small': this.fonts.sizes.small + 'px',
    '--font-size-medium': this.fonts.sizes.medium + 'px',
    '--font-size-large': this.fonts.sizes.large + 'px',
    '--font-size-xlarge': this.fonts.sizes.xlarge + 'px',
    '--container-width': this.layout.containerWidth + 'px',
    '--border-radius': this.layout.borderRadius + 'px',
    '--spacing-small': this.layout.spacing.small + 'px',
    '--spacing-medium': this.layout.spacing.medium + 'px',
    '--spacing-large': this.layout.spacing.large + 'px',
    '--spacing-xlarge': this.layout.spacing.xlarge + 'px'
  };
});

// Virtual for complete CSS
ThemeSchema.virtual('compiledCSS').get(function() {
  const variables = this.cssVariables;
  let css = ':root {\n';
  
  for (const [key, value] of Object.entries(variables)) {
    css += `  ${key}: ${value};\n`;
  }
  
  css += '}\n\n';
  
  if (this.customCSS) {
    css += this.customCSS;
  }
  
  return css;
});

// Method to generate gradient
ThemeSchema.methods.generateGradient = function(direction = '135deg') {
  return `linear-gradient(${direction}, ${this.colors.primary} 0%, ${this.colors.secondary} 100%)`;
};

// Method to get contrasting text color
ThemeSchema.methods.getContrastColor = function(backgroundColor) {
  // Convert hex to RGB
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

// Method to apply theme to user
ThemeSchema.methods.applyToUser = async function(userId) {
  const User = require('./User');
  await User.findByIdAndUpdate(userId, {
    'preferences.theme': this._id
  });
  
  this.usageCount += 1;
  await this.save();
};

// Method to clone theme
ThemeSchema.methods.clone = function(newName, userId) {
  const clonedTheme = new this.constructor({
    name: newName,
    description: `نسخة من ${this.name}`,
    colors: { ...this.colors },
    fonts: { ...this.fonts },
    layout: { ...this.layout },
    customCSS: this.customCSS,
    createdBy: userId,
    tags: [...this.tags, 'نسخة'],
    version: '1.0.0'
  });
  
  return clonedTheme;
};

// Static method to get default theme
ThemeSchema.statics.getDefault = function() {
  return this.findOne({ isDefault: true, isActive: true });
};

// Static method to get popular themes
ThemeSchema.statics.getPopular = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ usageCount: -1 })
    .limit(limit)
    .populate('createdBy', 'name');
};

// Static method to search themes
ThemeSchema.statics.search = function(query, options = {}) {
  const { limit = 20, skip = 0 } = options;
  
  return this.find({
    $text: { $search: query },
    isActive: true
  }, {
    score: { $meta: 'textScore' }
  })
  .sort({ score: { $meta: 'textScore' } })
  .populate('createdBy', 'name')
  .skip(skip)
  .limit(limit);
};

// Static method to create default theme
ThemeSchema.statics.createDefault = async function() {
  const defaultTheme = await this.findOne({ isDefault: true });
  if (defaultTheme) return defaultTheme;
  
  const adminUser = await require('./User').findOne({ isAdmin: true });
  if (!adminUser) throw new Error('Admin user not found');
  
  const theme = new this({
    name: 'المظهر الافتراضي',
    description: 'المظهر الافتراضي لموقع ماما الجزائرية',
    colors: {
      primary: '#d4a574',
      secondary: '#f4e6d2',
      accent: '#b8956a',
      background: '#ffffff',
      text: '#333333',
      border: '#e0e0e0'
    },
    fonts: {
      primary: 'Cairo, sans-serif',
      secondary: 'Arial, sans-serif',
      sizes: {
        small: 14,
        medium: 16,
        large: 18,
        xlarge: 24
      }
    },
    layout: {
      containerWidth: 1200,
      borderRadius: 8,
      spacing: {
        small: 8,
        medium: 16,
        large: 24,
        xlarge: 32
      }
    },
    isDefault: true,
    isActive: true,
    createdBy: adminUser._id,
    tags: ['افتراضي', 'ذهبي', 'كلاسيكي']
  });
  
  await theme.save();
  return theme;
};

// Ensure virtual fields are serialized
ThemeSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Theme', ThemeSchema);
