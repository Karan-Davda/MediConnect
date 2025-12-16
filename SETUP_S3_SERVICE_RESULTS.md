# S3 Service Results Setup Guide

## Overview
This implementation adds the ability to:
1. Select clinic services when creating medical records
2. Upload result files (lab reports, X-rays, etc.) to AWS S3
3. Store service results linked to medical records
4. View and download service results with secure signed URLs

## Prerequisites

### 1. Install AWS SDK Packages
```bash
cd Backend
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 2. Set Up AWS S3 Bucket

1. Create an S3 bucket in AWS Console (e.g., `mediconnect-medical-files`)
2. Configure bucket policies for private access
3. Create IAM user with S3 permissions:
   - `s3:PutObject`
   - `s3:GetObject`
   - `s3:DeleteObject`
4. Generate access keys

### 3. Environment Variables

Add to `Backend/.env`:
```env
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET_NAME=mediconnect-medical-files
```

### 4. Database Migration

Run the SQL migration:
```bash
psql -U your_user -d your_database -f Backend/db/migrations/create_service_results_table.sql
```

Or manually execute:
```sql
-- See Backend/db/migrations/create_service_results_table.sql
```

## File Structure

### Backend Files Created:
- `Backend/src/services/s3Service.js` - S3 upload/download service
- `Backend/src/repositories/ServiceResultRepository.js` - Database operations
- `Backend/src/middleware/uploadServiceResult.js` - Multer config for service results
- `Backend/db/migrations/create_service_results_table.sql` - Database schema

### Backend Files Updated:
- `Backend/src/routes/medical-records.js` - Added service results routes
- `Backend/package.json` - Added AWS SDK dependencies

## API Endpoints

### POST /api/medical-records/:recordId/service-results
Add service result with optional file upload.

**Request:**
- `multipart/form-data`
- Fields:
  - `service_id` (optional) - ID from clinic_services table
  - `service_code` (optional) - Service code
  - `resultFile` (optional) - File to upload
  - `result_data` (optional) - JSON string with structured data
  - `notes` (optional) - Notes about the result
  - `status` (optional) - 'pending', 'completed', 'abnormal', 'critical'

**Response:**
```json
{
  "message": "Service result added successfully",
  "result": {
    "result_id": 1,
    "medical_record_id": 1,
    "service_id": 5,
    "file_url": "s3://bucket/service-results/lab_test/uuid.pdf",
    "file_name": "lab-report.pdf",
    "status": "pending"
  }
}
```

### GET /api/medical-records/:recordId/service-results
Get all service results for a medical record.

**Response:**
```json
{
  "count": 2,
  "results": [
    {
      "resultId": 1,
      "serviceName": "Complete Blood Count",
      "fileUrl": "s3://...",
      "signedUrl": "https://...", // Pre-signed URL valid for 1 hour
      "status": "completed"
    }
  ]
}
```

### GET /api/medical-records/service-results/:resultId
Get specific service result with signed URL.

### PUT /api/medical-records/service-results/:resultId
Update service result (status, notes, review).

### DELETE /api/medical-records/service-results/:resultId
Delete service result and associated S3 file.

## Frontend Integration

The frontend needs to be updated to:
1. Fetch clinic services from `/api/clinic-services`
2. Allow service selection in medical records form
3. Upload files for each selected service
4. Display service results in record view

## Testing

1. Create a medical record
2. Add service result with file upload:
```bash
curl -X POST http://localhost:3001/api/medical-records/record_1/service-results \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "service_id=5" \
  -F "resultFile=@lab-report.pdf" \
  -F "notes=Lab results reviewed"
```

3. Retrieve service results:
```bash
curl http://localhost:3001/api/medical-records/record_1/service-results \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Security Notes

- Files are stored privately in S3
- Signed URLs expire after 1 hour
- Access is controlled through medical record permissions
- Files are automatically deleted when service result is deleted

## Cost Considerations

- S3 storage: ~$0.023 per GB/month
- Data transfer: First 1GB free, then ~$0.09 per GB
- Requests: First 20,000 PUT requests free, then $0.005 per 1,000

For a clinic with 1,000 patients/month and 5MB average file size:
- Storage: ~5GB = $0.12/month
- Very cost-effective for medical file storage

