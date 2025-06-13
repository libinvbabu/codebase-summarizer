// Enhanced test service with more comprehensive patterns
import { PaymentService } from './PaymentService.js';
import { NotificationService } from './NotificationService.js';
import { AuditService } from './AuditService.js';

export class OrderService {
  constructor(paymentService, notificationService, auditService) {
    this.paymentService = paymentService;
    this.notificationService = notificationService;
    this.auditService = auditService;
  }

  async createOrder(orderData) {
    try {
      // Validate input data
      this.validateOrderData(orderData);
      
      // Calculate total amount
      const totalAmount = this.calculateTotal(orderData.items);
      
      // Process payment
      const payment = await this.paymentService.processPayment({
        amount: totalAmount,
        userId: orderData.userId,
        paymentMethod: orderData.paymentMethod
      });
      
      // Create order in database
      const order = await this.saveOrder({
        ...orderData,
        totalAmount,
        paymentId: payment.id,
        status: 'confirmed'
      });
      
      // Send confirmation notification
      await this.notificationService.sendOrderConfirmation(order);
      
      // Log audit trail
      await this.auditService.logOrderCreation(order, orderData.userId);
      
      return order;
    } catch (error) {
      // Handle errors
      await this.auditService.logOrderError(error, orderData);
      throw error;
    }
  }

  async updateOrderStatus(orderId, newStatus) {
    // Find order
    const order = await this.findOrderById(orderId);
    
    // Update status
    order.status = newStatus;
    await this.saveOrder(order);
    
    // Send status update notification
    await this.notificationService.sendStatusUpdate(order);
    
    return order;
  }

  validateOrderData(data) {
    if (!data.userId) throw new Error('User ID required');
    if (!data.items || data.items.length === 0) throw new Error('Cart is empty');
    if (!data.paymentMethod) throw new Error('Payment method required');
  }

  calculateTotal(items) {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  async saveOrder(orderData) {
    // Database save operation
    return { id: 'order_' + Date.now(), ...orderData, createdAt: new Date() };
  }

  async findOrderById(orderId) {
    // Database query operation
    return { id: orderId, status: 'pending' };
  }
}
