const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

module.exports = function(pool) {
    // GET user's cart
    router.get('/', authenticateToken, async (req, res) => {
        try {
            const [items] = await pool.query(
                `SELECT ci.id, ci.quantity, p.id as product_id, p.name, p.price, p.image_url, p.stock
                 FROM cart_items ci
                 JOIN products p ON ci.product_id = p.id
                 WHERE ci.user_id = ?`,
                [req.user.id]
            );
            res.json(items);
        } catch (err) {
            console.error('Get Cart Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // POST add item to cart
    router.post('/', authenticateToken, async (req, res) => {
        const { product_id, quantity } = req.body;
        if (!product_id) return res.status(400).json({ error: 'Product ID is required' });

        try {
            // Check if item already in cart
            const [existing] = await pool.query(
                'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?',
                [req.user.id, product_id]
            );

            if (existing.length > 0) {
                await pool.query(
                    'UPDATE cart_items SET quantity = quantity + ? WHERE user_id = ? AND product_id = ?',
                    [quantity || 1, req.user.id, product_id]
                );
            } else {
                await pool.query(
                    'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
                    [req.user.id, product_id, quantity || 1]
                );
            }
            res.status(201).json({ message: 'Item added to cart' });
        } catch (err) {
            console.error('Add to Cart Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // PUT update cart item quantity
    router.put('/:id', authenticateToken, async (req, res) => {
        const { quantity } = req.body;
        if (!quantity || quantity < 1) return res.status(400).json({ error: 'Valid quantity required' });

        try {
            await pool.query(
                'UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
                [quantity, req.params.id, req.user.id]
            );
            res.json({ message: 'Cart updated' });
        } catch (err) {
            console.error('Update Cart Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // DELETE remove item from cart
    router.delete('/:id', authenticateToken, async (req, res) => {
        try {
            await pool.query('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
            res.json({ message: 'Item removed from cart' });
        } catch (err) {
            console.error('Remove from Cart Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
};
