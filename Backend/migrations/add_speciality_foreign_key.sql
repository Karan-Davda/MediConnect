-- ============================================================================
-- Migration: Add Foreign Key for speciality_id in doctors table
-- ============================================================================

-- Step 1: Check if speciality_id column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'doctors' AND column_name = 'speciality_id'
  ) THEN
    ALTER TABLE doctors ADD COLUMN speciality_id INT;
    RAISE NOTICE 'Added speciality_id column to doctors table';
  ELSE
    RAISE NOTICE 'speciality_id column already exists in doctors table';
  END IF;
END $$;

-- Step 2: Update existing doctors to have a default speciality (General Practice)
-- First, get the speciality_id for "General Practice" or create it if it doesn't exist
DO $$
DECLARE
  general_practice_id INT;
BEGIN
  -- Get or create "General Practice" specialty
  SELECT speciality_id INTO general_practice_id
  FROM speciality
  WHERE speciality_name = 'General Practice';
  
  IF general_practice_id IS NULL THEN
    INSERT INTO speciality (speciality_name, description)
    VALUES ('General Practice', 'General medical care')
    RETURNING speciality_id INTO general_practice_id;
    RAISE NOTICE 'Created General Practice specialty with ID: %', general_practice_id;
  END IF;
  
  -- Update all doctors with NULL speciality_id to General Practice
  UPDATE doctors
  SET speciality_id = general_practice_id
  WHERE speciality_id IS NULL;
  
  RAISE NOTICE 'Updated % doctor(s) with General Practice specialty', 
    (SELECT COUNT(*) FROM doctors WHERE speciality_id = general_practice_id);
END $$;

-- Step 3: Add foreign key constraint (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'doctors_speciality_id_fkey'
    AND table_name = 'doctors'
  ) THEN
    ALTER TABLE doctors
    ADD CONSTRAINT doctors_speciality_id_fkey
    FOREIGN KEY (speciality_id) 
    REFERENCES speciality(speciality_id) 
    ON DELETE SET NULL;
    
    RAISE NOTICE 'Added foreign key constraint for speciality_id';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists';
  END IF;
END $$;

-- Step 4: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_doctors_speciality ON doctors (speciality_id);

-- Step 5: Verify the changes
SELECT 
  d.doctor_id,
  u.first_name || ' ' || u.last_name AS doctor_name,
  s.speciality_name,
  d.speciality_id
FROM doctors d
LEFT JOIN users u ON d.user_id = u.user_id
LEFT JOIN speciality s ON d.speciality_id = s.speciality_id
ORDER BY d.doctor_id;



