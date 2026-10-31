const express = require('express');
const router = express.Router();
const db = require('../db');

// GET full illustrated storybook data for a project
router.get('/project/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // 1. Project details
    const projRes = await db.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (projRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    const project = projRes.rows[0];

    // 2. Characters
    const charRes = await db.query(
      'SELECT id, name, japanese_name, role, personality, appearance, avatar_url FROM characters WHERE project_id = $1 ORDER BY id ASC',
      [projectId]
    );

    // 3. Parts
    const partsRes = await db.query(
      'SELECT id, project_id, part_number, title, summary, cover_image, status FROM parts WHERE project_id = $1 ORDER BY part_number ASC, id ASC',
      [projectId]
    );

    // 4. Scenes for all parts
    const scenesRes = await db.query(`
      SELECT 
        s.id, s.part_id, s.scene_number, s.title, s.location, s.time_of_day,
        s.mood, s.camera_angle, s.lighting_style, s.visual_prompt, s.negative_prompt,
        s.narrative_script, s.dialogue, s.characters_involved, s.primary_image,
        s.status, s.created_by, s.created_at, s.updated_at
      FROM scenes s
      JOIN parts pt ON pt.id = s.part_id
      WHERE pt.project_id = $1
      ORDER BY pt.part_number ASC, s.scene_number ASC, s.order_index ASC
    `, [projectId]);

    // 5. Dialogues for all scenes
    const sceneIds = scenesRes.rows.map(s => s.id);
    let dialoguesMap = {};
    if (sceneIds.length > 0) {
      const dialRes = await db.query(`
        SELECT 
          d.id, d.scene_id, d.media_id, d.character_id, d.character_name,
          d.dialogue_text, d.order_index, c.avatar_url, c.personality as character_behaviour, c.role as character_role
        FROM scene_dialogues d
        LEFT JOIN characters c ON c.id = d.character_id
        WHERE d.scene_id = ANY($1::int[])
        ORDER BY d.order_index ASC, d.id ASC
      `, [sceneIds]);

      dialRes.rows.forEach(d => {
        if (!dialoguesMap[d.scene_id]) dialoguesMap[d.scene_id] = [];
        dialoguesMap[d.scene_id].push(d);
      });
    }

    // Attach dialogues to scenes
    const scenesWithDialogues = scenesRes.rows.map(s => ({
      ...s,
      dialogues: dialoguesMap[s.id] || []
    }));

    // Group scenes by part_id
    const scenesByPart = {};
    scenesWithDialogues.forEach(s => {
      if (!scenesByPart[s.part_id]) scenesByPart[s.part_id] = [];
      scenesByPart[s.part_id].push(s);
    });

    const partsWithScenes = partsRes.rows.map(p => ({
      ...p,
      scenes: scenesByPart[p.id] || []
    }));

    // Total book stats
    const totalScenes = scenesWithDialogues.length;
    const submittedScenes = scenesWithDialogues.filter(s => s.status === 'Submitted').length;
    const pendingScenes = totalScenes - submittedScenes;

    res.json({
      success: true,
      book: {
        project,
        characters: charRes.rows,
        parts: partsWithScenes,
        stats: {
          total_parts: partsRes.rows.length,
          total_scenes: totalScenes,
          submitted_scenes: submittedScenes,
          pending_scenes: pendingScenes
        }
      }
    });
  } catch (err) {
    console.error('Error fetching storybook preview:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
