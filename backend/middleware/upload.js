'use strict';
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads', 'meters'));
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `meter-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.mimetype)) return cb(new Error('Only JPG, PNG or WEBP images are allowed'));
    cb(null, true);
  },
});
// DEF-066: a photo stored by multer must not remain on disk when the request
// that carried it fails (validation, authorization or business-rule rejection).
function discardUploadOnFailure(req, res, next) {
  const stored = req.file?.path;
  if (stored) res.on('finish', () => { if (res.statusCode >= 400) fs.promises.unlink(stored).catch(() => {}); });
  next();
}
module.exports = { upload, uploadDir, discardUploadOnFailure };
