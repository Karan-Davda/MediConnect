# Service Documents Upload Implementation Summary

## Overview
Instead of using a separate `service_results` table, we now upload documents directly to S3 for each selected clinic service and store them as attachments in the medical record's JSONB `attachments` field.

## Architecture

### File Storage
- **Storage**: AWS S3 (private bucket)
- **Access**: Signed URLs (1-hour expiry)
- **Organization**: Files organized by service type in S3 folders

### Database Storage
- **Location**: `emr_records.attachments` (JSONB column)
- **Structure**: Array of attachment objects with S3 references

## Attachment Structure

```json
{
  "id": "attachment_1234567890_abc123",
  "name": "Complete Blood Count Report",
  "type": "lab_result",
  "service_id": 5,
  "service_code": "LAB-CBC",
  "service_name": "Complete Blood Count",
  "s3_key": "service-results/lab_test/uuid-123.pdf",
  "s3_url": "s3://bucket/service-results/lab_test/uuid-123.pdf",
  "file_name": "cbc-report-2024.pdf",
  "file_type": "application/pdf",
  "file_size": 245678,
  "date": "2024-01-15T10:30:00Z",
  "signed_url": "https://..." // Generated when fetching record
}
```

## API Endpoints

### POST /api/medical-records/:recordId/attachments
Upload a document for a clinic service.

**Request (multipart/form-data):**
- `file` - File to upload (required)
- `name` - Display name (required)
- `type` - Attachment type (required)
- `service_id` - Clinic service ID (optional)
- `service_code` - Service code (optional)

**Response:**
```json
{
  "message": "Attachment added successfully",
  "attachment": {
    "id": "...",
    "service_id": 5,
    "s3_key": "...",
    "file_name": "..."
  }
}
```

### GET /api/medical-records/attachments/:attachmentId/download
Get signed URL for downloading attachment.

**Query params:**
- `recordId` - Medical record ID (required)

**Response:**
```json
{
  "attachmentId": "...",
  "fileName": "lab-report.pdf",
  "signedUrl": "https://...",
  "expiresIn": 3600
}
```

## Workflow

1. **Create Medical Record** - Doctor creates a medical record
2. **Select Services** - Doctor selects clinic services (e.g., "Lab Test - CBC")
3. **Upload Documents** - For each selected service, upload result document
4. **Store in Attachments** - Document stored in record's attachments array with service_id
5. **Auto-Generate Invoice** - Invoice created with selected services

## Frontend Integration

When creating/editing a medical record:
1. Fetch clinic services: `GET /api/clinic-services`
2. Allow service selection (multi-select)
3. For each selected service, show file upload input
4. Upload files: `POST /api/medical-records/:recordId/attachments` with `service_id`
5. Display attachments grouped by service in record view

## Benefits

✅ **Simpler**: No separate table needed  
✅ **Flexible**: Attachments can be for services or general scans  
✅ **Scalable**: S3 handles large files efficiently  
✅ **Secure**: Private files with time-limited access  
✅ **Integrated**: Works with existing attachment system  

## Files Modified

- `Backend/src/routes/medical-records.js` - Updated attachment upload to use S3
- `Backend/src/repositories/MedicalRecordRepository.js` - Generate signed URLs for attachments
- `Backend/src/middleware/uploadServiceResult.js` - Multer config for S3 uploads
- `Backend/src/services/s3Service.js` - S3 upload/download service

## Next Steps

1. Install AWS SDK: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
2. Configure S3 bucket and credentials
3. Update frontend to add service selection + file upload UI
4. Test file uploads and downloads

