-- ============================================================================
-- Migration: Move clinic_admin records from doctors table to clinic_staff table
-- ============================================================================
-- This script moves any existing clinic_admin users from the doctors table
-- to the clinic_staff table where they belong
-- ============================================================================

DO $$
DECLARE
  admin_user RECORD;
  staff_count INT;
BEGIN
  -- Find all clinic_admin users that are in the doctors table
  FOR admin_user IN
    SELECT 
      d.doctor_id,
      d.user_id,
      u.email,
      u.first_name || ' ' || u.last_name AS full_name
    FROM doctors d
    JOIN users u ON d.user_id = u.user_id
    JOIN roles r ON u.role_id = r.role_id
    WHERE r.role_name = 'clinic_admin'
  LOOP
    -- Check if staff record already exists
    SELECT COUNT(*) INTO staff_count
    FROM clinic_staff
    WHERE user_id = admin_user.user_id;
    
    IF staff_count = 0 THEN
      -- Create clinic_staff record
      INSERT INTO clinic_staff (user_id, position, address)
      VALUES (admin_user.user_id, 'Clinic Administrator', NULL);
      
      RAISE NOTICE 'Created clinic_staff record for user_id: %, email: %', 
        admin_user.user_id, admin_user.email;
      
      -- Delete from doctors table
      DELETE FROM doctors WHERE doctor_id = admin_user.doctor_id;
      
      RAISE NOTICE 'Removed doctor record (doctor_id: %) for clinic_admin user_id: %', 
        admin_user.doctor_id, admin_user.user_id;
    ELSE
      RAISE NOTICE 'Skipping user_id: % - clinic_staff record already exists', admin_user.user_id;
    END IF;
  END LOOP;
  
  -- Report summary
  SELECT COUNT(*) INTO staff_count
  FROM clinic_staff cs
  JOIN users u ON cs.user_id = u.user_id
  JOIN roles r ON u.role_id = r.role_id
  WHERE r.role_name = 'clinic_admin';
  
  RAISE NOTICE 'Migration complete. Total clinic_admin records in clinic_staff: %', staff_count;
END $$;

-- Verify the migration
SELECT 
  'Verification' AS status,
  COUNT(*) FILTER (WHERE r.role_name = 'clinic_admin' AND d.doctor_id IS NOT NULL) AS clinic_admins_in_doctors,
  COUNT(*) FILTER (WHERE r.role_name = 'clinic_admin' AND cs.staff_id IS NOT NULL) AS clinic_admins_in_staff
FROM users u
JOIN roles r ON u.role_id = r.role_id
LEFT JOIN doctors d ON u.user_id = d.user_id
LEFT JOIN clinic_staff cs ON u.user_id = cs.user_id
WHERE r.role_name = 'clinic_admin';



