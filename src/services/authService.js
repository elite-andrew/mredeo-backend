const crypto = require('crypto');

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

const hashPassword = async (password) => {
  const bcrypt = require('bcrypt');
  const config = require('../config/environment');
  return await bcrypt.hash(password, config.security.bcryptRounds);
};

const verifyPassword = async (password, hashedPassword) => {
  const bcrypt = require('bcrypt');
  return await bcrypt.compare(password, hashedPassword);
};

module.exports = {
  generateOTP,
  generateSecureToken,
  hashPassword,
  verifyPassword
};
