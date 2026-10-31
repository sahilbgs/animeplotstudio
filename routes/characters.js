const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all characters for project
router.get('/project/:projectId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM characters WHERE project_id = $1 ORDER BY id ASC',
      [req.params.projectId]
    );
    res.json({ success: true, characters: result.rows });
  } catch (err) {
    console.error('Error fetching characters:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// CREATE character
router.post('/project/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const { name, japanese_name, role, personality, appearance, visual_prompt_tags, avatar_url } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Character name is required' });
    }

    const result = await db.query(`
      INSERT INTO characters (
        project_id, name, japanese_name, role, personality, appearance, visual_prompt_tags, avatar_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      projectId,
      name.trim(),
      japanese_name || '',
      role || 'Protagonist',
      personality || '',
      appearance || '',
      visual_prompt_tags || '',
      avatar_url || null
    ]);

    res.json({ success: true, character: result.rows[0] });
  } catch (err) {
    console.error('Error creating character:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE character
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM characters WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Character deleted' });
  } catch (err) {
    console.error('Error deleting character:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
