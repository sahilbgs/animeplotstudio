const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all team collaborators
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM users ORDER BY id ASC');
    res.json({ success: true, team: result.rows });
  } catch (err) {
    console.error('Error fetching team:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ADD team member
router.post('/', async (req, res) => {
  try {
    const { username, display_name, role, avatar_color, avatar_emoji } = req.body;
    if (!display_name || !display_name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const cleanUsername = (username || display_name.toLowerCase().replace(/[^a-z0-9]/g, '_')) + '_' + Date.now().toString().slice(-4);
    const result = await db.query(`
      INSERT INTO users (username, display_name, role, avatar_color, avatar_emoji)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      cleanUsername,
      display_name.trim(),
      role || 'Anime Creator',
      avatar_color || '#3b82f6',
      avatar_emoji || '🎭'
    ]);

    res.json({ success: true, member: result.rows[0] });
  } catch (err) {
    console.error('Error adding team member:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
