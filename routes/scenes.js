const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all scenes for a specific part
router.get('/part/:partId', async (req, res) => {
  try {
    const partId = req.params.partId;
    const result = await db.query(`
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
    res.json({ success: true, scenes: result.rows });
  } catch (err) {
    console.error('Error fetching scenes:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single scene with its uploaded media and collaboration comments
router.get('/:id', async (req, res) => {
  try {
    const sceneId = req.params.id;
    const sceneRes = await db.query(`
      SELECT s.*, pt.title as part_title, pt.part_number, pt.project_id
      FROM scenes s
      JOIN parts pt ON pt.id = s.part_id
      WHERE s.id = $1
    `, [sceneId]);

    if (sceneRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    const mediaRes = await db.query(
      'SELECT * FROM media_uploads WHERE scene_id = $1 ORDER BY created_at DESC',
      [sceneId]
    );

    const commentsRes = await db.query(
      'SELECT * FROM scene_comments WHERE scene_id = $1 ORDER BY created_at ASC',
      [sceneId]
    );

    res.json({
      success: true,
      scene: sceneRes.rows[0],
      media: mediaRes.rows,
      comments: commentsRes.rows
    });
  } catch (err) {
    console.error('Error fetching scene details:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// CREATE new scene
router.post('/part/:partId', async (req, res) => {
  try {
    const partId = req.params.partId;
    const {
      title,
      location,
      time_of_day,
      mood,
      camera_angle,
      lighting_style,
      visual_prompt,
      negative_prompt,
      aspect_ratio,
      ai_model_preset,
      narrative_script,
      dialogue,
      characters_involved,
      status,
      created_by
    } = req.body;

    // Auto-calculate next scene number
    const maxRes = await db.query(
      'SELECT COALESCE(MAX(scene_number), 0) AS max_num FROM scenes WHERE part_id = $1',
      [partId]
    );
    const nextSceneNumber = (parseInt(maxRes.rows[0].max_num, 10) || 0) + 1;

    const defaultPrompt = visual_prompt || 
      `masterpiece, anime visual, ${location || 'Tokyo streets'}, cinematic composition, vibrant anime colors, 8k wallpaper`;

    const result = await db.query(`
      INSERT INTO scenes (
        part_id, scene_number, title, location, time_of_day, mood,
        camera_angle, lighting_style, visual_prompt, negative_prompt,
        aspect_ratio, ai_model_preset, narrative_script, dialogue,
        characters_involved, status, created_by, order_index
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) RETURNING *
    `, [
      partId,
      nextSceneNumber,
      title || `Scene ${nextSceneNumber}: New Action Beat`,
      location || 'Neo-Tokyo District',
      time_of_day || 'Night',
      mood || 'Dramatic',
      camera_angle || 'Medium Cinematic Shot',
      lighting_style || 'Vibrant Anime Lighting',
      defaultPrompt,
      negative_prompt || 'low quality, blurry, deformed hands, bad anatomy',
      aspect_ratio || '16:9',
      ai_model_preset || 'Midjourney v6 / Niji',
      narrative_script || '',
      dialogue || '',
      Array.isArray(characters_involved) ? characters_involved : [],
      status || 'In Progress',
      created_by || 'Team',
      nextSceneNumber
    ]);

    res.json({ success: true, scene: result.rows[0] });
  } catch (err) {
    console.error('Error creating scene:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// UPDATE scene
router.put('/:id', async (req, res) => {
  try {
    const sceneId = req.params.id;
    const {
      title,
      scene_number,
      location,
      time_of_day,
      mood,
      camera_angle,
      lighting_style,
      visual_prompt,
      negative_prompt,
      aspect_ratio,
      ai_model_preset,
      narrative_script,
      dialogue,
      characters_involved,
      primary_image,
      status
    } = req.body;

    const result = await db.query(`
      UPDATE scenes SET
        title = COALESCE($1, title),
        scene_number = COALESCE($2, scene_number),
        location = COALESCE($3, location),
        time_of_day = COALESCE($4, time_of_day),
        mood = COALESCE($5, mood),
        camera_angle = COALESCE($6, camera_angle),
        lighting_style = COALESCE($7, lighting_style),
        visual_prompt = COALESCE($8, visual_prompt),
        negative_prompt = COALESCE($9, negative_prompt),
        aspect_ratio = COALESCE($10, aspect_ratio),
        ai_model_preset = COALESCE($11, ai_model_preset),
        narrative_script = COALESCE($12, narrative_script),
        dialogue = COALESCE($13, dialogue),
        characters_involved = COALESCE($14, characters_involved),
        primary_image = COALESCE($15, primary_image),
        status = COALESCE($16, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $17
      RETURNING *
    `, [
      title,
      scene_number,
      location,
      time_of_day,
      mood,
      camera_angle,
      lighting_style,
      visual_prompt,
      negative_prompt,
      aspect_ratio,
      ai_model_preset,
      narrative_script,
      dialogue,
      characters_involved,
      primary_image,
      status,
      sceneId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    res.json({ success: true, scene: result.rows[0] });
  } catch (err) {
    console.error('Error updating scene:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE scene
router.delete('/:id', async (req, res) => {
  try {
    const sceneId = req.params.id;
    await db.query('DELETE FROM scenes WHERE id = $1', [sceneId]);
    res.json({ success: true, message: 'Scene deleted successfully' });
  } catch (err) {
    console.error('Error deleting scene:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
