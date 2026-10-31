const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    let { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    username = username.trim().toLowerCase();
    password = password.trim();

    // Normalize usernames (support mewo/jiya for Director, bunny/sahil for Manager)
    if (username === 'jiya') username = 'mewo';
    if (username === 'sahil') username = 'bunny';

    // Query user from PostgreSQL
    let userResult = await pool.query(
      'SELECT id, username, display_name, role, avatar_color, avatar_emoji, password FROM users WHERE LOWER(username) = $1',
      [username]
    );

    // If not found with normalized, try fallback
    if (userResult.rows.length === 0) {
      userResult = await pool.query(
        'SELECT id, username, display_name, role, avatar_color, avatar_emoji, password FROM users WHERE LOWER(username) IN ($1, $2)',
        [username === 'mewo' ? 'jiya' : 'mewo', username === 'bunny' ? 'sahil' : 'bunny']
      );
    }

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Creator account not found. Valid creators are "mewo" (Founder & Main Director) and "bunny" (Studio Manager).'
      });
    }

    const user = userResult.rows[0];

    // Verify password (password for both creators is 44113290)
    const expectedPass = user.password || '44113290';
    if (password !== expectedPass && password !== '44113290') {
      return res.status(401).json({
        success: false,
        error: 'Incorrect password. Please enter the correct password.'
      });
    }

    // Success response with session token
    const token = `tok_${user.username}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    res.json({
      success: true,
      message: `Welcome back, ${user.display_name}!`,
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        avatar_color: user.avatar_color,
        avatar_emoji: user.avatar_emoji || (user.username === 'mewo' || user.username === 'jiya' ? '👑' : '🎬')
      }
    });
  } catch (err) {
    console.error('[Auth Error]', err);
    res.status(500).json({ success: false, error: 'Server authentication error: ' + err.message });
  }
});

// GET /api/auth/creators
router.get('/creators', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, display_name, role, avatar_color, avatar_emoji FROM users WHERE username IN ('mewo', 'bunny') ORDER BY CASE WHEN username='mewo' THEN 1 ELSE 2 END"
    );
    res.json({ success: true, creators: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
