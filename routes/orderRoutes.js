// Enhanced test route with comprehensive auth and payload patterns
const express = require('express');
const Joi = require('joi');
const { celebrate } = require('celebrate');
const { jwtAuth, requireRole, requirePermission } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create a new order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               userId: { type: string }
 *               items: { type: array }
 *               shippingAddress: { type: object }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               properties:
 *                 orderId: { type: string }
 *                 status: { type: string }
 *                 totalAmount: { type: number }
 */
router.post('/orders', 
  jwtAuth(), 
  celebrate({
    body: Joi.object({
      userId: Joi.string().required(),
      customerEmail: Joi.string().email().required(),
      items: Joi.array().items(
        Joi.object({
          productId: Joi.string().required(),
          quantity: Joi.number().min(1).required(),
          unitPrice: Joi.number().min(0).required()
        })
      ).min(1).required(),
      shippingAddress: Joi.object({
        street: Joi.string().required(),
        city: Joi.string().required(),
        state: Joi.string().required(),
        zipCode: Joi.string().required(),
        country: Joi.string().required()
      }).required(),
      currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD').default('USD'),
      isGift: Joi.boolean().default(false),
      giftMessage: Joi.string().max(200).when('isGift', { is: true, then: Joi.required() }),
      notes: Joi.string().max(500)
    })
  }),
  async (req, res) => {
    const { userId, customerEmail, items, shippingAddress, currency, isGift, giftMessage, notes } = req.body;
    
    try {
      // Create order logic here
      const order = await orderService.createOrder({ 
        userId, 
        customerEmail, 
        items, 
        shippingAddress,
        currency,
        isGift,
        giftMessage,
        notes
      });
      
      res.json({
        orderId: order.orderId,
        status: order.status,
        totalAmount: order.totalAmount,
        estimatedDelivery: order.estimatedDelivery,
        createdAt: order.createdAt
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// User's own orders - requires authentication
router.get('/orders/my', 
  jwtAuth(),
  async (req, res) => {
    const userId = req.user.id;
    const orders = await orderService.getUserOrders(userId);
    res.json({ orders });
  }
);

// Specific order details - requires ownership or admin role
router.get('/orders/:orderId', 
  jwtAuth(),
  async (req, res) => {
    const { orderId } = req.params;
    const order = await orderService.getOrderById(orderId, req.user);
    res.json({ order });
  }
);

// Update order status - admin or order management role required
router.patch('/orders/:orderId/status', 
  jwtAuth(),
  requireRole('admin', 'order_manager'),
  celebrate({
    body: Joi.object({
      status: Joi.string().valid('confirmed', 'processing', 'shipped', 'delivered', 'cancelled').required(),
      reason: Joi.string().when('status', { is: 'cancelled', then: Joi.required() })
    })
  }),
  async (req, res) => {
    const { orderId } = req.params;
    const { status, reason } = req.body;
    
    const updatedOrder = await orderService.updateOrderStatus(orderId, status, reason);
    res.json({ order: updatedOrder });
  }
);

// Admin-only route to get all orders with filters
router.get('/admin/orders', 
  jwtAuth(),
  requireRole('admin'),
  celebrate({
    query: Joi.object({
      status: Joi.string().valid('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'),
      userId: Joi.string(),
      startDate: Joi.date(),
      endDate: Joi.date(),
      limit: Joi.number().min(1).max(100).default(20),
      offset: Joi.number().min(0).default(0)
    })
  }),
  async (req, res) => {
    const filters = req.query;
    const { orders, total } = await orderService.getAllOrders(filters);
    res.json({ orders, total, limit: filters.limit, offset: filters.offset });
  }
);

// Super admin route for order analytics
router.get('/admin/orders/analytics', 
  jwtAuth(),
  requirePermission('view_analytics'),
  async (req, res) => {
    const analytics = await orderService.getOrderAnalytics();
    res.json({ analytics });
  }
);

// Cancel order - user can cancel their own orders within time limit
router.post('/orders/:orderId/cancel', 
  jwtAuth(),
  celebrate({
    body: Joi.object({
      reason: Joi.string().required(),
      refundRequested: Joi.boolean().default(true)
    })
  }),
  async (req, res) => {
    const { orderId } = req.params;
    const { reason, refundRequested } = req.body;
    
    const cancelledOrder = await orderService.cancelOrder(orderId, req.user.id, reason, refundRequested);
    res.json({ order: cancelledOrder });
  }
);

module.exports = router;
