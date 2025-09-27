const mongoose = require('mongoose');

const ThemeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        default: 'default'
    },
    primaryColor: {
        type: String,
        required: true,
        default: '#d4a574'
    },
    secondaryColor: {
        type: String,
        required: true,
        default: '#f8e8d4'
    },
    textColor: {
        type: String,
        required: true,
        default: '#2c2c2c'
    },
    lightText: {
        type: String,
        default: '#666666'
    },
    bgColor: {
        type: String,
        default: '#fdfbf7'
    },
    borderColor: {
        type: String,
        default: '#e5d5c8'
    },
    accentColor: {
        type: String,
        default: '#b8860b'
    },
    isActive: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: String,
        default: 'admin'
    }
}, {
    timestamps: true
});

// Only one theme can be active at a time
ThemeSchema.pre('save', async function(next) {
    if (this.isActive) {
        await this.constructor.updateMany(
            { _id: { $ne: this._id } },
            { $set: { isActive: false } }
        );
    }
    next();
});

module.exports = mongoose.model('Theme', ThemeSchema);
