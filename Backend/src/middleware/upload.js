const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create Assets directory if it doesn't exist
const assetsDir = path.join(__dirname, '../../Assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
  console.log('📁 Created Assets directory:', assetsDir);
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, assetsDir);
  },
  filename: function (req, file, cb) {
    try {
      // Get record and patient info from request
      const recordId = req.params?.recordId || req.body?.recordId;
      
      // If no recordId, use generic naming
      if (!recordId) {
        const ext = path.extname(file.originalname);
        const timestamp = Date.now();
        return cb(null, `Scan_${new Date().toISOString().split('T')[0]}_${timestamp}${ext}`);
      }
      
      const { findMedicalRecordById, findPatientById } = require('../repositories/MedicalRecordRepository');
      
      // Get record to extract diagnoses and patient info
      const record = findMedicalRecordById(recordId);
      if (!record) {
        // If record not found, use generic naming
        const ext = path.extname(file.originalname);
        const timestamp = Date.now();
        return cb(null, `Unknown_Unknown_${new Date().toISOString().split('T')[0]}_${timestamp}${ext}`);
      }
      
      const patient = findPatientById(record.patientId);
      if (!patient) {
        // If patient not found, use generic naming
        const ext = path.extname(file.originalname);
        const timestamp = Date.now();
        const date = new Date(record.visitDate || new Date()).toISOString().split('T')[0];
        return cb(null, `Unknown_Patient_${date}_${timestamp}${ext}`);
      }
      
      // Extract diagnosis codes (first diagnosis or "Unknown")
      const diagnosisCodes = record.diagnoses && record.diagnoses.length > 0
        ? record.diagnoses.map(d => d.code || d.description || 'Unknown').join('_')
        : 'Unknown';
      
      // Clean diagnosis codes for filename (remove special characters)
      const cleanDiagnosis = diagnosisCodes.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50);
      
      // Patient name (first and last name)
      const patientName = `${patient.firstName || 'Unknown'}_${patient.lastName || 'Patient'}`.replace(/[^a-zA-Z0-9_]/g, '_');
      
      // Date (format: YYYY-MM-DD)
      const date = new Date(record.visitDate || new Date()).toISOString().split('T')[0];
      
      // Get file extension
      const ext = path.extname(file.originalname);
      
      // Create filename: {Diagnoses}_{Patient Name}_{Date}_{timestamp}{ext}
      const timestamp = Date.now();
      const filename = `${cleanDiagnosis}_${patientName}_${date}_${timestamp}${ext}`;
      
      cb(null, filename);
    } catch (error) {
      console.error('Error generating filename:', error);
      // Fallback to generic naming if any error occurs
      const ext = path.extname(file.originalname);
      const timestamp = Date.now();
      cb(null, `Scan_${new Date().toISOString().split('T')[0]}_${timestamp}${ext}`);
    }
  }
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|bmp|dicom|dcm/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.startsWith('image/');
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

module.exports = upload;

