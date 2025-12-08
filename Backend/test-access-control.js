// Test script for Access Control System
const API_BASE = 'http://localhost:3001';

async function testAccessControl() {
  console.log('🧪 Testing Access Control System\n');

  // Test 1: Login as different users
  console.log('Test 1: Testing Authentication');
  /** @type {Record<string, string>} */
  let tokens = {};

  try {
    // Login as patient
    const patientLogin = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'patient@example.com',
        password: 'password123',
      }),
    });
    const patientData = await patientLogin.json();
    tokens.patient = patientData.token;
    console.log('✅ Patient login successful:', patientData.user.name, `(${patientData.user.role})`);

    // Login as doctor
    const doctorLogin = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'doctor@example.com',
        password: 'password123',
      }),
    });
    const doctorData = await doctorLogin.json();
    tokens.doctor = doctorData.token;
    console.log('✅ Doctor login successful:', doctorData.user.name, `(${doctorData.user.role})`);

    // Login as clinic/admin
    const adminLogin = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'password123',
      }),
    });
    const adminData = await adminLogin.json();
    tokens.admin = adminData.token;
    console.log('✅ Admin login successful:', adminData.user.name, `(${adminData.user.role})`);

    // 🔹 Login as marketing admin
    const marketingLogin = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // adjust to your seeded user
        email: 'marketing@example.com',
        password: 'password123',
      }),
    });

    if (!marketingLogin.ok) {
      const err = await marketingLogin.text();
      console.warn('⚠️ Marketing admin login failed:', marketingLogin.status, err);
    } else {
      const marketingData = await marketingLogin.json();
      tokens.marketing = marketingData.token;
      console.log(
        '✅ Marketing admin login successful:',
        marketingData.user.name,
        `(${marketingData.user.role})`
      );
    }
  } catch (error) {
    console.error('❌ Login test failed:', error.message);
    return;
  }

  // Test 2: Check permissions
  console.log('\nTest 2: Checking Permissions');

  try {
    // Patient should have basic self-profile permission
    const checkPatientPerm = await fetch(`${API_BASE}/api/access-control/check-permission`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.patient}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        permission: 'VIEW_OWN_PROFILE',
      }),
    });
    const patientPermResult = await checkPatientPerm.json();
    console.log('✅ Patient has VIEW_OWN_PROFILE:', patientPermResult.hasAccess);
  } catch (error) {
    console.error('❌ Patient permission check failed:', error.message);
  }

  try {
    // Marketing admin should be able to manage campaigns (adjust permission string to your backend)
    if (tokens.marketing) {
      const checkMarketingPerm = await fetch(
        `${API_BASE}/api/access-control/check-permission`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.marketing}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            permission: 'MANAGE_MARKETING_CAMPAIGNS',
          }),
        }
      );
      const marketingPermResult = await checkMarketingPerm.json();
      console.log(
        '✅ Marketing admin MANAGE_MARKETING_CAMPAIGNS:',
        marketingPermResult.hasAccess
      );
    } else {
      console.log('⚠️ Skipping marketing permission test (no marketing token)');
    }
  } catch (error) {
    console.error('❌ Marketing permission check failed:', error.message);
  }

  // Test 3: Access control - Try to view all users (admin only)
  console.log('\nTest 3: Testing Access Control (admin-only endpoint)');

  try {
    // Patient trying to access admin endpoint
    const patientReq = await fetch(`${API_BASE}/api/access-control/users`, {
      headers: { Authorization: `Bearer ${tokens.patient}` },
    });
    console.log('Patient trying to view all users: HTTP', patientReq.status);

    // Marketing admin trying to access admin-only endpoint
    if (tokens.marketing) {
      const marketingReq = await fetch(`${API_BASE}/api/access-control/users`, {
        headers: { Authorization: `Bearer ${tokens.marketing}` },
      });
      console.log(
        'Marketing admin trying to view all users: HTTP',
        marketingReq.status
      );
    } else {
      console.log('⚠️ Skipping marketing /users test (no marketing token)');
    }

    // Admin accessing admin endpoint
    const adminReq = await fetch(`${API_BASE}/api/access-control/users`, {
      headers: { Authorization: `Bearer ${tokens.admin}` },
    });
    const adminResult = await adminReq.json();
    console.log(
      '✅ Admin can view all users:',
      adminResult.users ? 'Yes' : 'No'
    );
  } catch (error) {
    console.error('❌ Access control test failed:', error.message);
  }

  // Test 4: View audit logs (admin-only)
  console.log('\nTest 4: Testing Audit Logs');

  try {
    const auditLogs = await fetch(`${API_BASE}/api/access-control/audit-logs`, {
      headers: { Authorization: `Bearer ${tokens.admin}` },
    });
    const logs = await auditLogs.json();
    console.log(
      '✅ Audit logs retrieved:',
      logs.logs ? logs.logs.length : 0,
      'logs'
    );
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
