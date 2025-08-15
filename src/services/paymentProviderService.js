const axios = require('axios');

/**
 * Payment Provider Integration Service
 * Handles integration with mobile money and other payment providers
 * This is where the signatory's approval triggers the actual payment request
 */

class PaymentProviderService {
  constructor() {
    this.providers = {
      vodacom: {
        baseUrl: process.env.VODACOM_API_URL || 'https://api.vodacom.co.tz',
        apiKey: process.env.VODACOM_API_KEY,
        enabled: process.env.VODACOM_ENABLED === 'true'
      },
      tigo: {
        baseUrl: process.env.TIGO_API_URL || 'https://api.tigo.co.tz',
        apiKey: process.env.TIGO_API_KEY,
        enabled: process.env.TIGO_ENABLED === 'true'
      },
      airtel: {
        baseUrl: process.env.AIRTEL_API_URL || 'https://api.airtel.co.tz',
        apiKey: process.env.AIRTEL_API_KEY,
        enabled: process.env.AIRTEL_ENABLED === 'true'
      }
    };
  }

  /**
   * Determine the appropriate payment provider based on phone number
   */
  getProviderFromPhoneNumber(phoneNumber) {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    
    // Vodacom prefixes (Tanzania)
    if (cleanPhone.match(/^(255)?(75|76|77|78)/)) {
      return 'vodacom';
    }
    
    // Tigo prefixes
    if (cleanPhone.match(/^(255)?(71|65|67)/)) {
      return 'tigo';
    }
    
    // Airtel prefixes
    if (cleanPhone.match(/^(255)?(68|69|78)/)) {
      return 'airtel';
    }
    
    // Default to vodacom if can't determine
    return 'vodacom';
  }

  /**
   * Format phone number for API calls
   */
  formatPhoneNumber(phoneNumber, provider) {
    let cleaned = phoneNumber.replace(/[^0-9]/g, '');
    
    // Ensure it starts with country code
    if (cleaned.startsWith('0')) {
      cleaned = '255' + cleaned.substring(1);
    } else if (!cleaned.startsWith('255')) {
      cleaned = '255' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Initiate payment with the appropriate provider
   * This is called by the signatory after approval
   */
  async initiatePayment({
    amount,
    recipient_phone,
    recipient_name,
    purpose,
    transaction_reference,
    initiated_by_signatory
  }) {
    try {
      const provider = this.getProviderFromPhoneNumber(recipient_phone);
      const formattedPhone = this.formatPhoneNumber(recipient_phone, provider);
      
      console.log(`Initiating payment via ${provider} to ${formattedPhone} for amount ${amount}`);
      
      switch (provider) {
        case 'vodacom':
          return await this.initiateVodacomPayment({
            amount,
            recipient_phone: formattedPhone,
            recipient_name,
            purpose,
            transaction_reference,
            initiated_by_signatory
          });
          
        case 'tigo':
          return await this.initiatetigoPayment({
            amount,
            recipient_phone: formattedPhone,
            recipient_name,
            purpose,
            transaction_reference,
            initiated_by_signatory
          });
          
        case 'airtel':
          return await this.initiateAirtelPayment({
            amount,
            recipient_phone: formattedPhone,
            recipient_name,
            purpose,
            transaction_reference,
            initiated_by_signatory
          });
          
        default:
          throw new Error(`Unsupported payment provider: ${provider}`);
      }
      
    } catch (error) {
      console.error('Payment provider initiation error:', error);
      return {
        success: false,
        error: error.message,
        provider: provider || 'unknown'
      };
    }
  }

  /**
   * Vodacom M-Pesa Integration
   */
  async initiateVodacomPayment({ amount, recipient_phone, recipient_name, purpose, transaction_reference, initiated_by_signatory }) {
    try {
      if (!this.providers.vodacom.enabled) {
        throw new Error('Vodacom payment provider is disabled');
      }

      const payload = {
        BusinessShortCode: process.env.VODACOM_BUSINESS_CODE,
        Password: process.env.VODACOM_PASSWORD,
        Timestamp: new Date().toISOString().replace(/[^0-9]/g, '').substring(0, 14),
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: process.env.VODACOM_PAYBILL_NUMBER, // Organization's paybill
        PartyB: recipient_phone,
        PhoneNumber: recipient_phone,
        CallBackURL: `${process.env.BASE_URL}/api/payments/vodacom/callback`,
        AccountReference: transaction_reference,
        TransactionDesc: `MREDEO Payment: ${purpose}`,
        Initiator: initiated_by_signatory
      };

      const response = await axios.post(
        `${this.providers.vodacom.baseUrl}/mpesa/stkpush/v1/processrequest`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.providers.vodacom.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data.ResponseCode === '0') {
        return {
          success: true,
          provider: 'vodacom',
          provider_reference: response.data.CheckoutRequestID,
          message: 'Payment request sent to recipient phone',
          response_data: response.data
        };
      } else {
        throw new Error(response.data.ResponseDescription || 'Vodacom API error');
      }

    } catch (error) {
      console.error('Vodacom payment error:', error);
      return {
        success: false,
        provider: 'vodacom',
        error: error.message
      };
    }
  }

  /**
   * Tigo Pesa Integration
   */
  async initiatetigoPayment({ amount, recipient_phone, recipient_name, purpose, transaction_reference, initiated_by_signatory }) {
    try {
      if (!this.providers.tigo.enabled) {
        throw new Error('Tigo payment provider is disabled');
      }

      // Tigo Pesa API integration
      const payload = {
        amount: amount,
        phone: recipient_phone,
        reference: transaction_reference,
        description: `MREDEO Payment: ${purpose}`,
        callback_url: `${process.env.BASE_URL}/api/payments/tigo/callback`,
        initiator: initiated_by_signatory
      };

      const response = await axios.post(
        `${this.providers.tigo.baseUrl}/v1/payments/request`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.providers.tigo.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data.status === 'success') {
        return {
          success: true,
          provider: 'tigo',
          provider_reference: response.data.transaction_id,
          message: 'Payment request sent to recipient phone',
          response_data: response.data
        };
      } else {
        throw new Error(response.data.message || 'Tigo API error');
      }

    } catch (error) {
      console.error('Tigo payment error:', error);
      return {
        success: false,
        provider: 'tigo',
        error: error.message
      };
    }
  }

  /**
   * Airtel Money Integration
   */
  async initiateAirtelPayment({ amount, recipient_phone, recipient_name, purpose, transaction_reference, initiated_by_signatory }) {
    try {
      if (!this.providers.airtel.enabled) {
        throw new Error('Airtel payment provider is disabled');
      }

      // Airtel Money API integration
      const payload = {
        reference: transaction_reference,
        subscriber: {
          country: "TZ",
          currency: "TZS",
          msisdn: recipient_phone
        },
        transaction: {
          amount: amount,
          country: "TZ",
          currency: "TZS",
          id: transaction_reference
        },
        description: `MREDEO Payment: ${purpose}`,
        callback_url: `${process.env.BASE_URL}/api/payments/airtel/callback`,
        initiator: initiated_by_signatory
      };

      const response = await axios.post(
        `${this.providers.airtel.baseUrl}/merchant/v1/payments/`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.providers.airtel.apiKey}`,
            'Content-Type': 'application/json',
            'X-Country': 'TZ',
            'X-Currency': 'TZS'
          },
          timeout: 30000
        }
      );

      if (response.data.status && response.data.status.code === '200') {
        return {
          success: true,
          provider: 'airtel',
          provider_reference: response.data.data.transaction.id,
          message: 'Payment request sent to recipient phone',
          response_data: response.data
        };
      } else {
        throw new Error(response.data.status?.message || 'Airtel API error');
      }

    } catch (error) {
      console.error('Airtel payment error:', error);
      return {
        success: false,
        provider: 'airtel',
        error: error.message
      };
    }
  }

  /**
   * Check payment status from provider
   */
  async checkPaymentStatus(provider, providerReference) {
    try {
      switch (provider) {
        case 'vodacom':
          return await this.checkVodacomStatus(providerReference);
        case 'tigo':
          return await this.checkTigoStatus(providerReference);
        case 'airtel':
          return await this.checkAirtelStatus(providerReference);
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      console.error('Payment status check error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Status check methods for each provider would be implemented here
  async checkVodacomStatus(checkoutRequestId) {
    // Implementation for checking Vodacom payment status
    return { status: 'pending' };
  }

  async checkTigoStatus(transactionId) {
    // Implementation for checking Tigo payment status
    return { status: 'pending' };
  }

  async checkAirtelStatus(transactionId) {
    // Implementation for checking Airtel payment status
    return { status: 'pending' };
  }
}

// Create singleton instance
const paymentProviderService = new PaymentProviderService();

/**
 * Main function called by admin controller
 * This is triggered when signatory approves a payment
 */
const initiatePaymentWithProvider = async (paymentData) => {
  return await paymentProviderService.initiatePayment(paymentData);
};

module.exports = {
  PaymentProviderService,
  initiatePaymentWithProvider,
  checkPaymentStatus: (provider, reference) => paymentProviderService.checkPaymentStatus(provider, reference)
};
