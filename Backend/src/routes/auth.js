const express = require('express');
const jwt = require('jsonwebtoken');
const UserRepository = require('../repositories/UserRepository');
const PatientRepository = require('../repositories/PatientRepository');
const DoctorRepository = require('../repositories/DoctorRepository');
const ClinicRepository = require('../repositories/ClinicRepository');
const RoleRepository = require('../repositories/RoleRepository');
const { transaction, query } = require('../db/connection');
const { logAccess, AUDIT_ACTIONS } = require('../middleware/auditLogger');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// Registration endpoint
router.post('/register', async (req, res) => {
  try {
    const { role, auth, profile } = req.body;

    if (!role || !auth || !auth.email || !auth.password) {
      return res.status(400).json({ error: 'Missing required fields: role, auth.email, auth.password' });
    }

    // Validate role exists
    const roleRecord = await RoleRepository.findByName(role);
    if (!roleRecord) {
      return res.status(400).json({ error: `Invalid role: ${role}` });
    }

    // Check if email already exists
    const emailExists = await UserRepository.emailExists(auth.email);
    if (emailExists) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Use transaction for atomicity
    const result = await transaction(async (client) => {
      let clinicId = null;

      // Handle clinic_admin registration - create clinic first
      if (role === 'clinic_admin' && profile.clinic_name) {
        const clinic = await client.query(
          `INSERT INTO clinics (name, phone, email, country, state, city, address)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING clinic_id`,
          [
            profile.clinic_name,
            profile.phone || null,
            auth.email,
            profile.country || null,
            profile.state || null,
            profile.city || null,
            null
          ]
        );
        clinicId = clinic.rows[0].clinic_id;
      }

      // Split full_name
      const nameParts = profile.full_name ? profile.full_name.trim().split(/\s+/) : [];
      const first_name = nameParts[0] || '';
      const last_name = nameParts.slice(1).join(' ') || '';

      // Hash password
      const bcrypt = require('bcryptjs');
      const password_hash = await bcrypt.hash(auth.password, 10);

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (
          email, password_hash, first_name, last_name, phone_number,
          country, state, city, role_id, clinic_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING user_id, email, first_name, last_name, phone_number,
          country, state, city, role_id, clinic_id, is_active, created_at`,
        [
          auth.email,
          password_hash,
          first_name,
          last_name,
          profile.phone || null,
          profile.country || null,
          profile.state || null,
          profile.city || null,
          roleRecord.role_id,
          clinicId
        ]
      );
      const user = userResult.rows[0];

      // Create role-specific profile
      if (role === 'patient') {
        await client.query(
          `INSERT INTO patients (
            user_id, dob, gender, address, emergency_contact,
            insurance_id, allergies, medical_history
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            user.user_id,
            profile.dob,
            profile.gender || null,
            null,
            null,
            null,
            '[]',
            '[]'
          ]
        );
      } else if (role === 'doctor') {
        // Only doctors go into doctors table
        await client.query(
          `INSERT INTO doctors (
            user_id, address, speciality_id, standard_healthcare_id,
            license_number, license_expiry
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            user.user_id,
            null,
            null, // TODO: Map specialty to speciality_id
            null,
            null,
            null
          ]
        );
      } else if (role === 'clinic_admin') {
        // Clinic admins go into clinic_staff table
        await client.query(
          `INSERT INTO clinic_staff (user_id, position, address)
           VALUES ($1, $2, $3)`,
          [
            user.user_id,
            'Clinic Administrator',
            null
          ]
        );
      }

      return { user, role_name: roleRecord.role_name };
    });

    // Log registration
    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'USER',
      resourceId: result.user.user_id,
      details: `Registered ${role} user: ${auth.email}`
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: result.user.user_id,
        email: result.user.email,
        role: result.role_name,
        clinicId: result.user.clinic_id
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: String(result.user.user_id),
        email: result.user.email,
        name: `${result.user.first_name} ${result.user.last_name}`.trim(),
        first_name: result.user.first_name,
        last_name: result.user.last_name,
        role: result.role_name,
        clinicId: result.user.clinic_id ? String(result.user.clinic_id) : null,
        clinic_id: result.user.clinic_id
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user by email (with role joined)
    const user = await UserRepository.findByEmail(email);
    
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password using bcrypt
    const isValidPassword = await UserRepository.verifyPassword(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login timestamp
    await UserRepository.updateLastLogin(user.user_id);
    
    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role_name,
        clinicId: user.clinic_id
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    
    // Log login
    logAccess(req, AUDIT_ACTIONS.LOGIN, {
      resourceType: 'AUTH',
      userId: user.user_id
    });
    
    // Check if profile is complete (for doctors and clinic admins)
    let profileComplete = true;
    if (user.role_name === 'doctor') {
      const doctor = await DoctorRepository.findByUserId(user.user_id);
      // Doctors need license_number to be complete
      profileComplete = doctor && doctor.license_number;
    } else if (user.role_name === 'clinic_admin') {
      const ClinicStaffRepository = require('../repositories/ClinicStaffRepository');
      const staff = await ClinicStaffRepository.findByUserId(user.user_id);
      // Clinic admins are complete if staff record exists
      profileComplete = !!staff;
    }

    res.json({
      token,
      user: {
        id: String(user.user_id),
        email: user.email,
        name: `${user.first_name} ${user.last_name}`.trim(),
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role_name,
        clinicId: user.clinic_id ? String(user.clinic_id) : null,
        clinic_id: user.clinic_id,
        profileComplete
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Login failed' });
  }
});

// Complete profile endpoint (for doctors and clinic admins)
router.post('/complete-profile', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;
    const onboardingData = req.body;

    if (role !== 'doctor' && role !== 'clinic_admin') {
      return res.status(403).json({ error: 'This endpoint is only for providers' });
    }

    // Handle clinic_admin separately
    if (role === 'clinic_admin') {
      const ClinicStaffRepository = require('../repositories/ClinicStaffRepository');
      const staff = await ClinicStaffRepository.findByUserId(userId);
      if (!staff) {
        return res.status(404).json({ error: 'Clinic admin profile not found' });
      }

      // Update clinic_staff record with onboarding data
      const updates = {
        position: onboardingData.position || 'Clinic Administrator',
        // Add other fields as needed for clinic staff
      };

      await ClinicStaffRepository.update(staff.staff_id, updates);

      logAccess(req, AUDIT_ACTIONS.UPDATE, {
        resourceType: 'PROFILE',
        resourceId: userId,
        details: 'Clinic admin profile onboarding completed'
      });

      res.json({
        message: 'Profile completed successfully',
        profileComplete: true
      });
      return;
    }

    // Handle doctors
    const doctor = await DoctorRepository.findByUserId(userId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    // Prepare update data for doctors table
    const updates = {};
    
    // For doctors: license and certification fields
    updates.license_number = onboardingData.licenseNumber || null;
    updates.license_expiry = onboardingData.licenseExpiryDate ? new Date(onboardingData.licenseExpiryDate) : null;
    updates.npi = onboardingData.npi || null;
    updates.issuing_authority = onboardingData.issuingAuthority || null;
    updates.board_certification = onboardingData.boardCertification || null;

    // Office address
    if (onboardingData.officeAddress) {
      const fullAddress = `${onboardingData.officeAddress}, ${onboardingData.officeCity}, ${onboardingData.officeState} ${onboardingData.officeZip}`;
      updates.address = fullAddress;
    }

    // Professional Information
    if (onboardingData.yearsOfExperience) {
      updates.years_of_experience = parseInt(onboardingData.yearsOfExperience);
    }
    updates.medical_school = onboardingData.medicalSchool || null;
    updates.residency = onboardingData.residency || null;
    // Store JSONB fields as JSON strings (PostgreSQL will convert them)
    if (onboardingData.languages && Array.isArray(onboardingData.languages)) {
      updates.languages = JSON.stringify(onboardingData.languages);
    }
    updates.bio = onboardingData.bio || null;

    // Practice Information
    updates.office_city = onboardingData.officeCity || null;
    updates.office_state = onboardingData.officeState || null;
    updates.office_zip = onboardingData.officeZip || null;
    updates.office_phone = onboardingData.officePhone || null;
    // Store JSONB fields as JSON strings
    if (onboardingData.officeHours) {
      updates.office_hours = JSON.stringify(onboardingData.officeHours);
    }
    if (onboardingData.insuranceAccepted && Array.isArray(onboardingData.insuranceAccepted)) {
      updates.insurance_accepted = JSON.stringify(onboardingData.insuranceAccepted);
    }

    // Preferences
    updates.email_notifications = onboardingData.emailNotifications !== undefined ? onboardingData.emailNotifications : true;
    updates.sms_notifications = onboardingData.smsNotifications !== undefined ? onboardingData.smsNotifications : false;
    updates.preferred_contact_method = onboardingData.preferredContactMethod || 'email';
    updates.availability_reminders = onboardingData.availabilityReminders !== undefined ? onboardingData.availabilityReminders : true;

    // Update doctor record with all fields
    await DoctorRepository.update(doctor.doctor_id, updates);

    // Mark profile as complete - doctors need license_number
    const profileComplete = (updates.license_number && updates.license_number.trim() !== '');

    // Log profile completion
    logAccess(req, AUDIT_ACTIONS.UPDATE, {
      resourceType: 'PROFILE',
      resourceId: userId,
      details: 'Profile onboarding completed'
    });

    res.json({
      message: 'Profile completed successfully',
      profileComplete: profileComplete
    });
  } catch (error) {
    console.error('Profile completion error:', error);
    res.status(500).json({ error: error.message || 'Failed to complete profile' });
  }
});

// Get current user info
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    const user = await UserRepository.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if profile is complete
    let profileComplete = true;
    if (user.role_name === 'doctor') {
      const doctor = await DoctorRepository.findByUserId(user.user_id);
      profileComplete = doctor && doctor.license_number;
    } else if (user.role_name === 'clinic_admin') {
      const ClinicStaffRepository = require('../repositories/ClinicStaffRepository');
      const staff = await ClinicStaffRepository.findByUserId(user.user_id);
      profileComplete = !!staff;
    }
    
    res.json({
      user: {
        id: String(user.user_id),
        email: user.email,
        name: `${user.first_name} ${user.last_name}`.trim(),
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role_name,
        clinicId: user.clinic_id ? String(user.clinic_id) : null,
        clinic_id: user.clinic_id,
        profileComplete
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Staff onboarding endpoint (clinic admin only)
// Note: This should be protected with authenticate and requireRole middleware in server.js
router.post('/register/staff', async (req, res) => {
  try {
    // Check authentication
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check role
    const userRole = req.user.role || req.user.role_name;
    if (userRole !== 'clinic_admin') {
      return res.status(403).json({ error: 'Only clinic admins can onboard staff' });
    }

    const { auth, profile } = req.body;

    if (!auth || !auth.email || !auth.password || !profile || !profile.full_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate clinic_id ownership
    const requesterClinicId = req.user.clinicId || req.user.clinic_id;
    const staffClinicId = profile.clinic_id || requesterClinicId;

    if (staffClinicId !== requesterClinicId) {
      return res.status(403).json({ error: 'Cannot create staff for different clinic' });
    }

    // Lookup clinic_staff role
    const roleRecord = await RoleRepository.findByName('clinic_staff');
    if (!roleRecord) {
      return res.status(500).json({ error: 'Clinic staff role not found' });
    }

    // Check if email already exists
    const emailExists = await UserRepository.emailExists(auth.email);
    if (emailExists) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Use transaction
    const result = await transaction(async (client) => {
      // Split full_name
      const nameParts = profile.full_name.trim().split(/\s+/);
      const first_name = nameParts[0] || '';
      const last_name = nameParts.slice(1).join(' ') || '';

      // Hash password
      const bcrypt = require('bcryptjs');
      const password_hash = await bcrypt.hash(auth.password, 10);

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (
          email, password_hash, first_name, last_name, phone_number,
          country, state, city, role_id, clinic_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING user_id, email, first_name, last_name, phone_number,
          country, state, city, role_id, clinic_id, is_active, created_at`,
        [
          auth.email,
          password_hash,
          first_name,
          last_name,
          profile.phone || null,
          profile.country || null,
          profile.state || null,
          profile.city || null,
          roleRecord.role_id,
          staffClinicId
        ]
      );
      const user = userResult.rows[0];

      // Create clinic_staff record
      await client.query(
        `INSERT INTO clinic_staff (user_id, position, address)
         VALUES ($1, $2, $3)`,
        [
          user.user_id,
          profile.position || null,
          null
        ]
      );

      return { user, role_name: roleRecord.role_name };
    });

    // Log staff creation
    logAccess(req, AUDIT_ACTIONS.CREATE, {
      resourceType: 'USER',
      resourceId: result.user.user_id,
      details: `Created clinic staff: ${auth.email}`
    });

    res.status(201).json({
      message: 'Staff member created successfully',
      user: {
        id: result.user.user_id,
        email: result.user.email,
        first_name: result.user.first_name,
        last_name: result.user.last_name,
        role: result.role_name,
        clinic_id: result.user.clinic_id
      }
    });
  } catch (error) {
    console.error('Staff registration error:', error);
    res.status(500).json({ error: error.message || 'Staff registration failed' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  if (req.user) {
    logAccess(req, AUDIT_ACTIONS.LOGOUT, {
      resourceType: 'AUTH',
      userId: req.user.userId
    });
  }
  
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;

