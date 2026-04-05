const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const { authenticateToken } = require('./middleware/auth');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const app = express();
app.use(express.json());
app.use(cors({
    origin: [
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://localhost:3000',
        'https://www.sungreenenergies.com',
        'https://sungreenenergies.com',
        'https://sungreen-websites.vercel.app',
        process.env.FRONTEND_URL || ''
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Database config
const dbConfig = {
    host: process.env.TIDB_HOST || 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: process.env.TIDB_PORT || 4000,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE || 'test',
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    }
};

let pool;

async function initDB() {
    try {
        pool = mysql.createPool(dbConfig);
        console.log('Connected to TiDB Cloud');

        // Users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'user',
                is_blocked TINYINT DEFAULT 0,
                reset_token VARCHAR(255),
                reset_token_expiry BIGINT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Products table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                description TEXT,
                image_url VARCHAR(500),
                category VARCHAR(100),
                stock INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Cart items table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cart_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                product_id INT NOT NULL,
                quantity INT DEFAULT 1,
                UNIQUE KEY unique_cart_item (user_id, product_id)
            )
        `);

        // Orders table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                total DECIMAL(10,2) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                shipping_address TEXT,
                shipping_city VARCHAR(100),
                shipping_pincode VARCHAR(10),
                shipping_phone VARCHAR(15),
                payment_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Order items table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                product_id INT NOT NULL,
                quantity INT NOT NULL,
                price_at_purchase DECIMAL(10,2) NOT NULL
            )
        `);

        // Notifications table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT,
                is_read TINYINT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add role and is_blocked columns to existing users table if they don't exist
        try { await pool.query('ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT "user"'); } catch(e) {}
        try { await pool.query('ALTER TABLE users ADD COLUMN is_blocked TINYINT DEFAULT 0'); } catch(e) {}
        try { await pool.query('ALTER TABLE users ADD COLUMN reset_token VARCHAR(255)'); } catch(e) {}
        try { await pool.query('ALTER TABLE users ADD COLUMN reset_token_expiry BIGINT'); } catch(e) {}

        console.log('All tables ready');

        // Register routes after pool is ready
        app.use('/api/products', require('./routes/products')(pool));
        app.use('/api/cart', require('./routes/cart')(pool));
        app.use('/api/orders', require('./routes/orders')(pool));
        app.use('/api/payments', require('./routes/payments')(pool));
        app.use('/api/admin', require('./routes/admin')(pool));
        app.use('/api/notifications', require('./routes/notifications')(pool));

    } catch (err) {
        console.error('CRITICAL: Database Initialization Failed!');
        console.error('Error details:', err.message);
        console.error('Check your TiDB credentials in .env');
    }
}

initDB();

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';

// Register Endpoint
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const [existingUsers] = await pool.query('SELECT * FROM users WHERE email = ? OR username = ?', [email, username]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ error: 'Username or Email already exists' });
        }

        const saltPattern = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, saltPattern);

        await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, passwordHash]
        );

        res.status(201).json({ message: 'User registered successfully!' });
    } catch (err) {
        console.error('Registration Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login Endpoint
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        const user = users[0];

        if (!user) return res.status(401).json({ error: 'Invalid email or password' });
        if (user.is_blocked) return res.status(403).json({ error: 'Your account has been blocked. Contact support.' });

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) return res.status(401).json({ error: 'Invalid email or password' });

        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email, role: user.role || 'user' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            user: { id: user.id, username: user.username, email: user.email, role: user.role || 'user' }
        });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Forgot Password Endpoint
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(404).json({ error: 'No account with that email found' });

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000;

        await pool.query('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?', [resetToken, resetTokenExpiry, email]);

        const host = req.headers.origin || `http://${req.headers.host}`;
        const resetUrl = `${host}/reset-password.html?token=${resetToken}&email=${email}`;

        await transporter.sendMail({
            to: email,
            from: process.env.EMAIL_USER || 'noreply@sungreenenergies.com',
            subject: 'Password Reset Request',
            html: `
                <h3>Password Reset</h3>
                <p>You requested a password reset. Click the link below to set a new password:</p>
                <a href="${resetUrl}">Reset Password</a>
                <p>If you did not request this, please ignore this email.</p>
                <p>This link expires in 1 hour.</p>
            `
        });

        res.status(200).json({ message: 'Password reset link sent to your email' });
    } catch (err) {
        console.error('Forgot Password Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset Password Endpoint
app.post('/api/reset-password', async (req, res) => {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND reset_token = ? AND reset_token_expiry > ?', [email, token, Date.now()]);
        if (users.length === 0) return res.status(400).json({ error: 'Invalid or expired password reset token' });

        const saltPattern = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, saltPattern);

        await pool.query('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE email = ?', [passwordHash, email]);
        res.status(200).json({ message: 'Password has been reset successfully' });
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
module.exports = app;
