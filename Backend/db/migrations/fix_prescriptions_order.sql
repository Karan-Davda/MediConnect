-- Fix script: Recreate tables in correct order
-- Run this if you got "relation pharmacies does not exist" error

-- Step 1: Drop prescriptions table if it exists (due to wrong creation order)
DROP TABLE IF EXISTS prescriptions CASCADE;

-- Step 2: Create pharmacies table FIRST
CREATE TABLE IF NOT EXISTS pharmacies (
    pharmacy_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    ncpdp_id VARCHAR(20),
    npi VARCHAR(20),
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    phone_number VARCHAR(20),
    fax_number VARCHAR(20),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    delivery_available BOOLEAN DEFAULT false,
    hours VARCHAR(255),
    preferred_by_clinic BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Create prescriptions table (now pharmacies exists)
CREATE TABLE IF NOT EXISTS prescriptions (
    prescription_id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(patient_id),
    patient_name VARCHAR(255),
    medical_record_id INTEGER REFERENCES emr_records(record_id),
    provider_id INTEGER NOT NULL REFERENCES users(user_id),
    provider_name VARCHAR(255),
    clinic_id INTEGER REFERENCES clinics(clinic_id),
    
    -- Medication details
    medication_name VARCHAR(255) NOT NULL,
    medication_code VARCHAR(100),
    dosage VARCHAR(100) NOT NULL,
    dosage_unit VARCHAR(20) DEFAULT 'mg',
    form VARCHAR(50) DEFAULT 'tablet',
    frequency VARCHAR(100) NOT NULL,
    route VARCHAR(50) DEFAULT 'oral',
    duration VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    refills INTEGER DEFAULT 0,
    
    -- Dates
    start_date DATE,
    end_date DATE,
    
    -- Instructions and details
    instructions TEXT,
    indication TEXT,
    
    -- Status and pharmacy
    status VARCHAR(50) DEFAULT 'pending',
    pharmacy_id INTEGER REFERENCES pharmacies(pharmacy_id),
    pharmacy_name VARCHAR(255),
    sent_to_pharmacy_date TIMESTAMP,
    filled_date TIMESTAMP,
    notes TEXT,
    
    -- Prescription flags
    priority VARCHAR(50) DEFAULT 'routine',
    substitution_allowed BOOLEAN DEFAULT true,
    daw BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(user_id),
    updated_by INTEGER REFERENCES users(user_id)
);

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_provider_id ON prescriptions(provider_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_medical_record_id ON prescriptions(medical_record_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_pharmacy_id ON prescriptions(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacies_is_active ON pharmacies(is_active);
CREATE INDEX IF NOT EXISTS idx_pharmacies_ncpdp_id ON pharmacies(ncpdp_id);

-- Step 5: Add comments
COMMENT ON TABLE prescriptions IS 'Stores prescription information for patients';
COMMENT ON TABLE pharmacies IS 'Stores pharmacy information for prescription routing';

