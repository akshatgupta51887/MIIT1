// server.js
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcrypt');

// Import models
const Center = require('./models/Center');
const Student = require('./models/Student');
const CallbackRequest = require('./models/CallbackRequest');
const Certificate = require('./models/Certificate');
const ContactQuery = require('./models/ContactQuery');

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing middleware
app.use(express.json({ 
  limit: '5mb',
  strict: true,
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: '5mb'
}));

// FIXED: Simple in-memory session (no MongoDB store)
app.use(session({
  secret: 'MIIT_SECRET_KEY_2025_VERY_SECURE_CHANGE_IN_PRODUCTION',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 1000 * 60 * 60 * 4, // 4 hours
    httpOnly: true,
    secure: false, // Set to true only in HTTPS production
    sameSite: 'lax'
  }
}));

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://miitcomputereducation20_db_user:q4m3ZpV6SZL17LNe@cluster0.4o9bytx.mongodb.net/miit';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// CRITICAL: Auth middleware MUST be BEFORE all routes
app.use(async (req, res, next) => {
  // Initialize auth object with defaults
  res.locals.auth = {
    isStudentLoggedIn: false,
    isCenter: false, 
    student: null,
    center: null
  };

  try {
    // Check for student session
    if (req.session && req.session.studentId) {
      const student = await Student.findOne({ studentId: req.session.studentId }).lean();
      if (student) {
        res.locals.auth.isStudentLoggedIn = true;
        res.locals.auth.student = {
          id: student.studentId,
          name: student.student.name,
          email: student.auth.email
        };
      } else {
        req.session.studentId = null;
      }
    }

    // Check for center session
    if (req.session && req.session.centerId) {
      const center = await Center.findOne({ _id: req.session.centerId }).lean();
      if (center) {
        res.locals.auth.isCenter = true;
        res.locals.auth.center = {
          id: center._id,
          name: center.inst || center.fullname,
          email: center.email
        };
      } else {
        req.session.centerId = null;
      }
    }
  } catch (err) {
    console.error('Auth middleware error:', err);
  }

  next();
});

// Static course catalog
const COURSES = [
  { id: 'c01', title: 'Cyber security Basics & Online Security', type: 'Certificate', duration: '1 month', subjects: ['Understanding common cybersecurity threats','Basic principles of network security','Online security practices & hands-on exercises'], semesters: 0 },
  { id: 'c02', title: 'Data Analysis with Excel & Introduction to SQL', type: 'Certificate', duration: '1 month', subjects: ['Excel functions & data manipulation','Pivot tables & charts','Introduction to SQL & basic database queries'], semesters: 0 },
  { id: 'c03', title: 'Introduction to Programming with Python', type: 'Certificate', duration: '1 month', subjects: ['Basics of Python syntax and data types','Control flow and loops','Functions and basic problem-solving exercises'], semesters: 0 },
  { id: 'c04', title: 'Full Stack Web Development Bootcamp', type: 'Diploma', duration: '3 months', subjects: ['Front-end and back-end web development','HTML, CSS, JavaScript, Node.js, Express.js, and databases','Build real-world projects to showcase your skills'], semesters: 2 },
  { id: 'c05', title: 'Mobile App Development', type: 'Certificate', duration: '3 months', subjects: ['iOS (Swift) or Android (Java/Kotlin) app development','Building mobile applications from scratch','Understanding the app deployment process'], semesters: 0 },
  { id: 'c06', title: 'Digital Marketing Course', type: 'Certificate', duration: '3 months', subjects: ['Digital marketing strategies, SEO, social media marketing, and analytics','Creating and managing online advertising campaigns','Content marketing and email marketing'], semesters: 0 },
  { id: 'c07', title: 'Cyber security Fundamentals', type: 'Certificate', duration: '3 months', subjects: ['Basics of cybersecurity and ethical hacking','Network security, encryption, and vulnerability assessment','Common cybersecurity threats and countermeasures'], semesters: 0 },
  { id: 'c08', title: '3D Modeling and Animation', type: 'Certificate', duration: '3 months', subjects: ['Introduction to 3D modeling software (Blender, Maya, 3ds Max)','Basics of 3D animation and rendering','Creating 3D models and animations'], semesters: 0 },
  { id: 'c09', title: 'E-learning Design', type: 'Certificate', duration: '3 months', subjects: ['Design principles for e-learning courses','Instructional design and user engagement in online education','Designing e-learning modules'], semesters: 0 },
  { id: 'c10', title: 'Motion Graphics', type: 'Certificate', duration: '3 months', subjects: ['Animation and motion graphics principles','Software like Adobe After Effects or Cinema 4D','Creating animated graphics and videos'], semesters: 0 },
  { id: 'c11', title: 'Graphic Design', type: 'Certificate', duration: '3 months', subjects: ['Design principles, color theory, and typography','Adobe Photoshop, Illustrator, and InDesign','Portfolio-building projects'], semesters: 0 },
  { id: 'c12', title: 'Intermediate Programming and Database Management', type: 'Certificate', duration: '3 months', subjects: ['Intermediate Programming Concepts','Database Fundamentals','Project Work'], semesters: 0 },
  { id: 'c13', title: 'Tally', type: 'Certificate', duration: '3 months', subjects: ['Creating and Managing Company Data, Financial Accounting','Inventory Management, Voucher Entry, Taxation, Bank Reconciliation','Financial Statements, Multi-Currency Transactions, Data Backup and Restore'], semesters: 0 },
  { id: 'c14', title: 'Advance Excel', type: 'Certificate', duration: '3 months', subjects: ['Data Analysis and Visualization','Advanced Formulas and Functions','Macros and Automation, Advanced Charting, Dashboards, and Reporting'], semesters: 0 },
  { id: 'c15', title: 'Certificate in DTP', type: 'Certificate', duration: '3 months', subjects: ['Desktop Publishing, Graphic Design Basics, Typography, Page Layout Software','Image Editing, Creating and Formatting Text, Working with Graphics','Layout and Composition, Printing and Output, Project Work'], semesters: 0 },
  { id: 'c16', title: 'Certificate in Data Entry Operator', type: 'Certificate', duration: '3 months', subjects: ['Data Entry Techniques and Keyboarding Skills','Data Verification, Formatting, and Security','Time Management, Quality Control, and Workplace Professionalism'], semesters: 0 },
  { id: 'c17', title: 'Introduction Of Computer Fundamental', type: 'Certificate', duration: '3 months', subjects: ['Operating System Basics','Notepad, WordPad, and Ms Paint','Practical Assignments'], semesters: 0 },
  { id: 'c18', title: 'Certificate In Office Application', type: 'Certificate', duration: '3 months', subjects: ['Computer Fundamentals','Ms Word, Ms Excel, Ms PowerPoint'], semesters: 0 },
  { id: 'c19', title: 'Certificate in BUSY', type: 'Certificate', duration: '3 months', subjects: ['Fundamentals of Accounting','Busy with GST','Internet Basics'], semesters: 0 },
  { id: 'c20', title: 'Certificate in C Programming', type: 'Certificate', duration: '3 months', subjects: ['Foundations of C Programming','Advanced C Programming','Advanced Topics and Practical Applications'], semesters: 0 },
  { id: 'c21', title: 'Certificate in Search Engine Optimization (SEO)', type: 'Certificate', duration: '3 months', subjects: ['Keyword Research, On-Page and Off-Page SEO, Technical SEO','Link Building, Local SEO, Analytics, and Monitoring','Mobile Optimization, Voice Search Optimization, E-A-T, SEO Audits'], semesters: 0 },
  { id: 'c22', title: 'Certificate in Word Press Designing', type: 'Certificate', duration: '3 months', subjects: ['Domain and Hosting Setup, Theme Installation','Customization, Plugins, and Page Creation','SEO Optimization, Mobile Responsiveness, Backup and Testing'], semesters: 0 },
  { id: 'c23', title: 'Advanced Computer Skills Certificate Program', type: 'Certificate', duration: '6 months', subjects: ['Foundations of Computing','Programming and Software Development','Web Development and Design','Database Management','Networking and Cybersecurity'], semesters: 0 },
  { id: 'c24', title: 'Advanced Computer Skills Certificate Program', type: 'Certificate', duration: '6 months', subjects: ['Foundations of Computing','Programming and Software Development','Web Development and Design','Database Management','Networking and Cybersecurity','Emerging Technologies','Project Management and Agile Methodologies','Final Project and Capstone'], semesters: 0 },
  { id: 'c25', title: 'Professional Diploma in Computer Applications', type: 'Diploma', duration: '6 months', subjects: ['Introduction to Computing','Programming Foundation'], semesters: 2 }
];

// Helper functions
function ensureStudent(req, res, next) {
  if (req.session && req.session.studentId) return next();
  return res.redirect('/student-login');
}

function ensureCenter(req, res, next) {
  if (req.session && req.session.centerId) return next();
  return res.redirect('/center-login');
}

function ensureSuperAdmin(req, res, next) {
  if (req.session && req.session.superAdmin) return next();
  return res.redirect('/super-admin-login');
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// === ROUTES START HERE ===

// Main page routes
app.get('/', (req, res) => res.render('landing/index'));
app.get('/register-with-miit', (req, res) => res.render('register/index'));

// Student routes
app.get('/student-admission', (req, res) => {
  res.render('student-admission/index');
});

app.get('/student-login', (req, res) => {
  if (req.session && req.session.studentId) return res.redirect('/student-dashboard');
  res.render('student-login/index', { error: null });
});

// FIXED: Student login
app.post('/student-login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    console.log('🔐 Student login attempt:', { email: email ? 'provided' : 'missing' });
    
    if (!email || !password) {
      return res.render('student-login/index', { error: 'Email and password are required.' });
    }

    const student = await Student.findOne({ 'auth.email': email.toLowerCase().trim() });
    
    if (!student) {
      return res.render('student-login/index', { error: 'Invalid credentials.' });
    }

    const isValid = await student.validatePassword(password);
    
    if (!isValid) {
      return res.render('student-login/index', { error: 'Invalid credentials.' });
    }

    // Simple session assignment
    req.session.studentId = student.studentId;
    console.log('✅ Student logged in:', student.studentId);
    
    return res.redirect('/student-dashboard');

  } catch (e) {
    console.error('❌ Student login error:', e);
    return res.render('student-login/index', { error: 'Server error' });
  }
});

app.get('/student-dashboard', ensureStudent, async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.session.studentId }).lean();
    if (!student) {
      req.session.studentId = null;
      return res.redirect('/student-login');
    }
    res.render('student-dashboard/index', { student });
  } catch (error) {
    console.error('Student dashboard error:', error);
    req.session.studentId = null;
    return res.redirect('/student-login');
  }
});

app.get('/student-logout', (req, res) => {
  req.session.studentId = null;
  res.redirect('/student-login');
});

// Center routes
app.get('/center-login', (req, res) => {
  if (req.session && req.session.centerId) return res.redirect('/center-dashboard');
  res.render('center-login/index', { error: null });
});

// FIXED: Center login
app.post('/center-login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    console.log('🔐 Center login attempt:', { email: email ? 'provided' : 'missing' });
    
    if (!email || !password) {
      return res.render('center-login/index', { error: 'Email and password are required.' });
    }

    const center = await Center.findOne({ 
      email: email.toLowerCase().trim(), 
      status: 'approved' 
    });
    
    if (!center) {
      return res.render('center-login/index', { error: 'Invalid credentials or center not approved.' });
    }

    const isValid = await center.validatePassword(password);
    
    if (!isValid) {
      return res.render('center-login/index', { error: 'Invalid credentials.' });
    }

    // Simple session assignment
    req.session.centerId = center._id;
    console.log('✅ Center logged in:', center._id);
    
    return res.redirect('/center-dashboard');

  } catch (e) {
    console.error('❌ Center login error:', e);
    return res.render('center-login/index', { error: 'Server error' });
  }
});

app.get('/center-dashboard', ensureCenter, async (req, res) => {
  try {
    const center = await Center.findOne({ _id: req.session.centerId }).lean();
    if (!center) {
      req.session.centerId = null;
      return res.redirect('/center-login');
    }
    res.render('center-dashboard/index', { center });
  } catch (error) {
    console.error('Center dashboard error:', error);
    req.session.centerId = null;
    return res.redirect('/center-login');
  }
});

app.get('/center-logout', (req, res) => {
  req.session.centerId = null;
  res.redirect('/center-login');
});

// Super Admin Authentication
const SUPER_ADMIN_EMAIL = 'admin@miit.in';
const SUPER_ADMIN_PASSWORD = 'MIIT@2025';

app.get('/super-admin-login', (req, res) => {
  if (req.session && req.session.superAdmin) return res.redirect('/super-admin-dashboard');
  res.render('super-admin/login', { error: null });
});

// FIXED: Super admin login
app.post('/super-admin-login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    console.log('🔐 Super admin login attempt:', { email: email ? 'provided' : 'missing' });
    
    if (email === SUPER_ADMIN_EMAIL && password === SUPER_ADMIN_PASSWORD) {
      req.session.superAdmin = true;
      console.log('✅ Super admin logged in');
      return res.redirect('/super-admin-dashboard');
    } else {
      return res.render('super-admin/login', { error: 'Invalid credentials.' });
    }
  } catch (error) {
    console.error('❌ Super admin login error:', error);
    return res.render('super-admin/login', { error: 'Server error' });
  }
});

app.get('/super-admin-logout', (req, res) => {
  req.session.superAdmin = null;
  res.redirect('/super-admin-login');
});

// API routes
app.get('/api/centers/by-state', async (req, res) => {
  try {
    const rawState = (req.query.state || '').trim();
    if (!rawState) return res.json({ ok: true, centers: [] });

    const escaped = escapeRegExp(rawState);
    const stateRegex = new RegExp(`^${escaped}$`, 'i');

    const centers = await Center.find({ state: { $regex: stateRegex }, status: 'approved' })
      .select('inst cenAdr state phone createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const payload = centers.map(c => ({
      _id: c._id,
      inst: c.inst || '',
      cenAdr: c.cenAdr || '',
      state: c.state || '',
      phone: c.phone || ''
    }));

    return res.json({ ok: true, centers: payload });
  } catch (e) {
    console.error('by-state error', e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});
app.get('/skills-test', (req, res) => {
  res.render('miit-skills-test');
});

app.get('/api/courses', (req, res) => {
  res.json({ ok: true, courses: COURSES });
});

app.get('/api/courses/:id', (req, res) => {
  const c = COURSES.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ ok: false, error: 'Course not found' });
  res.json({ ok: true, course: c });
});

// Student admission API
// Student admission API - UPDATED for online/offline mode
app.post('/api/student-admission', async (req, res) => {
  try {
    const {
      studyMode, // NEW: online or offline
      state, center_id, course_id,
      student_name, s_rel, father_name,
      s_gender, dob, s_phone, qualification, s_address,
      email, password
    } = req.body || {};

    console.log('📝 Admission request:', {
      studyMode,
      state, center_id, course_id, student_name, email
    });

    // Basic validations - FIXED: Check studyMode first
    const mode = studyMode || 'offline';
    
    // FIXED: For offline mode, center is required
    if (mode === 'offline') {
      if (!state) return res.status(400).json({ ok: false, error: 'State is required for offline mode' });
      if (!center_id) return res.status(400).json({ ok: false, error: 'Center is required for offline mode' });
    }
    
    if (!course_id) return res.status(400).json({ ok: false, error: 'Course is required' });
    if (!student_name || !s_rel || !father_name || !s_gender || !dob || !s_phone || !qualification || !s_address) {
      return res.status(400).json({ ok: false, error: 'All student fields are required' });
    }
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Email and password are required' });

    // Validate center for offline mode only
    let center = null;
    if (mode === 'offline') {
      center = await Center.findOne({ _id: center_id, status: 'approved' }).lean();
      if (!center) return res.status(400).json({ ok: false, error: 'Invalid or unapproved center' });
    }

    const course = COURSES.find(c => c.id === course_id);
    if (!course) return res.status(400).json({ ok: false, error: 'Invalid course' });

    if (!/^[6-9]\d{9}$/.test(s_phone)) {
      return res.status(400).json({ ok: false, error: 'Invalid phone number' });
    }

    const exists = await Student.findOne({ 'auth.email': email.toLowerCase().trim() });
    if (exists) return res.status(400).json({ ok: false, error: 'Email already registered' });

    // Build student data based on mode
    const studentData = {
      studyMode: mode, // Add study mode
      course: {
        id: course.id,
        title: course.title,
        type: course.type || '',
        duration: course.duration || '',
        subjects: Array.isArray(course.subjects) ? course.subjects : [],
        semesters: typeof course.semesters === 'number' ? course.semesters : 0
      },
      student: {
        name: student_name.trim(),
        relation: s_rel === '0' ? 'Father' : s_rel === '1' ? 'Mother' : s_rel === '2' ? 'Husband' : 'Guardian',
        guardianName: father_name.trim(),
        gender: s_gender,
        dob: new Date(dob),
        phone: s_phone.trim(),
        qualification: qualification.trim(),
        address: s_address.trim()
      },
      auth: {
        email: email.trim().toLowerCase()
      }
    };

    // Set center data based on mode
    if (mode === 'online') {
      // For online students - no physical center
      studentData.center = {
        _id: null,
        inst: 'Online',
        cenAdr: 'N/A',
        state: 'N/A',
        phone: 'N/A'
      };
    } else {
      // For offline students - use selected center
      studentData.center = {
        _id: center._id,
        inst: center.inst || '',
        cenAdr: center.cenAdr || '',
        state: center.state || '',
        phone: center.phone || ''
      };
    }

    const st = new Student(studentData);
    await st.setPassword(password);
    await st.save();

    // Auto-login
    req.session.studentId = st.studentId;

    res.json({
      ok: true,
      message: 'Admission successful.',
      studentId: st.studentId,
      studyMode: mode,
      center: mode === 'online' 
        ? { inst: 'Online', cenAdr: 'N/A' } 
        : { inst: center.inst || '', cenAdr: center.cenAdr || '' }
    });

  } catch (e) {
    console.error('❌ admission error', e);
    
    if (e.code === 11000) {
      if (e.message.includes('auth.email')) {
        return res.status(400).json({ ok: false, error: 'Email already registered' });
      }
      if (e.message.includes('studentId')) {
        return res.status(400).json({ ok: false, error: 'Student ID conflict, please try again' });
      }
      return res.status(400).json({ ok: false, error: 'Duplicate entry detected' });
    }
    
    if (e.name === 'ValidationError') {
      const errors = Object.values(e.errors).map(err => err.message);
      return res.status(400).json({ ok: false, error: `Validation failed: ${errors.join(', ')}` });
    }
    
    return res.status(500).json({ ok: false, error: 'Server error during admission' });
  }
});


// Multer setup for file uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\.-]/g, '');
    cb(null, Date.now() + '-' + safeName);
  }
});

function fileFilter (req, file, cb) {
  const allowedImage = /^image\//;
  const allowedPdf = file.mimetype === 'application/pdf';
  if (allowedImage.test(file.mimetype) || allowedPdf) {
    cb(null, true);``
  } else {
    cb(null, false);
  }
}

const upload = multer({ storage, fileFilter });
const multerFields = upload.fields([
  { name: 'aadhar_f', maxCount: 1 },
  { name: 'aadhar_b', maxCount: 1 },
  { name: 'marksheet', maxCount: 1 },
  { name: 'registration_certificate', maxCount: 1 },
  { name: 'ch_img', maxCount: 1 },
  { name: 'ch_sign', maxCount: 1 }
]);

// Center registration
app.post('/register', (req, res) => {
  multerFields(req, res, async function (err) {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ ok: false, error: 'File upload error' });
    }

    try {
      const {
        cReg, fullname, email, password, confirmPassword, inst, cenAdr, state, district,
        city, pincode, tPC, staffs, phone, pss, passport, signature
      } = req.body;

      if (!fullname || !email || !phone) {
        return res.status(400).json({ ok: false, error: 'fullname, email and phone are required' });
      }

      if (!password || !confirmPassword) {
        return res.status(400).json({ ok: false, error: 'Password and confirm password are required' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ ok: false, error: 'Passwords do not match' });
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({ 
          ok: false, 
          error: 'Password must contain at least 8 characters, one uppercase, one lowercase, and one number' 
        });
      }

      const existingCenter = await Center.findOne({ email: email });
      if (existingCenter) {
        return res.status(400).json({ ok: false, error: 'Email already registered' });
      }

      const filePath = (field) => {
        if (req.files && req.files[field] && req.files[field][0]) {
          return path.join('uploads', req.files[field][0].filename);
        }
        return null;
      };

      const centerDoc = new Center({
        cReg: cReg || 1,
        fullname,
        email,
        inst,
        cenAdr,
        state,
        district,
        city,
        pincode,
        tPC,
        staffs,
        phone,
        files: {
          aadhar_f: filePath('aadhar_f'),
          aadhar_b: filePath('aadhar_b'),
          marksheet: filePath('marksheet'),
          registration_certificate: filePath('registration_certificate'),
          ch_img: filePath('ch_img') || passport || null,
          ch_sign: filePath('ch_sign') || signature || null,
        },
        rawBody: req.body
      });

      await centerDoc.setPassword(password);
      await centerDoc.save();

      return res.json({
        ok: true,
        message: 'Registration received',
        id: centerDoc._id,
        email: centerDoc.email
      });

    } catch (e) {
      console.error('Registration error:', e);
      if (e.code === 11000) {
        return res.status(400).json({ ok: false, error: 'Email already exists' });
      }
      return res.status(500).json({ ok: false, error: 'Server error' });
    }
  });
});

// Gallery routes
const galleryDir = path.join(__dirname, 'public', 'images', 'MIITImages');
let _galleryCache = { mtimeMs: 0, files: [] };

function loadGalleryFiles(force = false) {
  try {
    if (!fs.existsSync(galleryDir)) {
      console.warn('[gallery] directory not found:', galleryDir);
      _galleryCache = { mtimeMs: 0, files: [] };
      return _galleryCache.files;
    }

    const stat = fs.statSync(galleryDir);
    if (force || !_galleryCache.files.length || stat.mtimeMs !== _galleryCache.mtimeMs) {
      const raw = fs.readdirSync(galleryDir);
      const files = raw.filter(f => {
        const full = path.join(galleryDir, f);
        try { return fs.statSync(full).isFile(); } catch (e) { return false; }
      });

      files.sort((a, b) => {
        const na = parseInt(a.replace(/\D/g, ''), 10) || 0;
        const nb = parseInt(b.replace(/\D/g, ''), 10) || 0;
        if (na === nb) return a.localeCompare(b);
        return na - nb;
      });

      _galleryCache = { mtimeMs: stat.mtimeMs, files };
    }
    return _galleryCache.files;
  } catch (err) {
    console.error('[gallery] load error', err);
    return [];
  }
}

app.get('/api/gallery', (req, res) => {
  try {
    let page = parseInt(req.query.page, 10);
    let perPage = parseInt(req.query.perPage, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(perPage) || perPage < 1) perPage = 12;

    const MAX_PER_PAGE = 100;
    perPage = Math.min(perPage, MAX_PER_PAGE);

    const files = loadGalleryFiles();
    const total = files.length;
    const pages = total === 0 ? 1 : Math.ceil(total / perPage);
    if (page > pages) page = pages;

    const start = (page - 1) * perPage;
    const pageFiles = files.slice(start, start + perPage);
    const images = pageFiles.map(filename => path.posix.join('/images/MIITImages', filename));

    return res.json({
      ok: true,
      total,
      perPage,
      page,
      pages,
      images
    });
  } catch (err) {
    console.error('/api/gallery error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Other page routes
app.get('/miit-gallery', (req, res) => res.render('gallery/index'));
app.get('/top-miit-centers', (req, res) => res.render('top-centers/index'));
app.get('/miit-course-list', (req, res) => res.render('course-list/index'));
app.get('/miit-center-list', (req, res) => res.render('center-list/index'));
app.get('/about-miit', (req, res) => res.render('about/index'));
app.get('/why-miit', (req, res) => res.render('about/why'));
app.get('/miit-faq', (req, res) => res.render('FAQ/index'));
app.get('/contact-miit', (req, res) => res.render('about/contact'));
app.get('/pp-nceb', (req, res) => res.render('privacy/pp'));
app.get('/tc-nceb', (req, res) => res.render('privacy/index'));
app.get('/cr-miit', (req, res) => res.render('privacy/cr'));
app.get('/sitemap-miit', (req, res) => res.render('privacy/sm'));

// Verification routes
app.post('/center-verification', async (req, res) => {
  try {
    const { center_id } = req.body;

    if (!center_id || typeof center_id !== 'string') {
      return res.status(400).render('verification-result', {
        type: 'center',
        success: false,
        error: 'Center ID is required',
        data: null
      });
    }

    const cleanCenterId = center_id.trim();
    if (!cleanCenterId) {
      return res.status(400).render('verification-result', {
        type: 'center',
        success: false,
        error: 'Please enter a valid Center ID',
        data: null
      });
    }

    let center = null;
    
    if (/^[0-9a-fA-F]{24}$/.test(cleanCenterId)) {
      center = await Center.findById(cleanCenterId)
        .select('fullname inst email phone state city status createdAt')
        .lean();
    }
    
    if (!center) {
      center = await Center.findOne({
        $or: [
          { inst: new RegExp(cleanCenterId, 'i') },
          { email: new RegExp(cleanCenterId, 'i') },
          { phone: cleanCenterId },
          { fullname: new RegExp(cleanCenterId, 'i') }
        ]
      })
      .select('fullname inst email phone state city status createdAt')
      .lean();
    }

    if (!center) {
      return res.render('verification-result', {
        type: 'center',
        success: false,
        error: 'Center not found. Please check the Center ID and try again.',
        data: null
      });
    }

    res.render('verification-result', {
      type: 'center',
      success: true,
      error: null,
      data: {
        id: center._id,
        name: center.fullname,
        institute: center.inst,
        email: center.email,
        phone: center.phone,
        location: `${center.city}, ${center.state}`,
        status: center.status,
        registeredOn: new Date(center.createdAt).toLocaleDateString('en-IN'),
        verified: center.status === 'approved'
      }
    });

  } catch (error) {
    console.error('Center verification error:', error);
    res.status(500).render('verification-result', {
      type: 'center',
      success: false,
      error: 'Server error. Please try again later.',
      data: null
    });
  }
});

app.post('/student-verification', async (req, res) => {
  try {  
    const { student_id } = req.body;

    if (!student_id || typeof student_id !== 'string') {
      return res.status(400).render('verification-result', {
        type: 'student',
        success: false,
        error: 'Student ID is required',
        data: null
      });
    }

    const cleanStudentId = student_id.trim().toUpperCase();
    if (!cleanStudentId) {
      return res.status(400).render('verification-result', {
        type: 'student',
        success: false,
        error: 'Please enter a valid Student ID',
        data: null
      });
    }

    let student = null;

    student = await Student.findOne({ studentId: cleanStudentId })
      .select('studentId student center course auth status createdAt')
      .lean();

    if (!student) {
      student = await Student.findOne({
        $or: [
          { 'auth.email': new RegExp(cleanStudentId, 'i') },
          { 'student.name': new RegExp(cleanStudentId, 'i') }
        ]
      })
      .select('studentId student center course auth status createdAt')
      .lean();
    }

    if (!student) {
      return res.render('verification-result', {
        type: 'student',
        success: false,
        error: 'Student not found. Please check the Student ID and try again.',
        data: null
      });
    }

    res.render('verification-result', {
      type: 'student',
      success: true,
      error: null,
      data: {
        studentId: student.studentId,
        name: student.student.name,
        email: student.auth?.email || 'N/A',
        phone: student.student.phone,
        center: student.center.inst,
        centerLocation: student.center.state,
        course: student.course.title,
        courseType: student.course.type,
        courseDuration: student.course.duration,
        status: student.status,
        enrolledOn: new Date(student.createdAt).toLocaleDateString('en-IN'),
        verified: student.status === 'active'
      }
    });

  } catch (error) {
    console.error('Student verification error:', error);
    res.status(500).render('verification-result', {
      type: 'student', 
      success: false,
      error: 'Server error. Please try again later.',
      data: null
    });
  }
});

// Certificate routes
app.get('/super-admin/certificates', ensureSuperAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const status = req.query.status || 'all';
    const search = req.query.search || '';

    let filter = {};
    if (status !== 'all') filter.status = status;
    if (search) {
      filter.$or = [
        { certificateId: new RegExp(search, 'i') },
        { 'student.name': new RegExp(search, 'i') },
        { 'student.studentId': new RegExp(search, 'i') },
        { 'course.title': new RegExp(search, 'i') }
      ];
    }

    const total = await Certificate.countDocuments(filter);
    const certificates = await Certificate.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.render('super-admin/certificates', {
      certificates,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        total
      },
      filters: { status, search }
    });
  } catch (error) {
    console.error('Certificates page error:', error);
    res.render('super-admin/certificates', { 
      certificates: [], 
      pagination: {}, 
      filters: {}, 
      error: 'Failed to load certificates' 
    });
  }
});

app.get('/super-admin/certificates/issue', ensureSuperAdmin, async (req, res) => {
  try {
    const students = await Student.find({ status: 'active' })
      .select('studentId student.name auth.email center course')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.render('super-admin/issue-certificate', { students });
  } catch (error) {
    console.error('Issue certificate page error:', error);
    res.render('super-admin/issue-certificate', { students: [], error: 'Failed to load students' });
  }
});

app.post('/super-admin/certificates/issue', ensureSuperAdmin, async (req, res) => {
  try {
    const { studentId, certificateType, grade, validUntil, notes } = req.body;

    console.log('📜 Certificate issue request for studentId:', studentId);

    if (!studentId) {
      return res.status(400).json({ ok: false, error: 'Student ID is required' });
    }

    const student = await Student.findOne({ studentId: studentId }).lean();
    if (!student) {
      return res.status(400).json({ ok: false, error: 'Student not found' });
    }

    console.log('✅ Student found:', {
      studentId: student.studentId,
      name: student.student.name,
      studyMode: student.studyMode,
      centerId: student.center?._id
    });

    // Check if certificate already exists
    const existingCert = await Certificate.findOne({ 'student._id': student._id });
    if (existingCert) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Certificate already issued for this student' 
      });
    }

    // ✅ FIXED: Handle center data based on study mode
    const certificateData = {
      student: {
        _id: student._id,
        studentId: student.studentId,
        name: student.student.name,
        email: student.auth.email
      },
      course: {
        id: student.course.id,
        title: student.course.title,
        type: student.course.type,
        duration: student.course.duration
      },
      certificateType: certificateType || 'completion',
      grade: grade || 'Pass',
      validUntil: validUntil ? new Date(validUntil) : null,
      metadata: {
        issuerName: 'Super Admin',
        notes: notes || ''
      }
    };

    // ✅ FIXED: Set center based on study mode
    if (student.studyMode === 'online' || !student.center._id) {
      // For online students - set center with defaults
      certificateData.center = {
        _id: null,
        inst: 'Online',
        state: 'N/A'
      };
      console.log('📝 Creating certificate for ONLINE student');
    } else {
      // For offline students - use actual center data
      certificateData.center = {
        _id: student.center._id,
        inst: student.center.inst || 'Unknown Center',
        state: student.center.state || 'N/A'
      };
      console.log('📝 Creating certificate for OFFLINE student');
    }

    const certificate = new Certificate(certificateData);
    await certificate.save();

    console.log('✅ Certificate created successfully:', certificate.certificateId);

    res.json({
      ok: true,
      message: 'Certificate issued successfully',
      certificateId: certificate.certificateId,
      verificationCode: certificate.verificationCode
    });

  } catch (error) {
    console.error('❌ Issue certificate error:', error);
    
    // Better error messages
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ 
        ok: false, 
        error: `Validation failed: ${errors.join(', ')}` 
      });
    }
    
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to issue certificate: ' + error.message 
    });
  }
});


app.post('/super-admin/certificates/:id/revoke', ensureSuperAdmin, async (req, res) => {
  try {
    await Certificate.findByIdAndUpdate(req.params.id, { 
      status: 'revoked',
      updatedAt: new Date()
    });
    res.json({ ok: true, message: 'Certificate revoked successfully' });
  } catch (error) {
    console.error('Revoke certificate error:', error);
    res.status(500).json({ ok: false, error: 'Failed to revoke certificate' });
  }
});

app.get('/api/student/certificates', ensureStudent, async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.session.studentId }).lean();
    if (!student) {
      return res.status(404).json({ ok: false, error: 'Student not found' });
    }

    const certificates = await Certificate.find({ 'student._id': student._id })
      .sort({ issueDate: -1 })
      .lean();

    res.json({ ok: true, certificates });
  } catch (error) {
    console.error('Student certificates error:', error);
    res.status(500).json({ ok: false, error: 'Failed to load certificates' });
  }
});

app.post('/verify-certificate', async (req, res) => {
  try {
    const { cert_no } = req.body;

    if (!cert_no || typeof cert_no !== 'string') {
      return res.render('certificate-verification-result', {
        success: false,
        error: 'Certificate number is required',
        certificate: null,
        searchQuery: cert_no || ''
      });
    }

    const cleanCertNo = cert_no.trim().toUpperCase();
    if (!cleanCertNo) {
      return res.render('certificate-verification-result', {
        success: false,
        error: 'Please enter a valid certificate number',
        certificate: null,
        searchQuery: cert_no
      });
    }

    let certificate = null;

    certificate = await Certificate.findOne({ 
      certificateId: new RegExp(cleanCertNo, 'i'),
      status: 'active'
    }).lean();

    if (!certificate) {
      certificate = await Certificate.findOne({
        verificationCode: new RegExp(cleanCertNo, 'i'),
        status: 'active'
      }).lean();
    }

    if (!certificate) {
      certificate = await Certificate.findOne({
        'student.studentId': new RegExp(cleanCertNo, 'i'),
        status: 'active'
      }).lean();
    }

    if (!certificate) {
      return res.render('certificate-verification-result', {
        success: false,
        error: 'Certificate not found or has been revoked. Please check the certificate number and try again.',
        certificate: null,
        searchQuery: cleanCertNo
      });
    }

    if (certificate.validUntil && new Date() > certificate.validUntil) {
      return res.render('certificate-verification-result', {
        success: false,
        error: 'Certificate has expired.',
        certificate: null,
        searchQuery: cleanCertNo
      });
    }

    res.render('certificate-verification-result', {
      success: true,
      error: null,
      certificate: {
        certificateId: certificate.certificateId,
        verificationCode: certificate.verificationCode,
        studentName: certificate.student.name,
        studentId: certificate.student.studentId,
        studentEmail: certificate.student.email,
        course: certificate.course.title,
        courseType: certificate.course.type,
        duration: certificate.course.duration,
        center: certificate.center.inst,
        centerLocation: certificate.center.state,
        certificateType: certificate.certificateType,
        grade: certificate.grade,
        issueDate: certificate.issueDate,
        validUntil: certificate.validUntil,
        issuedBy: certificate.issuedBy,
        status: certificate.status,
        notes: certificate.metadata?.notes || null
      },
      searchQuery: cleanCertNo
    });

  } catch (error) {
    console.error('Certificate verification error:', error);
    res.render('certificate-verification-result', {
      success: false,
      error: 'Server error. Please try again later.',
      certificate: null,
      searchQuery: cert_no || ''
    });
  }
});

// Contact & Callback routes
app.post('/api/contact', async (req, res) => {
  try {
    const { fullname, email, phone, message } = req.body;

    if (!fullname || !email || !phone || !message) {
      return res.status(400).json({ 
        ok: false, 
        error: 'All fields are required' 
      });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Please enter a valid 10-digit phone number starting with 6-9' 
      });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Please enter a valid email address' 
      });
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentQuery = await ContactQuery.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { phone: cleanPhone }
      ],
      createdAt: { $gte: fiveMinutesAgo }
    });

    if (recentQuery) {
      return res.status(400).json({ 
        ok: false, 
        error: 'You have already submitted a query recently. Please wait before submitting again.' 
      });
    }

    const contactQuery = new ContactQuery({
      fullname: fullname.trim(),
      email: email.toLowerCase().trim(),
      phone: cleanPhone,
      message: message.trim(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });

    await contactQuery.save();

    res.json({ 
      ok: true, 
      message: 'Thank you for contacting us! We will get back to you soon.' 
    });

  } catch (error) {
    console.error('Contact form error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ 
        ok: false, 
        error: errors.join(', ') 
      });
    }

    res.status(500).json({ 
      ok: false, 
      error: 'Server error. Please try again later.' 
    });
  }
});

app.get('/super-admin/contact-queries', ensureSuperAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const status = req.query.status || 'all';
    const priority = req.query.priority || 'all';
    const search = req.query.search || '';

    let filter = {};
    if (status !== 'all') filter.status = status;
    if (priority !== 'all') filter.priority = priority;
    if (search) {
      filter.$or = [
        { fullname: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') },
        { message: new RegExp(search, 'i') }
      ];
    }

    const total = await ContactQuery.countDocuments(filter);
    const queries = await ContactQuery.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.render('super-admin/contact-queries', {
      queries,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        total
      },
      filters: { status, priority, search }
    });
  } catch (error) {
    console.error('Contact queries page error:', error);
    res.render('super-admin/contact-queries', { 
      queries: [], 
      pagination: {}, 
      filters: {}, 
      error: 'Failed to load contact queries' 
    });
  }
});

app.post('/super-admin/contact-query/:id/update', ensureSuperAdmin, async (req, res) => {
  try {
    const { status, priority, adminNotes, assignedTo } = req.body;
    
    const updateData = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (adminNotes) updateData.adminNotes = adminNotes;
    if (assignedTo) updateData.assignedTo = assignedTo;
    
    if (status === 'resolved' || status === 'closed') {
      updateData.resolvedAt = new Date();
    }

    await ContactQuery.findByIdAndUpdate(req.params.id, updateData);
    res.json({ ok: true, message: 'Query updated successfully' });
  } catch (error) {
    console.error('Query update error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update query' });
  }
});

app.delete('/super-admin/contact-query/:id/delete', ensureSuperAdmin, async (req, res) => {
  try {
    await ContactQuery.findByIdAndDelete(req.params.id);
    res.json({ ok: true, message: 'Query deleted successfully' });
  } catch (error) {
    console.error('Query delete error:', error);
    res.status(500).json({ ok: false, error: 'Failed to delete query' });
  }
});

app.get('/super-admin/callbacks', ensureSuperAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const status = req.query.status || 'all';
    const search = req.query.search || '';

    let filter = {};
    if (status !== 'all') filter.status = status;
    if (search) {
      filter.phone = new RegExp(search, 'i');
    }

    const total = await CallbackRequest.countDocuments(filter);
    const callbacks = await CallbackRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.render('super-admin/callbacks', {
      callbacks,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        total
      },
      filters: { status, search }
    });
  } catch (error) {
    console.error('Callbacks page error:', error);
    res.render('super-admin/callbacks', { 
      callbacks: [], 
      pagination: {}, 
      filters: {}, 
      error: 'Failed to load callback requests' 
    });
  }
});

app.post('/super-admin/callback/:id/status', ensureSuperAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const validStatuses = ['pending', 'called', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ ok: false, error: 'Invalid status' });
    }

    const updateData = { status };
    if (notes) updateData.notes = notes;

    await CallbackRequest.findByIdAndUpdate(req.params.id, updateData);
    res.json({ ok: true, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update status' });
  }
});

app.post('/api/callback-request', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ 
        ok: false, 
        error: 'Phone number is required' 
      });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Please enter a valid 10-digit phone number starting with 6-9' 
      });
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingRequest = await CallbackRequest.findOne({
      phone: cleanPhone,
      createdAt: { $gte: twentyFourHoursAgo }
    });

    if (existingRequest) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Callback already requested for this number in the last 24 hours' 
      });
    }

    const callbackRequest = new CallbackRequest({
      phone: cleanPhone,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });

    await callbackRequest.save();

    res.json({ 
      ok: true, 
      message: 'Callback request submitted successfully. We will call you soon!' 
    });

  } catch (error) {
    console.error('Callback request error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ 
        ok: false, 
        error: errors.join(', ') 
      });
    }

    res.status(500).json({ 
      ok: false, 
      error: 'Server error. Please try again later.' 
    });
  }
});

// Super admin dashboard
app.get('/super-admin-dashboard', ensureSuperAdmin, async (req, res) => {
  try {
    const totalCenters = await Center.countDocuments();
    const pendingCenters = await Center.countDocuments({ status: 'pending' });
    const approvedCenters = await Center.countDocuments({ status: 'approved' });
    const rejectedCenters = await Center.countDocuments({ status: 'rejected' });
    
    const totalStudents = await Student.countDocuments();
    const activeStudents = await Student.countDocuments({ status: 'active' });
    const inactiveStudents = await Student.countDocuments({ status: 'inactive' });

    let totalCallbacks = 0;
    let pendingCallbacks = 0;
    let completedCallbacks = 0;
    let recentCallbacks = [];

    try {
      totalCallbacks = await CallbackRequest.countDocuments();
      pendingCallbacks = await CallbackRequest.countDocuments({ status: 'pending' });
      completedCallbacks = await CallbackRequest.countDocuments({ status: 'completed' });
      recentCallbacks = await CallbackRequest.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('phone status createdAt')
        .lean();
    } catch (e) {
      console.log('CallbackRequest not available');
    }
    
    const recentCenters = await Center.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('fullname email inst state status createdAt')
      .lean();
      
    const recentStudents = await Student.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('studentId student.name auth.email center.inst status createdAt')
      .lean();

    const centersByState = await Center.aggregate([
      {
        $group: {
          _id: '$state',
          count: { $sum: 1 },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.render('super-admin/dashboard', {
      stats: {
        totalCenters,
        pendingCenters,
        approvedCenters,
        rejectedCenters,
        totalStudents,
        activeStudents,
        inactiveStudents,
        totalCallbacks,
        pendingCallbacks,
        completedCallbacks
      },
      recentCenters,
      recentStudents,
      recentCallbacks,
      centersByState
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('super-admin/dashboard', { 
      stats: {},
      recentCenters: [],
      recentStudents: [],
      recentCallbacks: [],
      centersByState: [],
      error: 'Failed to load dashboard data'
    });
  }
});

app.get('/super-admin/centers', ensureSuperAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const status = req.query.status || 'all';
    const search = req.query.search || '';

    let filter = {};
    if (status !== 'all') filter.status = status;
    if (search) {
      filter.$or = [
        { fullname: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { inst: new RegExp(search, 'i') },
        { state: new RegExp(search, 'i') }
      ];
    }

    const total = await Center.countDocuments(filter);
    const centers = await Center.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('fullname email inst state district city phone status createdAt')
      .lean();

    res.render('super-admin/centers', {
      centers,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        total
      },
      filters: { status, search }
    });
  } catch (error) {
    console.error('Centers page error:', error);
    res.render('super-admin/centers', { centers: [], pagination: {}, filters: {}, error: 'Failed to load centers' });
  }
});

app.get('/super-admin/students', ensureSuperAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const status = req.query.status || 'all';
    const search = req.query.search || '';

    let filter = {};
    if (status !== 'all') filter.status = status;
    if (search) {
      filter.$or = [
        { studentId: new RegExp(search, 'i') },
        { 'student.name': new RegExp(search, 'i') },
        { 'auth.email': new RegExp(search, 'i') },
        { 'center.inst': new RegExp(search, 'i') }
      ];
    }

    const total = await Student.countDocuments(filter);
    const students = await Student.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('studentId student.name auth.email center.inst course.title status createdAt')
      .lean();

    res.render('super-admin/students', {
      students,
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        total
      },
      filters: { status, search }
    });
  } catch (error) {
    console.error('Students page error:', error);
    res.render('super-admin/students', { students: [], pagination: {}, filters: {}, error: 'Failed to load students' });
  }
});

app.post('/super-admin/center/:id/approve', ensureSuperAdmin, async (req, res) => {
  try {
    await Center.findByIdAndUpdate(req.params.id, { status: 'approved' });
    res.json({ ok: true, message: 'Center approved successfully' });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to approve center' });
  }
});

app.post('/super-admin/center/:id/reject', ensureSuperAdmin, async (req, res) => {
  try {
    await Center.findByIdAndUpdate(req.params.id, { status: 'rejected' });
    res.json({ ok: true, message: 'Center rejected successfully' });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to reject center' });
  }
});

app.get('/api/centers', async (req, res) => {
  try {
    const rawState = req.query.state;
    if (!rawState || typeof rawState !== 'string' || rawState.trim() === '') {
      return res.status(400).json({ ok: false, error: 'state query parameter is required' });
    }

    const state = rawState.trim();
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 100;
    const MAX_LIMIT = 500;
    limit = Math.min(limit, MAX_LIMIT);

    const escaped = escapeRegExp(state);
    const stateRegex = new RegExp(`^${escaped}$`, 'i');

    const filter = {
      state: { $regex: stateRegex },
      status: 'approved'
    };

    const total = await Center.countDocuments(filter);
    const centers = await Center.find(filter)
      .select('inst fullname cenAdr city district state phone files createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const normalized = centers.map(c => ({
      _id: c._id,
      inst: c.inst || '',
      fullname: c.fullname || '',
      cenAdr: c.cenAdr || '',
      city: c.city || '',
      district: c.district || '',
      state: c.state || '',
      phone: c.phone || '',
      files: c.files || {},
      createdAt: c.createdAt
    }));

    return res.json({
      ok: true,
      centers: normalized,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error('GET /api/centers error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log('📦 Session store: In-memory (server-side)');
  console.log('🔐 Auth system: Ready');
  console.log('✅ All routes loaded\n');
});
