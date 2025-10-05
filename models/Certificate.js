// models/Certificate.js
const mongoose = require('mongoose');

const CertificateSchema = new mongoose.Schema({
  certificateId: { 
    type: String, 
    unique: true, 
    index: true 
  },
  student: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    studentId: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true }
  },
  course: {
    id: { type: String, required: true },
    title: { type: String, required: true },
    type: { type: String, required: true },
    duration: { type: String, required: true }
  },
  center: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Center', required: true },
    inst: { type: String, required: true },
    state: { type: String, required: true }
  },
  certificateType: {
    type: String,
    enum: ['completion', 'excellence', 'participation', 'achievement'],
    default: 'completion'
  },
  grade: {
    type: String,
    enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'Pass'],
    default: 'Pass'
  },
  issueDate: { type: Date, default: Date.now },
  validUntil: { type: Date }, // Optional expiry
  status: {
    type: String,
    enum: ['active', 'revoked', 'expired'],
    default: 'active'
  },
  issuedBy: {
    type: String,
    default: 'MIIT Skill Development Pvt Ltd'
  },
  verificationCode: { type: String, unique: true },
  metadata: {
    issuerName: { type: String, default: 'Super Admin' },
    issuerEmail: { type: String },
    notes: { type: String }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Generate certificate ID before save - FIXED VERSION
CertificateSchema.pre('save', async function (next) {
  if (this.certificateId) return next();
  
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // getMonth() returns 0-11, so add 1
    
    // Create proper date range for current month [web:219][web:213]
    const startOfMonth = new Date(year, now.getMonth(), 1); // First day of current month
    const endOfMonth = new Date(year, now.getMonth() + 1, 1); // First day of next month
    
    console.log('Date range for certificate count:', {
      startOfMonth: startOfMonth.toISOString(),
      endOfMonth: endOfMonth.toISOString()
    });
    
    // Count certificates this month
    const count = await mongoose.model('Certificate').countDocuments({
      createdAt: {
        $gte: startOfMonth,
        $lt: endOfMonth
      }
    });
    
    const seq = (count + 1).toString().padStart(4, '0');
    const monthStr = month.toString().padStart(2, '0');
    this.certificateId = `CERT${year}${monthStr}${seq}`;
    
    // Generate verification code
    this.verificationCode = `${this.certificateId}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    console.log('Generated certificate ID:', this.certificateId);
    
    next();
  } catch (error) {
    console.error('Certificate pre-save error:', error);
    next(error);
  }
});

// Update timestamp before save
CertificateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Indexes for better performance
CertificateSchema.index({ 'student._id': 1 });
// CertificateSchema.index({ certificateId: 1 });
// CertificateSchema.index({ verificationCode: 1 });
CertificateSchema.index({ status: 1 });
CertificateSchema.index({ issueDate: -1 });

module.exports = mongoose.model('Certificate', CertificateSchema);
