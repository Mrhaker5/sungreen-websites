const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

module.exports = function(pool) {
    // GET user's notifications
    router.get('/', authenticateToken, async (req, res) => {
        try {
            const [notifications] = await pool.query(
                'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
                [req.user.id]
            );
            res.json(notifications);
        } catch (err) {
            console.error('Get Notifications Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // PUT mark notification as read
    router.put('/:id/read', authenticateToken, async (req, res) => {
        try {
            await pool.query(
                'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
                [req.params.id, req.user.id]
            );
            res.json({ message: 'Notification marked as read' });
        } catch (err) {
            console.error('Mark Read Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
};
