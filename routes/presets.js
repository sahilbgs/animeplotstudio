const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all prompt presets
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM prompt_presets ORDER BY id ASC');
    res.json({ success: true, presets: result.rows });
  } catch (err) {
    console.error('Error fetching prompt presets:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// CREATE custom prompt preset
router.post('/', async (req, res) => {
  try {
    const { name, category, description, prompt_snippet, negative_snippet, preview_badge } = req.body;
    if (!name || !prompt_snippet) {
      return res.status(400).json({ success: false, error: 'Name and prompt snippet are required' });
    }

    const result = await db.query(`
      INSERT INTO prompt_presets (
        name, category, description, prompt_snippet, negative_snippet, preview_badge
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      name.trim(),
      category || 'Custom',
      description || '',
      prompt_snippet.trim(),
      negative_snippet || '',
      preview_badge || 'Custom'
    ]);

    res.json({ success: true, preset: result.rows[0] });
  } catch (err) {
    console.error('Error creating preset:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
