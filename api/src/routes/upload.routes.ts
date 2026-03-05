// api/src/routes/upload.routes.ts
// Routes for CSV upload and job status polling
// Last modified: 2026-03-05

import { Router } from 'express';
import multer from 'multer';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { uploadCSV, getUploadJobStatus } from '../controllers/upload.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only .csv files are accepted'));
    }
  },
});

const router = Router();

router.post(
  '/upload',
  authenticateToken,
  requireRole('owner', 'coordinator'),
  upload.single('file'),
  uploadCSV as any
);

router.get(
  '/upload/:jobId',
  authenticateToken,
  requireRole('owner', 'coordinator'),
  getUploadJobStatus as any
);

export { router as uploadRouter };
