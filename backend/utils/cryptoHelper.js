const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Ensure there is a 32-byte key for AES-256-CBC. Fallback to a hardcoded string if not set.
// A real deployment must override this in the .env file.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') 
  : crypto.scryptSync('chub_system_key_2026_wow_world', 'salt', 32);

const IV_LENGTH = 16; // AES IV size

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // Store iv + encrypted ciphertext in one block
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text) return null;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return '[DECRYPTION_ERROR]';
  }
}

/**
 * Utility for masking data
 */
function maskValue(value, type) {
  if (!value) return '';
  value = value.trim();
  
  if (type === 'aadhaar') {
    // 12 digits, mask first 8 -> XXXX XXXX 1234
    const clean = value.replace(/\s/g, '');
    if (clean.length === 12) {
      return `XXXX XXXX ${clean.substring(8)}`;
    }
    return `XXXX XXXX ${value.slice(-4)}`;
  }
  
  if (type === 'pan') {
    // 10 alphanumeric digits, mask first 6 -> XXXXX1234X
    if (value.length === 10) {
      return `XXXXX${value.substring(5, 9)}${value.substring(9)}`;
    }
    return `XXXXX${value.slice(-5)}`;
  }
  
  if (type === 'bank') {
    // Mask all but last 4 digits -> XXXXXX1234
    if (value.length > 4) {
      return 'X'.repeat(value.length - 4) + value.slice(-4);
    }
    return 'XXXX' + value;
  }

  if (type === 'upi') {
    // xxx***@xxx
    const parts = value.split('@');
    if (parts.length === 2) {
      const handle = parts[0];
      const provider = parts[1];
      if (handle.length > 2) {
        return `${handle.substring(0, 2)}***@${provider}`;
      }
      return `***@${provider}`;
    }
    return '***@upi';
  }

  return 'XXXXXXXX';
}

module.exports = {
  encrypt,
  decrypt,
  maskValue
};
