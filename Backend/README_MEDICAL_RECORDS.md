# Medical Records API Documentation

## Overview

This module implements User Story 03.01 - Store Records, allowing Doctors, Clinic Staff, Clinic Administrators, and EMR Administrators to store and manage patient medical records including diagnoses, treatments, lab results, and medical history.

## Architecture

The implementation uses a **flexible repository pattern** that allows easy migration to a database later:

- **Models**: Patient, MedicalRecord, Diagnosis, Treatment, LabResult
- **Repository Layer**: Abstraction layer for data storage (currently in-memory, easily swapable with database)
- **Routes**: RESTful API endpoints with proper authorization and audit logging

## Data Models

### Patient
- Basic patient information
- Demographics
- Emergency contacts
- Insurance information
- Allergies and medical history

### MedicalRecord
- Visit information (date, type, provider)
- Diagnoses (ICD-10 codes)
- Treatments (medications, procedures, therapies)
- Lab Results (LOINC codes)
- Vital signs
- Notes and prescriptions
- Follow-up information

## API Endpoints

### Patient Management

#### Create Patient
```
POST /api/medical-records/patients
Authorization: Bearer <token>
Roles: doctor, clinic_staff, clinic_admin

Body:
{
  "userId": "user_id_123",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-15",
  "gender": "male",
  "phoneNumber": "+1234567890",
  "address": {...},
  "emergencyContact": {...},
  "insuranceInfo": {...},
  "allergies": [...]
}
```

#### Get All Patients
```
GET /api/medical-records/patients?search=john&clinicId=clinic1
Authorization: Bearer <token>
Roles: doctor, clinic_staff, clinic_admin, patient (own records)
```

#### Get Patient by ID
```
GET /api/medical-records/patients/:id
Authorization: Bearer <token>
Roles: doctor, clinic_staff, clinic_admin, patient (own records)
```

#### Update Patient
```
PUT /api/medical-records/patients/:id
Authorization: Bearer <token>
Roles: doctor, clinic_staff, clinic_admin
```

### Medical Records

#### Create Medical Record
```
POST /api/medical-records
Authorization: Bearer <token>
Roles: doctor, clinic_staff, clinic_admin

Body:
{
  "patientId": "patient_1",
  "visitDate": "2024-01-15T10:00:00Z",
  "visitType": "routine",
  "chiefComplaint": "Headache and fever",
  "diagnoses": [
    {
      "code": "R51",
      "description": "Headache",
      "status": "confirmed",
      "notes": "Migraine-like symptoms"
    }
  ],
  "treatments": [
    {
      "type": "medication",
      "name": "Ibuprofen",
      "dosage": "400mg",
      "frequency": "Every 6 hours",
      "duration": "3 days",
      "status": "active"
    }
  ],
  "labResults": [
    {
      "testName": "Complete Blood Count",
      "testCode": "CBC",
      "result": "Normal",
      "status": "normal"
    }
  ],
  "vitalSigns": {
    "bloodPressure": "120/80",
    "heartRate": 72,
    "temperature": 98.6,
    "weight": 70
  },
  "notes": "Patient reports improvement"
}
```

#### Get All Medical Records
```
GET /api/medical-records?patientId=patient_1&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
Roles: doctor, clinic_staff, clinic_admin, patient (own records)
```

#### Get Medical Record by ID
```
GET /api/medical-records/:id
Authorization: Bearer <token>
Roles: doctor, clinic_staff, clinic_admin, patient (own records)
```

#### Get Patient's Medical Records
```
GET /api/medical-records/patient/:patientId?limit=10&sortOrder=desc
Authorization: Bearer <token>
Roles: doctor, clinic_staff, clinic_admin, patient (own records)
```

#### Get Patient Medical History
```
GET /api/medical-records/patient/:patientId/history
Authorization: Bearer <token>
Roles: doctor, clinic_staff, clinic_admin, patient (own records)

Returns comprehensive medical history including:
- All diagnoses across all visits
- All treatments
- All lab results
- Recent records summary
```

#### Update Medical Record
```
PUT /api/medical-records/:id
Authorization: Bearer <token>
Roles: doctor, clinic_staff, clinic_admin
```

#### Delete Medical Record
```
DELETE /api/medical-records/:id
Authorization: Bearer <token>
Roles: clinic_admin (only)
```

## Authorization

### Who Can Store Records
- **Doctors**: Full access to create, read, update records
- **Clinic Staff**: Full access to create, read, update records
- **Clinic Administrators**: Full access to create, read, update, delete records
- **Patients**: Can only view their own records

### Access Control
- Clinic staff can only access records from their clinic
- Patients can only access their own records
- All actions are logged in the audit system for HIPAA compliance

## Database Migration

When ready to connect to a database, simply update the repository methods in `src/repositories/MedicalRecordRepository.js`:

```javascript
// Example for MongoDB:
async function createMedicalRecord(recordData) {
  const db = await getDatabase();
  const result = await db.collection('medical_records').insertOne(recordData);
  return findMedicalRecordById(result.insertedId);
}

// Example for SQL:
async function createMedicalRecord(recordData) {
  const result = await db.query(
    'INSERT INTO medical_records (...) VALUES (...) RETURNING *',
    [...]
  );
  return result.rows[0];
}
```

The route handlers don't need to change - they'll continue to work with the same interface!

## Audit Logging

All medical record operations are automatically logged:
- CREATE: When records are created
- VIEW: When records are accessed
- UPDATE: When records are modified
- DELETE: When records are deleted

Audit logs include:
- User ID and email
- Action type
- Resource type and ID
- Timestamp
- IP address and user agent

## Testing

Use the existing test users to test the API:

- Doctor: `doctor@example.com` / `password123`
- Clinic Staff: `staff@example.com` / `password123`
- Clinic Admin: `admin@example.com` / `password123`
- Patient: `patient@example.com` / `password123`

### Example Request

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"doctor@example.com","password":"password123"}'

# Create Medical Record (use token from login)
curl -X POST http://localhost:3001/api/medical-records \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient_1",
    "visitType": "routine",
    "chiefComplaint": "Regular checkup",
    "diagnoses": [{"code": "Z00.00", "description": "General examination"}],
    "vitalSigns": {"bloodPressure": "120/80", "heartRate": 72}
  }'
```

## Future Enhancements

- File attachments for medical records
- Integration with external lab systems
- Prescription management
- Appointment linkage
- Advanced search and filtering
- Export capabilities (PDF, HL7)
- Integration with insurance systems

