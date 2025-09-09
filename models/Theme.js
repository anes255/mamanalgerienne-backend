// models/Theme.js - Create this new file
const mongoose = require('mongoose');

const ThemeSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'default'
  },
  colors: {
    primaryColor: {
      type: String,
      default: '#d4a574'
    },
    secondaryColor: {
      type: String,
      default: '#f8e8d4'
    },
    accentColor: {
      type: String,
      default: '#b8860b'
    },
    textColor: {
      type: String,
      default: '#2c2c2c'
    },
    lightText: {
      type: String,
      default: '#666'
    },
    bgColor: {
      type: String,
      default: '#fdfbf7'
    },
    borderColor: {
      type: String,
      default: '#e5d5c8'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure only one active theme
ThemeSchema.pre('save', async function(next) {
  if (this.isActive) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { isActive: false }
    );
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Theme', ThemeSchema);

// routes/admin.js - Create this new file or add to existing admin routes
const express = require('express');
const Theme = require('../models/Theme');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get current active theme
router.get('/theme', async (req, res) => {
  try {
    let theme = await Theme.findOne({ isActive: true });
    
    if (!theme) {
      // Create default theme if none exists
      theme = new Theme({
        name: 'default',
        colors: {
          primaryColor: '#d4a574',
          secondaryColor: '#f8e8d4',
          accentColor: '#b8860b',
          textColor: '#2c2c2c',
          lightText: '#666',
          bgColor: '#fdfbf7',
          borderColor: '#e5d5c8'
        },
        isActive: true
      });
      await theme.save();
    }

    res.json({ theme: theme.colors });
  } catch (error) {
    console.error('Get theme error:', error);
    res.status(500).json({ message: 'خطأ في جلب إعدادات الألوان' });
  }
});

// Update theme (Admin only)
router.post('/theme', adminAuth, async (req, res) => {
  try {
    const { theme } = req.body;

    if (!theme) {
      return res.status(400).json({ message: 'بيانات الألوان مطلوبة' });
    }

    // Validate color format
    const colorRegex = /^#[0-9A-F]{6}$/i;
    const colors = Object.values(theme);
    
    for (let color of colors) {
      if (!colorRegex.test(color)) {
        return res.status(400).json({ message: 'صيغة الألوان غير صحيحة' });
      }
    }

    // Find current active theme or create new one
    let currentTheme = await Theme.findOne({ isActive: true });
    
    if (currentTheme) {
      currentTheme.colors = theme;
      currentTheme.updatedAt = new Date();
      await currentTheme.save();
    } else {
      currentTheme = new Theme({
        name: 'custom',
        colors: theme,
        isActive: true
      });
      await currentTheme.save();
    }

    res.json({ 
      message: 'تم حفظ إعدادات الألوان بنجاح',
      theme: currentTheme.colors 
    });
  } catch (error) {
    console.error('Update theme error:', error);
    res.status(500).json({ message: 'خطأ في حفظ إعدادات الألوان' });
  }
});

// Reset theme to default (Admin only)
router.post('/theme/reset', adminAuth, async (req, res) => {
  try {
    const defaultColors = {
      primaryColor: '#d4a574',
      secondaryColor: '#f8e8d4',
      accentColor: '#b8860b',
      textColor: '#2c2c2c',
      lightText: '#666',
      bgColor: '#fdfbf7',
      borderColor: '#e5d5c8'
    };

    let currentTheme = await Theme.findOne({ isActive: true });
    
    if (currentTheme) {
      currentTheme.colors = defaultColors;
      currentTheme.name = 'default';
      currentTheme.updatedAt = new Date();
      await currentTheme.save();
    } else {
      currentTheme = new Theme({
        name: 'default',
        colors: defaultColors,
        isActive: true
      });
      await currentTheme.save();
    }

    res.json({ 
      message: 'تم إعادة تعيين الألوان للافتراضية',
      theme: currentTheme.colors 
    });
  } catch (error) {
    console.error('Reset theme error:', error);
    res.status(500).json({ message: 'خطأ في إعادة تعيين الألوان' });
  }
});

// Get theme history (Admin only)
router.get('/themes/history', adminAuth, async (req, res) => {
  try {
    const themes = await Theme.find({})
      .sort({ updatedAt: -1 })
      .limit(10);

    res.json({ themes });
  } catch (error) {
    console.error('Get theme history error:', error);
    res.status(500).json({ message: 'خطأ في جلب سجل الألوان' });
  }
});

module.exports = router;

// Add this to your server.js file - Theme route
// app.use('/api/admin', require('./routes/admin'));

// Add this to your app.js (frontend) - Theme loader for all pages
// Add this function to load theme on page load for all users

// Theme loader for frontend (add to app.js)
async function loadSiteTheme() {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/theme`);
    if (response.ok) {
      const data = await response.json();
      if (data.theme) {
        applyThemeToPage(data.theme);
      }
    }
  } catch (error) {
    console.error('Error loading site theme:', error);
    // Use default theme if loading fails
  }
}

function applyThemeToPage(theme) {
  const root = document.documentElement;
  root.style.setProperty('--primary-color', theme.primaryColor);
  root.style.setProperty('--secondary-color', theme.secondaryColor);
  root.style.setProperty('--accent-color', theme.accentColor);
  root.style.setProperty('--text-color', theme.textColor);
  root.style.setProperty('--light-text', theme.lightText);
  root.style.setProperty('--bg-color', theme.bgColor);
  root.style.setProperty('--border-color', theme.borderColor);
  root.style.setProperty('--gradient', `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`);
}

// Call this when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  loadSiteTheme();
});

// Export for global use
window.loadSiteTheme = loadSiteTheme;
window.applyThemeToPage = applyThemeToPage;