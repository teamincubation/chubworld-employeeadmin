const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Basic Security Headers (Helmet)
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow React app to load uploaded photos/documents
}));

// 2. CORS setup
const corsOptions = {
  origin: '*', // Adjust this to specific domains in production
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// 3. Request Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Rate Limiting for Auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 login/forgot requests per window
  message: { message: 'Too many authentication attempts from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// 5. Mount API Routes
app.use('/api', apiRouter);

// Health check route
app.get('/api/health', async (req, res) => {
  let dbStatus = 'unknown';
  let dbError = null;
  let designationsCount = 0;
  try {
    const supabase = require('./config/db');
    const { data, error } = await supabase
      .from('designations')
      .select(`
        id, name, department_id,
        departments(name)
      `);
    if (error) {
      dbStatus = 'error';
      dbError = error.message || error;
    } else {
      dbStatus = 'connected';
      designationsCount = data ? data.length : 0;
    }
  } catch (err) {
    dbStatus = 'crash';
    dbError = err.message;
  }

  res.json({ 
    message: 'Welcome to C-Hub HR System API.', 
    status: 'online', 
    timezone: 'Asia/Kolkata (IST)',
    database: {
      url: process.env.SUPABASE_URL || 'not_configured',
      status: dbStatus,
      error: dbError,
      count: designationsCount
    }
  });
});

// Serve static directory (Fallback route if direct serve permitted, but API downloads route is preferred for security)
// We block direct index traversal of uploads folder
app.use('/uploads', (req, res, next) => {
  res.status(403).json({ message: 'Direct directory traversal blocked.' });
});

// 6. Serve frontend static assets in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Fallback to React Router for non-API/non-upload routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// 7. Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message, err.stack);
  
  // Sanitizing database and sql errors to avoid leaking table structures
  if (err.sqlMessage || err.code && err.code.startsWith('ER_')) {
    return res.status(500).json({ 
      message: 'A database error occurred. Security details have been hidden.' 
    });
  }

  res.status(err.status || 500).json({ 
    message: err.message || 'Internal Server Error. Security protocols applied.' 
  });
});

// Run one-off database sync to update Super Admin credentials if they are outdated
async function syncSuperAdminCredentials() {
  try {
    const supabase = require('./config/db');
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_API_KEY || process.env.SUPABASE_URL.includes('dummy')) {
      return;
    }
    console.log('🔄 Synchronizing Super Admin credentials in Supabase...');
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
    
    const { error: userError } = await supabase
      .from('users')
      .update({
        email: 'chub.admin@adloaf.com',
        password_hash: '$2a$10$i9j7LgA9.Pu5DxPpsi46i./HaTyvAIUTUODGuSbaux4rureerRBE.'
      })
      .eq('id', 1);

    if (userError) {
      console.error('⚠️ Failed to sync Super Admin users table:', userError.message);
    } else {
      console.log('✅ Super Admin users table synchronized.');
    }

    const { error: empError } = await supabase
      .from('employees')
      .update({
        email: 'chub.admin@adloaf.com'
      })
      .eq('id', 1);

    if (empError) {
      console.error('⚠️ Failed to sync Super Admin employees table:', empError.message);
    } else {
      console.log('✅ Super Admin employees table synchronized.');
    }
  } catch (err) {
    console.error('⚠️ Error during credentials sync:', err.message);
  }
}
syncSuperAdminCredentials();

// 8. Start server listener
app.listen(PORT, () => {
  console.log(`C-Hub HR Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`IST Time Zone enforced. System ready.`);
});
