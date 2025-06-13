// Test route to demonstrate payload and auth policy extraction
const express = require('express');
const Joi = require('joi');
const { celebrate } = require('celebrate');
const { jwtAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Order creation with JWT auth and validation
router.post('/orders', 
  jwtAuth(), 
  celebrate({
    body: Joi.object({
      userId: Joi.string().required(),
      cartId: Joi.string().required(),
      amount: Joi.number().min(0).required(),
      items: Joi.array().items(
        Joi.object({
          productId: Joi.string().required(),
          quantity: Joi.number().min(1).required(),
          price: Joi.number().min(0).required()
        })
      ).required()
    })
  }),
  async (req, res) => {
    const { userId, cartId, amount, items } = req.body;
    
    // Create order logic here
    const order = await orderService.createOrder({ userId, cartId, amount, items });
    
    res.json({
      orderId: order.id,
      status: order.status,
      amount: order.amount,
      createdAt: order.createdAt
    });
  }
);

// Admin-only route to get all orders
router.get('/admin/orders', 
  jwtAuth(),
  requireRole('admin'),
  async (req, res) => {
    const orders = await orderService.getAllOrders();
    res.json({ orders });
  }
);

module.exports = router;
