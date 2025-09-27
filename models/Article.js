const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [200, 'Title cannot be more than 200 characters']
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['حملي', 'طفلي', 'بيتي', 'كوزينتي', 'مدرستي', 'تحويستي', 'صحتي', 'ديني', 'الاسماء'],
        default: 'حملي'
    },
    excerpt: {
        type: String,
        required: [true, 'Excerpt is required'],
        trim: true,
        maxlength: [500, 'Excerpt cannot be more than 500 characters']
    },
    content: {
        type: String,
        required: [true, 'Content is required']
    },
    images: [{
        type: String
    }],
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    published: {
        type: Boolean,
        default: true
    },
    featured: {
        type: Boolean,
        default: false
    },
    views: {
        type: Number,
        default: 0
    },
    likes: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    tags: [{
        type: String,
        trim: true
    }],
    slug: {
        type: String,
        unique: true
    },
    metaDescription: {
        type: String,
        maxlength: [160, 'Meta description cannot be more than 160 characters']
    },
    readTime: {
        type: Number, // in minutes
        default: 5
    }
}, {
    timestamps: true
});

// Create slug from title before saving
ArticleSchema.pre('save', function(next) {
    if (this.isModified('title')) {
        this.slug = this.title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .trim();
    }
    
    // Calculate read time (approximately 200 words per minute)
    if (this.isModified('content')) {
        const wordCount = this.content.split(/\s+/).length;
        this.readTime = Math.max(1, Math.ceil(wordCount / 200));
    }
    
    next();
});

// Indexes
ArticleSchema.index({ title: 'text', content: 'text' });
ArticleSchema.index({ category: 1 });
ArticleSchema.index({ published: 1 });
ArticleSchema.index({ featured: 1 });
ArticleSchema.index({ createdAt: -1 });
ArticleSchema.index({ slug: 1 });

module.exports = mongoose.model('Article', ArticleSchema);
