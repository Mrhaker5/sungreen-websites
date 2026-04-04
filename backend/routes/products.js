const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

module.exports = function(pool) {
    // GET all products (public)
    router.get('/', async (req, res) => {
        try {
            const [products] = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
            res.json(products);
        } catch (err) {
            console.error('Get Products Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // GET single product (public)
    router.get('/:id', async (req, res) => {
        try {
            const [products] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
            if (products.length === 0) return res.status(404).json({ error: 'Product not found' });
            res.json(products[0]);
        } catch (err) {
            console.error('Get Product Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // POST add product (admin only)
    router.post('/', authenticateToken, requireAdmin, async (req, res) => {
        const { name, price, description, image_url, category, stock } = req.body;
        if (!name || !price) return res.status(400).json({ error: 'Name and price are required' });

        try {
            const [result] = await pool.query(
                'INSERT INTO products (name, price, description, image_url, category, stock) VALUES (?, ?, ?, ?, ?, ?)',
                [name, price, description || '', image_url || '', category || '', stock || 0]
            );
            res.status(201).json({ message: 'Product added', id: result.insertId });
        } catch (err) {
            console.error('Add Product Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // PUT edit product (admin only)
    router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
        const { name, price, description, image_url, category, stock } = req.body;
        try {
            await pool.query(
                'UPDATE products SET name = ?, price = ?, description = ?, image_url = ?, category = ?, stock = ? WHERE id = ?',
                [name, price, description, image_url, category, stock, req.params.id]
            );
            res.json({ message: 'Product updated' });
        } catch (err) {
            console.error('Edit Product Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // DELETE product (admin only)
    router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
        try {
            await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
            res.json({ message: 'Product deleted' });
        } catch (err) {
            console.error('Delete Product Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
};
