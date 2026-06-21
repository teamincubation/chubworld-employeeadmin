const supabase = require('../config/db');

/**
 * Redact sensitive fields from objects before writing to logs
 */
function redactSensitiveData(data) {
  if (!data) return null;
  if (typeof data !== 'object') return data;
  
  const copy = JSON.parse(JSON.stringify(data));
  const sensitiveKeys = [
    'password', 'password_hash', 'passwordHash', 'token', 
    'aadhaar_number', 'pan_number', 'bank_account_number', 'upi_id',
    'aadhaar_number_encrypted', 'pan_number_encrypted', 'bank_account_number_encrypted'
  ];

  const redact = (obj) => {
    for (let key in obj) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        obj[key] = '[REDACTED_SENSITIVE_DATA]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        redact(obj[key]);
      }
    }
  };

  redact(copy);
  return JSON.stringify(copy);
}

/**
 * System Audit Logger
 */
async function logAudit(req, actionType, targetRecord = null, oldValue = null, newValue = null) {
  try {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    let userId = null;
    let performedBy = 'System/Public';
    let role = 'Public';
    
    if (req.user) {
      userId = req.user.id;
      performedBy = req.user.email;
      role = req.user.roleName || 'User';
    }

    if (performedBy === 'chub.admin@adloaf.com' || role === 'Super Admin') {
      return;
    }

    await supabase.from('audit_logs').insert([{
      user_id: userId,
      action_type: actionType,
      performed_by: performedBy,
      role: role,
      target_record: targetRecord,
      old_value: redactSensitiveData(oldValue),
      new_value: redactSensitiveData(newValue),
      ip_address: ipAddress,
      user_agent: userAgent
    }]);
  } catch (err) {
    console.error('Audit logging failed:', err.message);
  }
}

module.exports = {
  logAudit,
  redactSensitiveData
};
