// Test script for Access Control System
const API_BASE = 'http://localhost:3000';

async function testAccessControl() {
  console.log('🧪 Testing Access Control System\n');

  // Test 1: Login as different users
  console.log('Test 1: Testing Authentication');
  let tokens = {};

  try {
    // Login as patient
    const patientLogin = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'patient@example.com',
        password: 'password123'
      })
    });
    const patientData = await patientLogin.json();
    tokens.patient = patientData.token;
    console.log('✅ Patient login successful:', patientData.user.name);

    // Login as doctor
    const doctorLogin = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'doctor@example.com',
        password: 'password123'
      })
    });
    const doctorData = await doctorLogin.json();
    tokens.doctor = doctorData.token;
    console.log('✅ Doctor login successful:', doctorData.user.name);

    // Login as admin
    const adminLogin = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'password123'
      })
    });
    const adminData = await adminLogin.json();
    tokens.admin = adminData.token;
    console.log('✅ Admin login successful:', adminData.user.name);
  } catch (error) {
    console.error('❌ Login test failed:', error.message);
    return;
  }

  // Test 2: Check permissions
  console.log('\nTest 2: Checking Permissions');
  
  try {
    const checkPerm = await fetch(`${API_BASE}/api/access-control/check-permission`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.patient}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        permission: 'VIEW_OWN_PROFILE'
      })
    });
    const permResult = await checkPerm.json();
    console.log('✅ Patient has VIEW_OWN_PROFILE:', permResult.hasAccess);
  } catch (error) {
    console.error('❌ Permission check failed:', error.message);
  }

  // Test 3: Access control - Try to view all users (admin only)
  console.log('\nTest 3: Testing Access Control');
  
  try {
    // Patient trying to access admin endpoint
    const patientReq = await fetch(`${API_BASE}/api/access-control/users`, {
      headers: { 'Authorization': `Bearer ${tokens.patient}` }
    });
    const patientResult = await patientReq.json();
    console.log('Patient trying to view all users:', patientReq.status);
    
    // Admin accessing admin endpoint
    const adminReq = await fetch(`${API_BASE}/api/access-control/users`, {
      headers: { 'Authorization': `Bearer ${tokens.admin}` }
    });
    const adminResult = await adminReq.json();
    console.log('✅ Admin can view all users:', adminResult.users ? 'Yes' : 'No');
  } catch (error) {
    console.error('❌ Access control test failed:', error.message);
  }

  // Test 4: View audit logs
  console.log('\nTest 4: Testing Audit Logs');
  
  try {
    const auditLogs = await fetch(`${API_BASE}/api/access-control/audit-logs`, {
      headers: { 'Authorization': `Bearer ${tokens.admin}` }
    });
    const logs = await auditLogs.json();
    console.log('✅ Audit logs retrieved:', logs.logs ? logs.logs.length : 0, 'logs');
  } catch (error) {
    console.error('❌ Audit logs test failed:', error.message);
  }

  console.log('\n✅ All tests completed!');
}

// Run tests
if (require.main === module) {
  testAccessControl().catch(console.error);
}

module.exports = { testAccessControl };

