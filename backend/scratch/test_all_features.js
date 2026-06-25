module.paths.push('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/node_modules');
require('dotenv').config({ path: 'd:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/.env' });

const securityController = require('../controllers/securityController');
const leaveController = require('../controllers/leaveController');
const supabase = require('../config/db');

// Mock request and response objects
function createMockReq(user) {
  return {
    user,
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

async function testAll() {
  console.log('🧪 Starting active sessions test suite...');

  // 1. Test getActiveSessions as Super Admin
  console.log('1. Testing getActiveSessions for Super Admin...');
  const reqSA = createMockReq({ id: 1, email: 'chub.admin@adloaf.com', roleName: 'Super Admin' });
  const resSA = createMockRes();
  await securityController.getActiveSessions(reqSA, resSA);
  console.log('Super Admin Response Status:', resSA.statusCode);
  if (resSA.statusCode === 200) {
    console.log('✅ Success! Active sessions count:', resSA.data.length);
    console.log('Session sample:', resSA.data[0]);
  } else {
    console.log('❌ Failed Super Admin active sessions query:', resSA.data);
  }

  // 2. Test getActiveSessions as Admin Controller
  console.log('2. Testing getActiveSessions for Admin Controller...');
  const reqAC = createMockReq({ id: 2, email: 'controller@chub.com', roleName: 'Admin Controller' });
  const resAC = createMockRes();
  await securityController.getActiveSessions(reqAC, resAC);
  console.log('Admin Controller Response Status:', resAC.statusCode);
  if (resAC.statusCode === 200) {
    console.log('✅ Success! Clocked-in employees count:', resAC.data.length);
    console.log('Employee sample:', resAC.data[0]);
  } else {
    console.log('❌ Failed Admin Controller active sessions query:', resAC.data);
  }

  console.log('🧪 Active sessions test suite completed.');
}

testAll().catch(err => console.error('Unexpected test failure:', err));
