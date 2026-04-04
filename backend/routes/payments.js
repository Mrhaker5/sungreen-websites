const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
});

module.exports = function(pool) {
    // POST create Razorpay order
    router.post('/create-order', authenticateToken, async (req, res) => {
        const { amount, orderId } = req.body;

        if (!amount) return res.status(400).json({ error: 'Amount is required' });

        try {
            const options = {
                amount: Math.round(amount * 100), // Razorpay expects amount in paise
                currency: 'INR',
                receipt: `order_${orderId || Date.now()}`,
                notes: {
                    userId: req.user.id,
                    orderId: orderId || ''
                }
            };

            const razorpayOrder = await razorpay.orders.create(options);
            res.json({
                id: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                key: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder'
            });
        } catch (err) {
            console.error('Razorpay Create Order Error:', err);
            res.status(500).json({ error: 'Failed to create payment order' });
        }
    });

    // POST verify payment
    router.post('/verify', authenticateToken, async (req, res) => {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: 'Payment verification data missing' });
        }

        try {
            // Verify signature
            const body = razorpay_order_id + '|' + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret')
                .update(body)
                .digest('hex');

            if (expectedSignature !== razorpay_signature) {
                return res.status(400).json({ error: 'Payment verification failed' });
            }

            // Update order with payment info
            if (orderId) {
                await pool.query(
                    'UPDATE orders SET payment_id = ?, status = ? WHERE id = ? AND user_id = ?',
                    [razorpay_payment_id, 'confirmed', orderId, req.user.id]
                );

                // Send notification
                await pool.query(
                    'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
                    [req.user.id, 'Payment Successful', `Payment for order #${orderId} confirmed. Your order is being processed.`]
                );
            }

            res.json({ message: 'Payment verified successfully', paymentId: razorpay_payment_id });
        } catch (err) {
            console.error('Payment Verify Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
};
