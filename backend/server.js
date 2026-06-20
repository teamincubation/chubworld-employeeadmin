const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

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

// 8. Start server listener
app.listen(PORT, () => {
  console.log(`C-Hub HR Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`IST Time Zone enforced. System ready.`);
});
