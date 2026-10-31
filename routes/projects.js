const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all projects with summary stats
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        p.*,
        COUNT(DISTINCT pt.id)::int AS total_parts,
        COUNT(DISTINCT s.id)::int AS total_scenes,
        COUNT(DISTINCT m.id)::int AS total_images
      FROM projects p
      LEFT JOIN parts pt ON pt.project_id = p.id
      LEFT JOIN scenes s ON s.part_id = pt.id
      LEFT JOIN media_uploads m ON m.project_id = p.id
      GROUP BY p.id
      ORDER BY p.updated_at DESC
    `);
    res.json({ success: true, projects: result.rows });
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single project with characters and parts
router.get('/:id', async (req, res) => {
  try {
    const projId = req.params.id;
    const projRes = await db.query('SELECT * FROM projects WHERE id = $1', [projId]);
    if (projRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const charactersRes = await db.query(
      'SELECT * FROM characters WHERE project_id = $1 ORDER BY id ASC',
      [projId]
    );

    const partsRes = await db.query(`
      SELECT 
        pt.*,
        COUNT(s.id)::int AS scene_count
      FROM parts pt
      LEFT JOIN scenes s ON s.part_id = pt.id
      WHERE pt.project_id = $1
      GROUP BY pt.id
      ORDER BY pt.part_number ASC, pt.order_index ASC
    `, [projId]);

    res.json({
      success: true,
      project: projRes.rows[0],
      characters: charactersRes.rows,
      parts: partsRes.rows
    });
  } catch (err) {
    console.error('Error fetching project:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// CREATE new project
router.post('/', async (req, res) => {
  try {
    const {
      title,
      tagline,
      synopsis,
      genre,
      target_audience,
      art_style,
      cover_image,
      created_by
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const result = await db.query(`
      INSERT INTO projects (
        title, tagline, synopsis, genre, target_audience, art_style, cover_image, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      title.trim(),
      tagline || '',
      synopsis || '',
      genre || 'Action / Anime Fantasy',
      target_audience || 'Shonen / Seinen',
      art_style || 'Makoto Shinkai & Ufotable Hybrid',
      cover_image || null,
      created_by || 'Team'
    ]);

    // Create an initial Part 1 automatically for convenience
    const newProj = result.rows[0];
    await db.query(`
      INSERT INTO parts (project_id, part_number, title, summary, status, created_by)
      VALUES ($1, 1, 'Part 1: The Beginning', 'Initial story arc and character introduction.', 'Drafting', $2)
    `, [newProj.id, created_by || 'Team']);

    res.json({ success: true, project: newProj });
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// UPDATE project
router.put('/:id', async (req, res) => {
  try {
    const projId = req.params.id;
    const {
      title,
      tagline,
      synopsis,
      genre,
      target_audience,
      art_style,
      cover_image,
      status
    } = req.body;

    const result = await db.query(`
      UPDATE projects SET
        title = COALESCE($1, title),
        tagline = COALESCE($2, tagline),
        synopsis = COALESCE($3, synopsis),
        genre = COALESCE($4, genre),
        target_audience = COALESCE($5, target_audience),
        art_style = COALESCE($6, art_style),
        cover_image = COALESCE($7, cover_image),
        status = COALESCE($8, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [title, tagline, synopsis, genre, target_audience, art_style, cover_image, status, projId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    res.json({ success: true, project: result.rows[0] });
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE project
router.delete('/:id', async (req, res) => {
  try {
    const projId = req.params.id;
    await db.query('DELETE FROM projects WHERE id = $1', [projId]);
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// EXPORT full anime story (Screenplay format or Markdown)
router.get('/:id/export', async (req, res) => {
  try {
    const projId = req.params.id;
    const format = req.query.format || 'markdown'; // markdown, json

    const projRes = await db.query('SELECT * FROM projects WHERE id = $1', [projId]);
    if (projRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    const project = projRes.rows[0];

    const charactersRes = await db.query('SELECT * FROM characters WHERE project_id = $1 ORDER BY id ASC', [projId]);
    const partsRes = await db.query('SELECT * FROM parts WHERE project_id = $1 ORDER BY part_number ASC', [projId]);

    const partsWithScenes = [];
    for (const part of partsRes.rows) {
      const scenesRes = await db.query(
        'SELECT * FROM scenes WHERE part_id = $1 ORDER BY scene_number ASC',
        [part.id]
      );
      partsWithScenes.push({
        ...part,
        scenes: scenesRes.rows
      });
    }

    if (format === 'json') {
      return res.json({
        success: true,
        project,
        characters: charactersRes.rows,
        parts: partsWithScenes
      });
    }

    // Markdown Export
    let md = `# ${project.title}\n`;
    if (project.tagline) md += `*${project.tagline}*\n\n`;
    md += `**Genre:** ${project.genre} | **Art Style:** ${project.art_style} | **Target Audience:** ${project.target_audience}\n\n`;
    md += `## Synopsis\n${project.synopsis}\n\n`;

    if (charactersRes.rows.length > 0) {
      md += `## Character Roster\n`;
      for (const c of charactersRes.rows) {
        md += `### ${c.name} (${c.japanese_name || 'N/A'}) - *${c.role}*\n`;
        md += `- **Appearance:** ${c.appearance || 'N/A'}\n`;
        md += `- **Personality:** ${c.personality || 'N/A'}\n`;
        md += `- **Visual Prompt Tags:** \`${c.visual_prompt_tags || 'N/A'}\`\n\n`;
      }
    }

    for (const part of partsWithScenes) {
      md += `---\n\n# ${part.title} (Part ${part.part_number})\n`;
      md += `**Status:** ${part.status}\n\n`;
      if (part.summary) md += `> ${part.summary}\n\n`;

      for (const scene of part.scenes) {
        md += `### Scene ${scene.scene_number}: ${scene.title}\n`;
        md += `**Location:** ${scene.location} | **Time:** ${scene.time_of_day} | **Mood:** ${scene.mood}\n`;
        md += `**Camera Angle:** ${scene.camera_angle} | **Lighting:** ${scene.lighting_style}\n\n`;

        md += `#### AI Visual Prompt:\n\`\`\`\n${scene.visual_prompt}\n\`\`\`\n`;
        if (scene.negative_prompt) {
          md += `**Negative Prompt:** \`${scene.negative_prompt}\`\n\n`;
        }

        if (scene.narrative_script) {
          md += `#### Action / Narrative:\n${scene.narrative_script}\n\n`;
        }

        if (scene.dialogue) {
          md += `#### Dialogue:\n\`\`\`\n${scene.dialogue}\n\`\`\`\n\n`;
        }
      }
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${project.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Screenplay.md"`);
    res.send(md);
  } catch (err) {
    console.error('Error exporting project:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
