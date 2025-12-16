-- Create speciality table
CREATE TABLE IF NOT EXISTS speciality (
    speciality_id SERIAL PRIMARY KEY,
    speciality_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_speciality_name ON speciality(speciality_name);
CREATE INDEX IF NOT EXISTS idx_speciality_is_active ON speciality(is_active);

-- Add comments
COMMENT ON TABLE speciality IS 'Stores medical specialties for doctors';
COMMENT ON COLUMN speciality.speciality_name IS 'Name of the medical specialty (e.g., Cardiology, Pediatrics)';

-- Insert mock data for specialties
INSERT INTO speciality (speciality_name, description, is_active) VALUES
  ('Cardiology', 'Heart and cardiovascular system diseases', true),
  ('Dermatology', 'Skin, hair, and nail conditions', true),
  ('Endocrinology', 'Hormone and metabolic disorders', true),
  ('Gastroenterology', 'Digestive system diseases', true),
  ('General Practice', 'Primary care and general medicine', true),
  ('Hematology', 'Blood and blood-forming organs', true),
  ('Infectious Disease', 'Infectious and communicable diseases', true),
  ('Internal Medicine', 'Adult diseases and preventive care', true),
  ('Nephrology', 'Kidney diseases and disorders', true),
  ('Neurology', 'Nervous system disorders', true),
  ('Oncology', 'Cancer diagnosis and treatment', true),
  ('Ophthalmology', 'Eye diseases and vision care', true),
  ('Orthopedics', 'Musculoskeletal system', true),
  ('Otolaryngology', 'Ear, nose, and throat disorders', true),
  ('Pediatrics', 'Child and adolescent medicine', true),
  ('Psychiatry', 'Mental health and behavioral disorders', true),
  ('Pulmonology', 'Respiratory system diseases', true),
  ('Rheumatology', 'Joint, muscle, and autoimmune diseases', true),
  ('Urology', 'Urinary tract and male reproductive system', true),
  ('Emergency Medicine', 'Acute care and emergency treatment', true),
  ('Family Medicine', 'Comprehensive care for all ages', true),
  ('Geriatrics', 'Elderly care and aging-related conditions', true),
  ('Obstetrics and Gynecology', 'Women''s reproductive health', true),
  ('Radiology', 'Medical imaging and diagnostic procedures', true),
  ('Anesthesiology', 'Pain management and surgical anesthesia', true),
  ('Pathology', 'Disease diagnosis through laboratory analysis', true),
  ('Physical Medicine and Rehabilitation', 'Physical therapy and rehabilitation', true),
  ('Sports Medicine', 'Athletic injuries and performance', true),
  ('Allergy and Immunology', 'Allergic reactions and immune system disorders', true),
  ('Critical Care Medicine', 'Intensive care for critically ill patients', true)
ON CONFLICT (speciality_name) DO NOTHING;

