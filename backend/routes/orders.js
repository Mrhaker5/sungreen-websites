const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

module.exports = function(pool) {
    // POST create order from cart
    router.post('/', authenticateToken, async (req, res) => {
        const { shipping_address, shipping_city, shipping_pincode, shipping_phone } = req.body;

        if (!shipping_address || !shipping_city || !shipping_pincode || !shipping_phone) {
            return res.status(400).json({ error: 'All shipping fields are required' });
        }

        try {
            // Get cart items
            const [cartItems] = await pool.query(
                `SELECT ci.quantity, p.id as product_id, p.price, p.stock
                 FROM cart_items ci JOIN products p ON ci.product_id = p.id
                 WHERE ci.user_id = ?`,
                [req.user.id]
            );

            if (cartItems.length === 0) {
                return res.status(400).json({ error: 'Your cart is empty' });
            }

            // Check stock
            for (const item of cartItems) {
                if (item.quantity > item.stock) {
                    return res.status(400).json({ error: `Insufficient stock for product ID ${item.product_id}` });
                }
            }

            // Calculate total
            const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            // Create order
            const [orderResult] = await pool.query(
                'INSERT INTO orders (user_id, total, status, shipping_address, shipping_city, shipping_pincode, shipping_phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [req.user.id, total, 'pending', shipping_address, shipping_city, shipping_pincode, shipping_phone]
            );

            const orderId = orderResult.insertId;

            // Insert order items and update stock
            for (const item of cartItems) {
                await pool.query(
                    'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)',
                    [orderId, item.product_id, item.quantity, item.price]
                );
                await pool.query(
                    'UPDATE products SET stock = stock - ? WHERE id = ?',
                    [item.quantity, item.product_id]
                );
            }

            // Clear cart
            await pool.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);

            res.status(201).json({ message: 'Order created', orderId, total });
        } catch (err) {
            console.error('Create Order Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // GET user's orders
    router.get('/', authenticateToken, async (req, res) => {
        try {
            const [orders] = await pool.query(
                'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
                [req.user.id]
            );

            for (let order of orders) {
                const [items] = await pool.query(
                    `SELECT oi.*, p.name, p.image_url FROM order_items oi
                     JOIN products p ON oi.product_id = p.id
                     WHERE oi.order_id = ?`,
                    [order.id]
                );
                order.items = items;
            }

            res.json(orders);
        } catch (err) {
            console.error('Get Orders Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // GET all orders (admin)
    router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [orders] = await pool.query(
                `SELECT o.*, u.username, u.email FROM orders o
                 JOIN users u ON o.user_id = u.id
                 ORDER BY o.created_at DESC`
            );

            for (let order of orders) {
                const [items] = await pool.query(
                    `SELECT oi.*, p.name, p.image_url FROM order_items oi
                     JOIN products p ON oi.product_id = p.id
                     WHERE oi.order_id = ?`,
                    [order.id]
                );
                order.items = items;
            }

            res.json(orders);
        } catch (err) {
            console.error('Get All Orders Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // PUT update order status (admin)
    router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
        const { status } = req.body;
        const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Use: ' + validStatuses.join(', ') });
        }

        try {
            await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);

            // Get user_id for notification
            const [orders] = await pool.query('SELECT user_id FROM orders WHERE id = ?', [req.params.id]);
            if (orders.length > 0) {
                await pool.query(
                    'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
                    [orders[0].user_id, 'Order Update', `Your order #${req.params.id} status has been updated to: ${status}`]
                );
            }

            res.json({ message: 'Order status updated' });
        } catch (err) {
            console.error('Update Status Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
};
