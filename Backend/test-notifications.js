/**
 * Test script to help set up and test notifications
 * 
 * This script helps you:
 * 1. Create a patient in in-memory storage (for testing notifications)
 * 2. Create a doctor/provider account
 * 3. Test the notification flow
 */

const { createPatient, findPatientByUserId } = require('./src/repositories/MedicalRecordRepository');
const { query } = require('./src/db/connection');
require('dotenv').config();

async function setupTestPatient() {
  console.log('\n=== Setting up test patient for notifications ===\n');

  try {
    // Get user from database (assuming you've registered via UI)
    console.log('Please enter the email of the patient you registered:');
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Patient email: ', async (email) => {
      try {
        // Find user in database
        const userResult = await query(
          `SELECT u.user_id, u.email, u.first_name, u.last_name, u.phone_number, r.role_name
           FROM users u
           JOIN roles r ON u.role_id = r.role_id
           WHERE u.email = $1`,
          [email]
        );

        if (userResult.rows.length === 0) {
          console.log(`\n❌ No user found with email: ${email}`);
          console.log('Please register a patient account first via the UI at /register/patient/step1');
          rl.close();
          return;
        }

        const user = userResult.rows[0];
        
        if (user.role_name !== 'patient') {
          console.log(`\n❌ User with email ${email} is not a patient (role: ${user.role_name})`);
          rl.close();
          return;
        }

        // Check if patient already exists in in-memory storage
        const existingPatient = findPatientByUserId(user.user_id.toString());
        if (existingPatient) {
          console.log(`\n✅ Patient already exists in in-memory storage:`);
          console.log(`   ID: ${existingPatient.id}`);
          console.log(`   Name: ${existingPatient.fullName}`);
          console.log(`   Email: ${user.email}`);
          rl.close();
          return;
        }

        // Get patient data from database
        const patientResult = await query(
          `SELECT * FROM patients WHERE user_id = $1`,
          [user.user_id]
        );

        const patientData = patientResult.rows[0] || {};

        // Create patient in in-memory storage
        // Note: We need to add email to the patient object for email notifications
        const patient = createPatient({
          userId: user.user_id.toString(),
          firstName: user.first_name || 'Test',
          lastName: user.last_name || 'Patient',
          dateOfBirth: patientData.dob || '1990-01-01',
          gender: patientData.gender || 'other',
          phoneNumber: user.phone_number || '+1-555-0000',
          address: patientData.address ? JSON.parse(patientData.address) : {
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345'
          },
          emergencyContact: patientData.emergency_contact ? JSON.parse(patientData.emergency_contact) : null,
          insuranceInfo: null,
          allergies: patientData.allergies ? JSON.parse(patientData.allergies) : [],
          medicalHistory: patientData.medical_history ? JSON.parse(patientData.medical_history) : []
        });

        // Add email to patient object (needed for email notifications)
        // The Patient model doesn't have email, but we'll store it for notification service
        patient.email = user.email;

        console.log(`\n✅ Patient created in in-memory storage:`);
        console.log(`   ID: ${patient.id}`);
        console.log(`   Name: ${patient.fullName}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   User ID: ${patient.userId}`);
        console.log(`\n📝 Note: Patient email is stored in database. For email notifications to work,`);
        console.log(`   make sure the patient's email in the database matches the Resend verified email.`);

        rl.close();
      } catch (error) {
        console.error('\n❌ Error:', error.message);
        rl.close();
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupTestPatient();
}

module.exports = { setupTestPatient };

