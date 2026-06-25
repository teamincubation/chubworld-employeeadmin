const securityController = require('../controllers/securityController');

// Mock request and response
function createMockReq(user, params = {}, body = {}) {
  return {
    user,
    params,
    body,
    ip: '127.0.0.1',
    headers: { 'user-agent': 'Node Test Runner' }
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(payload) {
      this.data = payload;
      return this;
    }
  };
  return res;
}

// Mock Supabase
const supabaseMock = require('../config/db');

// Save original methods
const originalFrom = supabaseMock.from;

async function runTests() {
  console.log('🧪 Starting Backend User Hierarchy Permission Tests...');

  const usersMap = {
    1: { id: 1, email: 'superadmin@chub.com', status: 'active', role_id: 1, roles: { name: 'Super Admin' } },
    2: { id: 2, email: 'controller@chub.com', status: 'active', role_id: 7, roles: { name: 'Admin Controller' } },
    3: { id: 3, email: 'subadmin@chub.com', status: 'active', role_id: 2, roles: { name: 'Admin' } },
    4: { id: 4, email: 'employee@chub.com', status: 'active', role_id: 6, roles: { name: 'Employee' } },
    5: { id: 5, email: 'another_super@chub.com', status: 'active', role_id: 1, roles: { name: 'Super Admin' } }
  };

  // Mock supabase.from() to intercept queries
  supabaseMock.from = function(tableName) {
    return {
      select: function(columns) {
        return {
          eq: function(field, value) {
            if (tableName === 'users' && field === 'id') {
              const user = usersMap[value];
              const result = user ? [user] : [];
              return Promise.resolve({ data: result, error: null });
            }
            return {
              single: function() {
                if (tableName === 'users' && field === 'id') {
                  const user = usersMap[value];
                  return Promise.resolve({ data: user || null, error: user ? null : new Error('Not found') });
                }
                return Promise.resolve({ data: null, error: new Error('Not found') });
              }
            };
          }
        };
      },
      update: function(data) {
        return {
          eq: function(field, value) {
            return Promise.resolve({ error: null });
          }
        };
      }
    };
  };

  // Test cases: [actor, targetId, expectedStatus, testDescription]
  const statusTestCases = [
    // Super Admin tests
    [{ id: 1, roleName: 'Super Admin' }, 1, 403, 'Super Admin: self status toggle should be blocked'],
    [{ id: 1, roleName: 'Super Admin' }, 5, 200, 'Super Admin: toggle other Super Admin should succeed'],
    [{ id: 1, roleName: 'Super Admin' }, 2, 200, 'Super Admin: toggle Admin Controller should succeed'],
    [{ id: 1, roleName: 'Super Admin' }, 3, 200, 'Super Admin: toggle Sub-admin should succeed'],
    [{ id: 1, roleName: 'Super Admin' }, 4, 200, 'Super Admin: toggle Employee should succeed'],

    // Admin Controller tests
    [{ id: 2, roleName: 'Admin Controller' }, 2, 403, 'Admin Controller: self status toggle should be blocked'],
    [{ id: 2, roleName: 'Admin Controller' }, 1, 403, 'Admin Controller: toggle Super Admin should be blocked'],
    [{ id: 2, roleName: 'Admin Controller' }, 3, 200, 'Admin Controller: toggle Sub-admin should succeed'],
    [{ id: 2, roleName: 'Admin Controller' }, 4, 200, 'Admin Controller: toggle Employee should succeed'],

    // Sub-admin tests
    [{ id: 3, roleName: 'Admin' }, 3, 403, 'Sub-admin: self status toggle should be blocked'],
    [{ id: 3, roleName: 'Admin' }, 1, 403, 'Sub-admin: toggle Super Admin should be blocked'],
    [{ id: 3, roleName: 'Admin' }, 2, 403, 'Sub-admin: toggle Admin Controller should be blocked'],
    [{ id: 3, roleName: 'Admin' }, 4, 200, 'Sub-admin: toggle Employee should succeed']
  ];

  for (const tc of statusTestCases) {
    const [actor, targetId, expectedStatus, desc] = tc;
    const req = createMockReq(actor, { userId: targetId }, { status: 'inactive' });
    const res = createMockRes();
    await securityController.toggleUserStatus(req, res);
    if (res.statusCode === expectedStatus) {
      console.log(`✅ ${desc} (Status: ${res.statusCode})`);
    } else {
      console.error(`❌ ${desc} (Expected: ${expectedStatus}, Got: ${res.statusCode}, Message: ${res.data?.message || 'N/A'})`);
    }
  }

  console.log('\n🧪 Starting Backend User Password Reset Permission Tests...');
  const resetTestCases = [
    [{ id: 1, roleName: 'Super Admin' }, 1, 403, 'Super Admin: self password reset should be blocked'],
    [{ id: 1, roleName: 'Super Admin' }, 2, 200, 'Super Admin: reset Admin Controller should succeed'],
    [{ id: 2, roleName: 'Admin Controller' }, 2, 403, 'Admin Controller: self password reset should be blocked'],
    [{ id: 2, roleName: 'Admin Controller' }, 1, 403, 'Admin Controller: reset Super Admin should be blocked'],
    [{ id: 3, roleName: 'Admin' }, 4, 200, 'Sub-admin: reset Employee should succeed'],
    [{ id: 3, roleName: 'Admin' }, 2, 403, 'Sub-admin: reset Admin Controller should be blocked']
  ];

  for (const tc of resetTestCases) {
    const [actor, targetId, expectedStatus, desc] = tc;
    const req = createMockReq(actor, { userId: targetId }, { newPassword: 'securePassword123' });
    const res = createMockRes();
    await securityController.adminResetPassword(req, res);
    if (res.statusCode === expectedStatus) {
      console.log(`✅ ${desc} (Status: ${res.statusCode})`);
    } else {
      console.error(`❌ ${desc} (Expected: ${expectedStatus}, Got: ${res.statusCode}, Message: ${res.data?.message || 'N/A'})`);
    }
  }

  // Restore original supabase methods
  supabaseMock.from = originalFrom;
  console.log('🧪 Permissions verification completed.');
}

runTests().catch(err => console.error('Test suite error:', err));
