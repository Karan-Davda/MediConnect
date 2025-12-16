const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const UserRepository = require('../repositories/UserRepository');
const PatientRepository = require('../repositories/PatientRepository');
const DoctorRepository = require('../repositories/DoctorRepository');
const ClinicRepository = require('../repositories/ClinicRepository');
const RoleRepository = require('../repositories/RoleRepository');
const { transaction } = require('../db/connection');
const { logAccess, AUDIT_ACTIONS } = require('../middleware/auditLogger');
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
      } else if (role === 'doctor' || role === 'clinic_admin') {
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
    if (user.role_name === 'doctor' || user.role_name === 'clinic_admin') {
      const doctor = await DoctorRepository.findByUserId(user.user_id);
      // Profile is incomplete if license_number is missing
      profileComplete = doctor && doctor.license_number;
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

    // Update doctor record with onboarding data
    const doctor = await DoctorRepository.findByUserId(userId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    // Prepare update data
    const updates = {
      license_number: onboardingData.licenseNumber,
      license_expiry: onboardingData.licenseExpiryDate ? new Date(onboardingData.licenseExpiryDate) : null,
    };

    // Update address if provided
    if (onboardingData.officeAddress) {
      const fullAddress = `${onboardingData.officeAddress}, ${onboardingData.officeCity}, ${onboardingData.officeState} ${onboardingData.officeZip}`;
      updates.address = fullAddress;
    }

    // Update doctor record
    await DoctorRepository.update(doctor.doctor_id, updates);

    // Update user record with additional info if needed
    // (phone, etc. can be updated here if needed)

    // Store additional onboarding data in a JSON column or separate table
    // For now, we'll just mark profile as complete by having license_number

    // Log profile completion
    logAccess(req, AUDIT_ACTIONS.UPDATE, {
      resourceType: 'PROFILE',
      resourceId: userId,
      details: 'Profile onboarding completed'
    });

    res.json({
      message: 'Profile completed successfully',
      profileComplete: true
    });
  } catch (error) {
    console.error('Profile completion error:', error);
    res.status(500).json({ error: error.message || 'Failed to complete profile' });
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

    // Update doctor record with onboarding data
    const doctor = await DoctorRepository.findByUserId(userId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    // Prepare update data
    const updates = {
      license_number: onboardingData.licenseNumber,
      license_expiry: onboardingData.licenseExpiryDate ? new Date(onboardingData.licenseExpiryDate) : null,
    };

    // Update address if provided
    if (onboardingData.officeAddress) {
      const fullAddress = `${onboardingData.officeAddress}, ${onboardingData.officeCity}, ${onboardingData.officeState} ${onboardingData.officeZip}`;
      updates.address = fullAddress;
    }

    // Update doctor record
    await DoctorRepository.update(doctor.doctor_id, updates);

    // Log profile completion
    logAccess(req, AUDIT_ACTIONS.UPDATE, {
      resourceType: 'PROFILE',
      resourceId: userId,
      details: 'Profile onboarding completed'
    });

    res.json({
      message: 'Profile completed successfully',
      profileComplete: true
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
    
    console.log(`[DEBUG /auth/me] Decoded token - userId: ${decoded.userId}`);
    
    const user = await UserRepository.findById(decoded.userId);
    
    if (!user) {
      console.log(`[DEBUG /auth/me] User not found for userId: ${decoded.userId}`);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[DEBUG /auth/me] Found user:`, {
      user_id: user.user_id,
      email: user.email,
      role: user.role_name,
      clinic_id: user.clinic_id
    });

    // Get role-specific IDs
    let patient_id = null;
    let doctor_id = null;
    let clinic_staff_id = null;

    if (user.role_name === 'patient') {
      console.log(`[DEBUG /auth/me] User is a patient, fetching patient_id for user_id: ${user.user_id}`);
      const patient = await PatientRepository.findByUserId(user.user_id);
      if (patient) {
        patient_id = patient.patient_id;
        console.log(`[DEBUG /auth/me] Found patient_id: ${patient_id} for user_id: ${user.user_id}`);
      } else {
        console.log(`[DEBUG /auth/me] No patient record found for user_id: ${user.user_id}`);
      }
    } else if (user.role_name === 'doctor') {
      console.log(`[DEBUG /auth/me] User is a doctor, fetching doctor_id for user_id: ${user.user_id}`);
      const doctor = await DoctorRepository.findByUserId(user.user_id);
      if (doctor) {
        doctor_id = doctor.doctor_id;
        console.log(`[DEBUG /auth/me] Found doctor_id: ${doctor_id} for user_id: ${user.user_id}`);
      } else {
        console.log(`[DEBUG /auth/me] No doctor record found for user_id: ${user.user_id}`);
      }
    } else if (user.role_name === 'clinic_staff' || user.role_name === 'clinic_admin') {
      console.log(`[DEBUG /auth/me] User is clinic_staff/admin, fetching clinic_staff_id for user_id: ${user.user_id}`);
      const ClinicStaffRepository = require('../repositories/ClinicStaffRepository');
      const clinicStaff = await ClinicStaffRepository.findByUserId(user.user_id);
      if (clinicStaff) {
        clinic_staff_id = clinicStaff.clinic_staff_id;
        console.log(`[DEBUG /auth/me] Found clinic_staff_id: ${clinic_staff_id} for user_id: ${user.user_id}`);
      } else {
        console.log(`[DEBUG /auth/me] No clinic_staff record found for user_id: ${user.user_id}`);
      }
    } else {
      console.log(`[DEBUG /auth/me] Unknown role: ${user.role_name} for user_id: ${user.user_id}`);
    }

    const responseData = {
      id: String(user.user_id),
      email: user.email,
      name: `${user.first_name} ${user.last_name}`.trim(),
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role_name,
      clinicId: user.clinic_id ? String(user.clinic_id) : null,
      clinic_id: user.clinic_id,
      patient_id: patient_id,
      doctor_id: doctor_id,
      clinic_staff_id: clinic_staff_id
    };

    console.log(`[DEBUG /auth/me] Response data:`, {
      user_id: responseData.id,
      role: responseData.role,
      patient_id: responseData.patient_id,
      doctor_id: responseData.doctor_id,
      clinic_staff_id: responseData.clinic_staff_id,
      clinic_id: responseData.clinic_id
    });
    
    res.json(responseData);
  } catch (error) {
    console.error('[ERROR /auth/me] Error:', error);
    console.error('[ERROR /auth/me] Stack:', error.stack);
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

