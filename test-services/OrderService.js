// Test service to demonstrate service interaction extraction
import { PaymentService } from './PaymentService.js';
import { NotificationService } from './NotificationService.js';

export class OrderService {
  constructor(paymentService, notificationService) {
    this.paymentService = paymentService;
    this.notificationService = notificationService;
  }

  async createOrder(orderData) {
    // Validate cart
    this.validateCart(orderData.cart);
    
    // Call PaymentService
    const payment = await this.paymentService.processPayment(orderData.amount);
    
    // Create order
    const order = await this.saveOrder(orderData, payment);
    
    // Send notification
    await this.notificationService.sendOrderConfirmation(order);
    
    return order;
  }

  validateCart(cart) {
    if (!cart || cart.items.length === 0) {
      throw new Error('Cart is empty');
    }
  }

  async saveOrder(orderData, payment) {
    // Save to database
    return { id: 'order_123', ...orderData, paymentId: payment.id };
  }
}
