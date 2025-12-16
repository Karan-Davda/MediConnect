const multer = require('multer');
const path = require('path');

// Configure multer for service results - use memory storage for S3 upload
const uploadServiceResult = multer({
  storage: multer.memoryStorage(), // Store in memory for S3 upload
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for medical files (X-rays, lab reports, etc.)
  },
  fileFilter: (req, file, cb) => {
    // Allow images, PDFs, DICOM files, and other medical file types
    const allowedTypes = /jpeg|jpg|png|gif|bmp|pdf|dicom|dcm|tiff|tif|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || 
                     file.mimetype.startsWith('image/') || 
                     file.mimetype === 'application/pdf' ||
                     file.mimetype === 'application/msword' ||
                     file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files, PDFs, DICOM files, and documents are allowed!'));
    }
  }
});

module.exports = uploadServiceResult;

