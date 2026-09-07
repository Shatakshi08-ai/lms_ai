import multer from 'multer';
import { AppError } from '../utils/AppError.js';

export const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname || '')) {
      cb(null, true);
      return;
    }
    cb(new AppError('Please upload a PDF file.', 400));
  },
});
