module.exports = {
  USER_ROLES: {
    MEMBER: 'member',
    ADMIN_CHAIRPERSON: 'admin_chairperson',
    ADMIN_SECRETARY: 'admin_secretary',
    ADMIN_SIGNATORY: 'admin_signatory',
    ADMIN_TREASURER: 'admin_treasurer'
  },
  
  PAYMENT_STATUS: {
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed'
  },
  
  TELCO_PROVIDERS: {
    VODACOM: 'vodacom',
    TIGO: 'tigo',
    AIRTEL: 'airtel',
    HALOTEL: 'halotel',
    ZANTEL: 'zantel',
    OTHER: 'other'
  },
  
  OTP_PURPOSES: {
    SIGNUP: 'signup',
    LOGIN: 'login',
    RESET_PASSWORD: 'reset_password'
  },
  
  AUDIT_ACTIONS: {
    USER_SIGNUP: 'user_signup',
    USER_LOGIN: 'user_login',
    USER_LOGOUT: 'user_logout',
    PASSWORD_RESET: 'password_reset',
    PROFILE_UPDATE: 'profile_update',
    PAYMENT_MADE: 'payment_made',
    PAYMENT_ISSUED: 'payment_issued',
    NOTIFICATION_SENT: 'notification_sent'
  }
};
