const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// uploads 폴더 정리 함수 import
const cleanupUploads = require('./cleanup-uploads');

const app = express();
const PORT = process.env.PORT || 3501;

// 서버 시작 시 uploads 폴더 정리
console.log('🧹 서버 시작 시 uploads 폴더 정리 중...');
cleanupUploads();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3500', 'http://itsmyzone.iptime.org:3500', 'http://192.168.0.22:3500'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs (increased from 100)
});

// 일반 API용 rate limiter 적용
app.use('/api', (req, res, next) => {
  if (req.path.includes('/progress/') || req.path.includes('/download/')) {
    // 진행 상태 API와 다운로드 API는 rate limiting 제외
    next();
  } else {
    // 다른 API만 rate limiter 사용
    limiter(req, res, next);
  }
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.srt', '.smi', '.vtt', '.ass'];
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('지원하지 않는 파일 형식입니다. SRT, SMI, VTT, ASS 파일만 업로드 가능합니다.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB
  },
  fileFilter: fileFilter
});

// Import route handlers
const translationRoutes = require('./routes/translation');
const subtitleRoutes = require('./routes/subtitle');

// Routes
app.use('/api/translation', translationRoutes);
app.use('/api/subtitle', subtitleRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Translation Service API',
    version: '1.0.0',
    endpoints: [
      'GET /api/health - 헬스 체크',
      'POST /api/translation/text - 텍스트 번역',
      'POST /api/subtitle/upload - 자막파일 업로드',
      'POST /api/subtitle/translate - 자막파일 번역'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '파일 크기가 너무 큽니다. 최대 10MB까지 업로드 가능합니다.' });
    }
  }
  
  res.status(500).json({ 
    error: '서버 오류가 발생했습니다.',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: '요청한 엔드포인트를 찾을 수 없습니다.' });
});

app.listen(PORT, () => {
  console.log(`✅ Translation Service Backend이 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
}); 