-- Create service_results table for storing service results (lab tests, X-rays, etc.)
-- This table links clinic services to medical records and stores result data/files

CREATE TABLE IF NOT EXISTS service_results (
    result_id SERIAL PRIMARY KEY,
    medical_record_id INTEGER NOT NULL REFERENCES emr_records(record_id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES clinic_services(service_id),
    service_code VARCHAR(50),
    service_name VARCHAR(255),
    
    -- Result data
    result_type VARCHAR(50) NOT NULL DEFAULT 'file', -- 'file', 'data', 'both'
    result_data JSONB, -- For structured data (lab values, measurements, etc.)
    
    -- File storage (S3)
    file_url TEXT, -- S3 key or URL (format: s3://bucket/key)
    file_name VARCHAR(255),
    file_type VARCHAR(100), -- MIME type
    file_size BIGINT, -- in bytes
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'abnormal', 'critical'
    reviewed_by INTEGER REFERENCES users(user_id),
    reviewed_at TIMESTAMP,
    notes TEXT,
    
    -- Metadata
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_service_results_medical_record_id ON service_results(medical_record_id);
CREATE INDEX IF NOT EXISTS idx_service_results_service_id ON service_results(service_id);
CREATE INDEX IF NOT EXISTS idx_service_results_status ON service_results(status);
CREATE INDEX IF NOT EXISTS idx_service_results_service_code ON service_results(service_code);

-- Add comments
COMMENT ON TABLE service_results IS 'Stores results from clinic services (lab tests, X-rays, procedures) linked to medical records';
COMMENT ON COLUMN service_results.result_type IS 'Type of result: file (uploaded file), data (structured data), or both';
COMMENT ON COLUMN service_results.file_url IS 'S3 URL in format s3://bucket/key for private file storage';
COMMENT ON COLUMN service_results.result_data IS 'JSONB field for structured result data (lab values, measurements, etc.)';

