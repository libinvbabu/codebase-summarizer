import { StripeService } from './StripeService.js';
import { PayPalService } from './PayPalService.js';
import { AuthService } from './AuthService.js';

export class PaymentService {
  constructor(stripeService, paypalService, authService) {
    this.stripeService = stripeService;
    this.paypalService = paypalService;
    this.authService = authService;
  }

  async processPayment(paymentData) {
    try {
      // Validate payment data
      this.validatePaymentData(paymentData);
      
      // Authenticate payment
      await this.authService.validatePaymentAuth(paymentData.userId);
      
      // Calculate fees
      const fees = this.calculateFees(paymentData.amount);
      
      let paymentResult;
      
      // Process based on payment method
      switch (paymentData.paymentMethod) {
        case 'stripe':
          paymentResult = await this.stripeService.chargeCard(paymentData);
          break;
        case 'paypal':
          paymentResult = await this.paypalService.processPayment(paymentData);
          break;
        default:
          throw new Error('Unsupported payment method');
      }
      
      // Save payment record
      const payment = await this.savePayment({
        ...paymentResult,
        fees,
        originalAmount: paymentData.amount
      });
      
      return payment;
    } catch (error) {
      // Handle payment errors
      await this.logPaymentError(error, paymentData);
      throw error;
    }
  }

  async refundPayment(paymentId, amount) {
    // Find original payment
    const payment = await this.findPaymentById(paymentId);
    
    // Process refund
    const refund = await this.processRefund(payment, amount);
    
    return refund;
  }

  validatePaymentData(data) {
    if (!data.amount || data.amount <= 0) {
      throw new Error('Invalid payment amount');
    }
    if (!data.paymentMethod) {
      throw new Error('Payment method required');
    }
  }

  calculateFees(amount) {
    return amount * 0.029 + 0.30; // 2.9% + $0.30
  }

  async savePayment(paymentData) {
    // Save to database
    return { id: 'pay_' + Date.now(), ...paymentData };
  }

  async findPaymentById(paymentId) {
    // Database query
    return { id: paymentId, status: 'completed' };
  }

  async processRefund(payment, amount) {
    // Refund logic
    return { id: 'ref_' + Date.now(), originalPayment: payment.id, amount };
  }

  async logPaymentError(error, paymentData) {
    // Error logging
    console.error('Payment error:', error, paymentData);
  }
}
