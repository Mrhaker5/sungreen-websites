const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

module.exports = function(pool) {
    // GET dashboard stats
    router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) as totalUsers FROM users');
            const [[{ totalOrders }]] = await pool.query('SELECT COUNT(*) as totalOrders FROM orders');
            const [[{ totalRevenue }]] = await pool.query('SELECT COALESCE(SUM(total), 0) as totalRevenue FROM orders WHERE status != "cancelled"');
            const [[{ totalProducts }]] = await pool.query('SELECT COUNT(*) as totalProducts FROM products');
            const [recentOrders] = await pool.query(
                `SELECT o.id, o.total, o.status, o.created_at, u.username
                 FROM orders o JOIN users u ON o.user_id = u.id
                 ORDER BY o.created_at DESC LIMIT 5`
            );

            res.json({ totalUsers, totalOrders, totalRevenue, totalProducts, recentOrders });
        } catch (err) {
            console.error('Dashboard Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // GET all users
    router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
        try {
            const [users] = await pool.query('SELECT id, username, email, role, is_blocked, created_at FROM users ORDER BY created_at DESC');
            res.json(users);
        } catch (err) {
            console.error('Get Users Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // PUT block/unblock user
    router.put('/users/:id/block', authenticateToken, requireAdmin, async (req, res) => {
        const { is_blocked } = req.body;
        try {
            await pool.query('UPDATE users SET is_blocked = ? WHERE id = ?', [is_blocked ? 1 : 0, req.params.id]);
            res.json({ message: is_blocked ? 'User blocked' : 'User unblocked' });
        } catch (err) {
            console.error('Block User Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // POST send notification
    router.post('/notifications', authenticateToken, requireAdmin, async (req, res) => {
        const { user_id, title, message, send_to_all } = req.body;
        if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });

        try {
            if (send_to_all) {
                const [users] = await pool.query('SELECT id FROM users WHERE role != "admin"');
                for (const user of users) {
                    await pool.query(
                        'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
                        [user.id, title, message]
                    );
                }
                res.json({ message: `Notification sent to ${users.length} users` });
            } else {
                if (!user_id) return res.status(400).json({ error: 'User ID is required' });
                await pool.query(
                    'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
                    [user_id, title, message]
                );
                res.json({ message: 'Notification sent' });
            }
        } catch (err) {
            console.error('Send Notification Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
};
