const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'mediconnect-medical-files';

/**
 * Upload file to S3
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} originalName - Original filename
 * @param {string} folder - S3 folder path (e.g., 'lab-results', 'x-rays')
 * @param {string} mimeType - File MIME type
 * @returns {Promise<{url: string, key: string}>}
 */
async function uploadToS3(fileBuffer, originalName, folder = 'medical-files', mimeType = 'application/octet-stream') {
  try {
    // Generate unique filename
    const ext = path.extname(originalName);
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const key = `${folder}/${uniqueName}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      // Make files private by default (require signed URLs to access)
      // Note: ACL is deprecated in newer S3, using Bucket policies instead
      Metadata: {
        originalName: originalName,
        uploadedAt: new Date().toISOString()
      }
    });

    await s3Client.send(command);

    // Return S3 key (we'll generate signed URLs when needed)
    return {
      key: key,
      url: `s3://${BUCKET_NAME}/${key}`, // Internal reference
      bucket: BUCKET_NAME
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
}

/**
 * Generate signed URL for accessing private S3 file
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration in seconds (default: 1 hour)
 * @returns {Promise<string>} Signed URL
 */
async function getSignedUrlForFile(key, expiresIn = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
}

/**
 * Delete file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>}
 */
async function deleteFromS3(key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error('S3 delete error:', error);
    return false;
  }
}

module.exports = {
  uploadToS3,
  getSignedUrlForFile,
  deleteFromS3,
  BUCKET_NAME
};

