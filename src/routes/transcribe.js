const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const chatController = require('../controllers/chatController');


const wrapAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, 
    files: 1 
  },
  fileFilter: (req, file, cb) => {

    const allowedMimeTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/wav',
      'audio/webm',
      'audio/m4a',
      'audio/x-m4a',
      'video/mp4', 
      'video/webm',
      'audio/vnd.wave',
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.log('Unsupported file type:', file);
      cb(new Error('Only audio files are allowed (mp3, wav, m4a, mp4, webm)'), false);
    }
  }
});


const transcribeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10, 
  message: {
    error: 'Too many transcription requests. Please try again in 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, 
  legacyHeaders: false, 
  keyGenerator: (req) => {
 
    return req.user ? req.user.id : req.ip;
  }
});


router.post('/', transcribeRateLimit, upload.single('audioFile'), wrapAsync(chatController.transcribeAudio));

module.exports = router;  