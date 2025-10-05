// models/Student.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const StudentSchema = new mongoose.Schema({
  studentId: { type: String, unique: true, index: true }, // MIIT_YYYYXXXXX
  center: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Center', required: true },
    inst: String,
    cenAdr: String,
    state: String,
    phone: String
  },
  // FIXED: Properly define course as an embedded object schema
  course: {
    id: { type: String, required: true },
    title: { type: String, required: true },
    type: { type: String, default: '' },
    duration: { type: String, default: '' },
    subjects: [{ type: String }], // Array of strings
    semesters: { type: Number, default: 0 }
  },
  student: {
    name: { type: String, required: true },
    relation: { 
      type: String, 
      enum: ['Father', 'Mother', 'Husband', 'Guardian'], 
      required: true 
    },
    guardianName: { type: String, required: true },
    gender: { 
      type: String, 
      enum: ['Male', 'Female', 'Other'], 
      required: true 
    },
    dob: { type: Date, required: true },
    phone: { type: String, required: true },
    qualification: { type: String, required: true },
    address: { type: String, required: true }
  },
  auth: {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true }
  },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

// Generate studentId before save if missing: MIIT_<year><5 digits>
StudentSchema.pre('save', async function (next) {
  if (this.studentId) return next();
  
  try {
    const year = new Date().getFullYear();
    // Count students this year to generate next sequence
    const count = await mongoose.model('Student').countDocuments({
      createdAt: {
        $gte: new Date(`${year}-01-01T00:00:00.000Z`),
        $lt: new Date(`${year + 1}-01-01T00:00:00.000Z`)
      }
    });
    const seq = (count + 1).toString().padStart(5, '0');
    this.studentId = `MIIT_${year}${seq}`;
    next();
  } catch (error) {
    next(error);
  }
});

StudentSchema.methods.setPassword = async function (plain) {
  const saltRounds = 10;
  this.auth.passwordHash = await bcrypt.hash(plain, saltRounds);
};

StudentSchema.methods.validatePassword = async function (plain) {
  return bcrypt.compare(plain, this.auth.passwordHash);
};

// Add indexes for better performance
// StudentSchema.index({ 'auth.email': 1 });
// StudentSchema.index({ studentId: 1 });
StudentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Student', StudentSchema);
