// models/CallbackRequest.js
const mongoose = require('mongoose');

const CallbackRequestSchema = new mongoose.Schema({
  phone: { 
    type: String, 
    required: true,
    match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit phone number']
  },
  ipAddress: { type: String },
  userAgent: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'called', 'completed', 'cancelled'], 
    default: 'pending' 
  },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for faster querying
CallbackRequestSchema.index({ phone: 1 });
CallbackRequestSchema.index({ status: 1 });
CallbackRequestSchema.index({ createdAt: -1 });

// Update the updatedAt field before saving
CallbackRequestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CallbackRequest', CallbackRequestSchema);
