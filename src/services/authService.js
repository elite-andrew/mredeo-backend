const crypto = require('crypto');

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Deprecated: Passwords are managed by Firebase Authentication
const hashPassword = async () => {
  throw new Error('hashPassword is deprecated. Use Firebase Authentication.');
};

const verifyPassword = async () => {
  throw new Error('verifyPassword is deprecated. Use Firebase Authentication.');
};

module.exports = {
  generateOTP,
  generateSecureToken,
  hashPassword,
  verifyPassword
};
