// models/Center.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const CenterSchema = new mongoose.Schema({
  cReg: { type: Number, default: 1 },
  fullname: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  // ADD PASSWORD FIELD
  passwordHash: { type: String, required: true },
  inst: { type: String },
  cenAdr: { type: String },
  state: { type: String },
  district: { type: String },
  city: { type: String },
  pincode: { type: String },
  tPC: { type: String },
  staffs: { type: String },
  phone: { type: String, required: true },
  files: {
    aadhar_f: String,
    aadhar_b: String,
    marksheet: String,
    registration_certificate: String,
    ch_img: String,
    ch_sign: String
  },
  rawBody: { type: mongoose.Schema.Types.Mixed },
  status: { type: String, default: 'pending' }, // pending/approved/rejected
  createdAt: { type: Date, default: Date.now }
});

// Methods for password handling
CenterSchema.methods.setPassword = async function(plainPassword) {
  const saltRounds = 10;
  this.passwordHash = await bcrypt.hash(plainPassword, saltRounds);
};

CenterSchema.methods.validatePassword = async function(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// Index for faster querying by state + status
CenterSchema.index({ state: 1, status: 1 });
// CenterSchema.index({ email: 1 });

module.exports = mongoose.model('Center', CenterSchema);
