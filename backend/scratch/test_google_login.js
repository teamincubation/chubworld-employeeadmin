module.paths.push('d:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/node_modules');
require('dotenv').config({ path: 'd:/Adnan Vellicheri/WORKS/CHUB/ERP/backend/.env' });

const authController = require('../controllers/authController');

function createMockReq(body) {
  return {
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

async function run() {
  console.log('🧪 Testing googleLogin backend endpoint...');

  // Case 1: No token provided
  console.log('Case 1: No token');
  const req1 = createMockReq({});
  const res1 = createMockRes();
  await authController.googleLogin(req1, res1);
  console.log('Status (expected 400):', res1.statusCode);
  console.log('Response:', res1.data);

  // Case 2: Invalid token provided
  console.log('\nCase 2: Invalid Google token');
  const req2 = createMockReq({ token: 'fake-google-token-123' });
  const res2 = createMockRes();
  await authController.googleLogin(req2, res2);
  console.log('Status (expected 401):', res2.statusCode);
  console.log('Response:', res2.data);

  console.log('\n🧪 Testing complete.');
}

run().catch(err => console.error('Test error:', err));
