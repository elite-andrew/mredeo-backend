// Mock SMS service - replace with your preferred SMS provider
const sendSMS = async (phoneNumber, message) => {
  try {
    // Example implementation for a generic SMS provider
    // Replace with your actual SMS service (Twilio, Africa's Talking, etc.)
    
    console.log(`SMS sent to ${phoneNumber}: ${message}`);
    
    // Mock API call
    /*
    const response = await fetch('https://api.sms-provider.com/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SMS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: phoneNumber,
        message: message
      })
    });
    
    if (!response.ok) {
      throw new Error('SMS sending failed');
    }
    */
    
    return { success: true };
  } catch (error) {
    console.error('SMS sending error:', error);
    throw error;
  }
};

const sendOTP = async (phoneNumber, otpCode) => {
  const message = `Your MREDEO verification code is: ${otpCode}. Valid for 10 minutes.`;
  return await sendSMS(phoneNumber, message);
};

module.exports = {
  sendSMS,
  sendOTP
};
