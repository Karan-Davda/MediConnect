-- Migration: Add onboarding profile columns to doctors table
-- This adds all missing columns needed for the complete onboarding flow

-- License & Certification fields (for doctors)
ALTER TABLE doctors 
ADD COLUMN IF NOT EXISTS npi VARCHAR(10),
ADD COLUMN IF NOT EXISTS issuing_authority VARCHAR(255),
ADD COLUMN IF NOT EXISTS board_certification VARCHAR(255);

-- Professional Information fields
ALTER TABLE doctors 
ADD COLUMN IF NOT EXISTS years_of_experience INTEGER,
ADD COLUMN IF NOT EXISTS medical_school VARCHAR(255),
ADD COLUMN IF NOT EXISTS residency VARCHAR(255),
ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Practice Information fields (office details)
ALTER TABLE doctors 
ADD COLUMN IF NOT EXISTS office_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS office_state VARCHAR(100),
ADD COLUMN IF NOT EXISTS office_zip VARCHAR(10),
ADD COLUMN IF NOT EXISTS office_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS office_hours JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS insurance_accepted JSONB DEFAULT '[]'::jsonb;

-- Preferences fields
ALTER TABLE doctors 
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS preferred_contact_method VARCHAR(20) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS availability_reminders BOOLEAN DEFAULT true;

-- Add indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_doctors_npi ON doctors (npi);
CREATE INDEX IF NOT EXISTS idx_doctors_office_city ON doctors (office_city);
CREATE INDEX IF NOT EXISTS idx_doctors_office_state ON doctors (office_state);
CREATE INDEX IF NOT EXISTS idx_doctors_languages ON doctors USING GIN (languages);
CREATE INDEX IF NOT EXISTS idx_doctors_insurance_accepted ON doctors USING GIN (insurance_accepted);

-- Comments for documentation
COMMENT ON COLUMN doctors.npi IS 'National Provider Identifier (10-digit)';
COMMENT ON COLUMN doctors.issuing_authority IS 'Medical board or authority that issued the license';
COMMENT ON COLUMN doctors.board_certification IS 'Board certification details (e.g., American Board of Internal Medicine)';
COMMENT ON COLUMN doctors.years_of_experience IS 'Number of years of professional experience';
COMMENT ON COLUMN doctors.medical_school IS 'Medical school attended';
COMMENT ON COLUMN doctors.residency IS 'Residency or fellowship program';
COMMENT ON COLUMN doctors.languages IS 'Array of languages spoken (JSONB)';
COMMENT ON COLUMN doctors.bio IS 'Professional biography';
COMMENT ON COLUMN doctors.office_city IS 'City where the office/practice is located';
COMMENT ON COLUMN doctors.office_state IS 'State where the office/practice is located';
COMMENT ON COLUMN doctors.office_zip IS 'ZIP code of the office/practice';
COMMENT ON COLUMN doctors.office_phone IS 'Office phone number';
COMMENT ON COLUMN doctors.office_hours IS 'Office hours by day of week (JSONB)';
COMMENT ON COLUMN doctors.insurance_accepted IS 'Array of insurance providers accepted (JSONB)';
COMMENT ON COLUMN doctors.email_notifications IS 'Enable email notifications preference';
COMMENT ON COLUMN doctors.sms_notifications IS 'Enable SMS notifications preference';
COMMENT ON COLUMN doctors.preferred_contact_method IS 'Preferred contact method: email, phone, or both';
COMMENT ON COLUMN doctors.availability_reminders IS 'Enable availability reminders preference';
