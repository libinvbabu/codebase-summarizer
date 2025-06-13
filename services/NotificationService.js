import { EmailService } from './EmailService.js';
import { SmsService } from './SmsService.js';
import { PushNotificationService } from './PushNotificationService.js';

export class NotificationService {
  constructor(emailService, smsService, pushService) {
    this.emailService = emailService;
    this.smsService = smsService;
    this.pushService = pushService;
  }

  async sendOrderConfirmation(order) {
    try {
      // Send email confirmation
      await this.emailService.sendOrderConfirmation(order);
      
      // Send SMS if phone number available
      if (order.customerPhone) {
        await this.smsService.sendOrderSMS(order);
      }
      
      // Send push notification if user has app
      if (order.pushToken) {
        await this.pushService.sendOrderPush(order);
      }
      
      return { success: true, channels: ['email', 'sms', 'push'] };
    } catch (error) {
      throw new Error(`Notification failed: ${error.message}`);
    }
  }

  async sendStatusUpdate(order) {
    const message = `Your order ${order.orderId} status: ${order.status}`;
    
    // Send via all available channels
    await Promise.all([
      this.emailService.sendStatusUpdate(order, message),
      this.smsService.sendStatusSMS(order, message),
      this.pushService.sendStatusPush(order, message)
    ]);
  }
}
