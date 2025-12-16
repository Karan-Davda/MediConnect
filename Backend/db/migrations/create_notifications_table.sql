-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(patient_id),
    user_id INTEGER REFERENCES users(user_id), -- For quick lookup
    
    -- Notification content
    type VARCHAR(50) NOT NULL, -- 'test_result', 'appointment_reminder', 'prescription_ready', 'general'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Related resources
    medical_record_id INTEGER REFERENCES emr_records(record_id),
    appointment_id INTEGER REFERENCES appointments(appt_id),
    prescription_id INTEGER REFERENCES prescriptions(prescription_id),
    
    -- Notification data (JSONB for flexibility)
    data JSONB, -- Can store lab result details, appointment info, etc.
    
    -- Status
    status VARCHAR(50) DEFAULT 'unread', -- 'unread', 'read', 'archived'
    read_at TIMESTAMP,
    
    -- Priority
    priority VARCHAR(50) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_patient_id ON notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_medical_record_id ON notifications(medical_record_id);

-- Add comments
COMMENT ON TABLE notifications IS 'Stores in-app notifications for patients';
COMMENT ON COLUMN notifications.data IS 'JSONB field for storing notification-specific data (lab results, appointment details, etc.)';

