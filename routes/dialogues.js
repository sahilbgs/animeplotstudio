const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all dialogues for a scene
router.get('/scene/:sceneId', async (req, res) => {
  try {
    const sceneId = req.params.sceneId;
    const result = await db.query(`
      SELECT 
        d.id,
        d.scene_id,
        d.media_id,
        d.character_id,
        d.character_name,
        d.dialogue_text,
        d.order_index,
        d.created_at,
        c.avatar_url,
        c.personality AS character_behaviour,
        c.role AS character_role
      FROM scene_dialogues d
      LEFT JOIN characters c ON c.id = d.character_id
      WHERE d.scene_id = $1
      ORDER BY d.order_index ASC, d.id ASC
    `, [sceneId]);

    res.json({ success: true, dialogues: result.rows });
  } catch (err) {
    console.error('Error fetching scene dialogues:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ADD dialogue to scene
router.post('/scene/:sceneId', async (req, res) => {
  try {
    const sceneId = req.params.sceneId;
    const { character_id, character_name, dialogue_text, media_id, order_index } = req.body;

    if (!dialogue_text || !dialogue_text.trim()) {
      return res.status(400).json({ success: false, error: 'Dialogue text is required' });
    }

    // Lookup character name if not provided
    let finalCharName = character_name;
    if (!finalCharName && character_id) {
      const charRes = await db.query('SELECT name FROM characters WHERE id = $1', [character_id]);
      if (charRes.rows.length > 0) {
        finalCharName = charRes.rows[0].name;
      }
    }
    if (!finalCharName) finalCharName = 'Narrator';

    // Get next order index if not provided
    let finalOrder = order_index;
    if (!finalOrder) {
      const maxRes = await db.query('SELECT COALESCE(MAX(order_index), 0) as max_ord FROM scene_dialogues WHERE scene_id = $1', [sceneId]);
      finalOrder = parseInt(maxRes.rows[0].max_ord, 10) + 1;
    }

    const insertRes = await db.query(`
      INSERT INTO scene_dialogues (scene_id, media_id, character_id, character_name, dialogue_text, order_index)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [sceneId, media_id || null, character_id || null, finalCharName.trim(), dialogue_text.trim(), finalOrder]);

    res.json({ success: true, dialogue: insertRes.rows[0], message: 'Dialogue added successfully' });
  } catch (err) {
    console.error('Error adding dialogue:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// UPDATE dialogue
router.put('/:id', async (req, res) => {
  try {
    const dialId = req.params.id;
    const { character_id, character_name, dialogue_text, order_index } = req.body;

    const result = await db.query(`
      UPDATE scene_dialogues SET
        character_id = COALESCE($1, character_id),
        character_name = COALESCE($2, character_name),
        dialogue_text = COALESCE($3, dialogue_text),
        order_index = COALESCE($4, order_index)
      WHERE id = $5
      RETURNING *
    `, [character_id, character_name, dialogue_text, order_index, dialId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Dialogue not found' });
    }

    res.json({ success: true, dialogue: result.rows[0], message: 'Dialogue updated' });
  } catch (err) {
    console.error('Error updating dialogue:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE dialogue
router.delete('/:id', async (req, res) => {
  try {
    const dialId = req.params.id;
    await db.query('DELETE FROM scene_dialogues WHERE id = $1', [dialId]);
    res.json({ success: true, message: 'Dialogue deleted' });
  } catch (err) {
    console.error('Error deleting dialogue:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
