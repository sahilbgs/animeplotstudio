const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all parts for a project
router.get('/project/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const result = await db.query(`
      SELECT 
        pt.*,
        COUNT(DISTINCT s.id)::int AS scene_count,
        COUNT(DISTINCT m.id)::int AS media_count
      FROM parts pt
      LEFT JOIN scenes s ON s.part_id = pt.id
      LEFT JOIN media_uploads m ON m.part_id = pt.id
      WHERE pt.project_id = $1
      GROUP BY pt.id
      ORDER BY pt.part_number ASC, pt.order_index ASC
    `, [projectId]);
    res.json({ success: true, parts: result.rows });
  } catch (err) {
    console.error('Error fetching parts:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single part with scenes and uploaded media
router.get('/:id', async (req, res) => {
  try {
    const partId = req.params.id;
    const partRes = await db.query('SELECT * FROM parts WHERE id = $1', [partId]);
    if (partRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Part not found' });
    }

    const scenesRes = await db.query(`
      SELECT 
        s.*,
        COUNT(DISTINCT m.id)::int AS media_count,
        COUNT(DISTINCT c.id)::int AS comment_count
      FROM scenes s
      LEFT JOIN media_uploads m ON m.scene_id = s.id
      LEFT JOIN scene_comments c ON c.scene_id = s.id
      WHERE s.part_id = $1
      GROUP BY s.id
      ORDER BY s.scene_number ASC, s.order_index ASC
    `, [partId]);

    const mediaRes = await db.query(`
      SELECT * FROM media_uploads 
      WHERE part_id = $1 
      ORDER BY created_at DESC
    `, [partId]);

    res.json({
      success: true,
      part: partRes.rows[0],
      scenes: scenesRes.rows,
      media: mediaRes.rows
    });
  } catch (err) {
    console.error('Error fetching part details:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// CREATE new part in project
router.post('/project/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const { title, summary, status, cover_image, created_by } = req.body;

    // Determine next part number
    const maxPartRes = await db.query(
      'SELECT COALESCE(MAX(part_number), 0) AS max_num FROM parts WHERE project_id = $1',
      [projectId]
    );
    const nextPartNumber = (parseInt(maxPartRes.rows[0].max_num, 10) || 0) + 1;

    const result = await db.query(`
      INSERT INTO parts (
        project_id, part_number, title, summary, status, cover_image, created_by, order_index
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      projectId,
      nextPartNumber,
      title || `Part ${nextPartNumber}: Untitled Episode`,
      summary || '',
      status || 'Drafting',
      cover_image || null,
      created_by || 'Team',
      nextPartNumber
    ]);

    // Create an initial scene 1 automatically for the new part
    const newPart = result.rows[0];
    await db.query(`
      INSERT INTO scenes (
        part_id, scene_number, title, location, visual_prompt, status, created_by
      ) VALUES ($1, 1, 'Scene 1: Opening Shot', 'Establishing Location', 
        'masterpiece, anime aesthetic, wide cinematic shot, beautiful lighting, 8k resolution', 
        'In Progress', $2)
    `, [newPart.id, created_by || 'Team']);

    res.json({ success: true, part: newPart });
  } catch (err) {
    console.error('Error creating part:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// UPDATE part
router.put('/:id', async (req, res) => {
  try {
    const partId = req.params.id;
    const { title, summary, status, cover_image, part_number } = req.body;

    const result = await db.query(`
      UPDATE parts SET
        title = COALESCE($1, title),
        summary = COALESCE($2, summary),
        status = COALESCE($3, status),
        cover_image = COALESCE($4, cover_image),
        part_number = COALESCE($5, part_number),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [title, summary, status, cover_image, part_number, partId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Part not found' });
    }

    res.json({ success: true, part: result.rows[0] });
  } catch (err) {
    console.error('Error updating part:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE part
router.delete('/:id', async (req, res) => {
  try {
    const partId = req.params.id;
    await db.query('DELETE FROM parts WHERE id = $1', [partId]);
    res.json({ success: true, message: 'Part deleted successfully' });
  } catch (err) {
    console.error('Error deleting part:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
