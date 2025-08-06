// Mock email service - replace with your preferred email provider
const nodemailer = require('nodemailer');

// Configure email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

const sendEmail = async (to, subject, htmlContent, textContent) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"MREDEO Union" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      text: textContent,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};

const sendWelcomeEmail = async (email, fullName) => {
  const subject = 'Welcome to MREDEO Union';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c5aa0;">Welcome to MREDEO Union!</h2>
      <p>Dear ${fullName},</p>
      <p>Thank you for joining the MREDEO Educational Officers Union. Your account has been successfully created.</p>
      <p>You can now:</p>
      <ul>
        <li>Make contributions</li>
        <li>View payment history</li>
        <li>Receive important notifications</li>
        <li>Access union resources</li>
      </ul>
      <p>If you have any questions, please don't hesitate to contact us.</p>
      <p>Best regards,<br>MREDEO Union Team</p>
    </div>
  `;
  const textContent = `Welcome to MREDEO Union, ${fullName}! Your account has been successfully created.`;
  
  return await sendEmail(email, subject, htmlContent, textContent);
};

const sendPasswordResetEmail = async (email, fullName, otpCode) => {
  const subject = 'Password Reset Request';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c5aa0;">Password Reset Request</h2>
      <p>Dear ${fullName},</p>
      <p>You requested to reset your password. Use the OTP code below:</p>
      <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; margin: 20px 0;">
        ${otpCode}
      </div>
      <p>This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
      <p>Best regards,<br>MREDEO Union Team</p>
    </div>
  `;
  const textContent = `Password reset OTP: ${otpCode}. Valid for 10 minutes.`;
  
  return await sendEmail(email, subject, htmlContent, textContent);
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail
};
