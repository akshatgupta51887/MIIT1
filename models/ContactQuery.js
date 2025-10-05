// models/ContactQuery.js
const mongoose = require('mongoose');

const ContactQuerySchema = new mongoose.Schema({
  fullname: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  phone: { 
    type: String, 
    required: true,
    match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit phone number']
  },
  message: { 
    type: String, 
    required: true
  },
  status: {
    type: String,
    enum: ['new', 'in-progress', 'resolved', 'closed'],
    default: 'new'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  ipAddress: { type: String },
  userAgent: { type: String },
  adminNotes: { type: String },
  assignedTo: { type: String },
  resolvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp before save
ContactQuerySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Indexes for better performance
ContactQuerySchema.index({ email: 1 });
ContactQuerySchema.index({ phone: 1 });
ContactQuerySchema.index({ status: 1 });
ContactQuerySchema.index({ createdAt: -1 });

module.exports = mongoose.model('ContactQuery', ContactQuerySchema);
