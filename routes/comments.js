const express = require('express');
const router = express.Router();
const db = require('../db');

// GET comments for a scene
router.get('/scene/:sceneId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM scene_comments WHERE scene_id = $1 ORDER BY created_at ASC',
      [req.params.sceneId]
    );
    res.json({ success: true, comments: result.rows });
  } catch (err) {
    console.error('Error fetching scene comments:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST comment on a scene
router.post('/scene/:sceneId', async (req, res) => {
  try {
    const sceneId = req.params.sceneId;
    const { author_name, comment_text, comment_type } = req.body;

    if (!comment_text || !comment_text.trim()) {
      return res.status(400).json({ success: false, error: 'Comment text cannot be empty' });
    }

    const result = await db.query(`
      INSERT INTO scene_comments (scene_id, author_name, comment_text, comment_type)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      sceneId,
      author_name || 'Sahil',
      comment_text.trim(),
      comment_type || 'feedback'
    ]);

    res.json({ success: true, comment: result.rows[0] });
  } catch (err) {
    console.error('Error adding scene comment:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE comment
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM scene_comments WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    console.error('Error deleting comment:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
