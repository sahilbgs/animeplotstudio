const db = require('../db');

async function migrate() {
  console.log('[Migration] Creating scene_dialogues table...');
  await db.query(`
    CREATE TABLE IF NOT EXISTS scene_dialogues (
      id SERIAL PRIMARY KEY,
      scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
      media_id INTEGER REFERENCES media_uploads(id) ON DELETE SET NULL,
      character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
      character_name VARCHAR(100) NOT NULL,
      dialogue_text TEXT NOT NULL,
      order_index INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const projRes = await db.query('SELECT id FROM projects ORDER BY id ASC LIMIT 1');
  const projectId = projRes.rows.length > 0 ? projRes.rows[0].id : 3;

  console.log('[Migration] Checking characters for project ' + projectId + '...');
  const charCheck = await db.query('SELECT count(*) FROM characters WHERE project_id = $1', [projectId]);
  if (parseInt(charCheck.rows[0].count) === 0) {
    await db.query(`
      INSERT INTO characters (project_id, name, japanese_name, role, personality, appearance, visual_prompt_tags, avatar_url)
      VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8),
      ($9, $10, $11, $12, $13, $14, $15, $16),
      ($17, $18, $19, $20, $21, $22, $23, $24)
    `, [
      projectId, 'Akira', 'アキラ', 'Protagonist & Sword Master', 'Brave, serious, loyal',
      'Silver hair, sharp amber eyes, cyber-samurai robes with glowing edge katana',
      'silver hair, anime swordsman, black coat, intense eyes', '/uploads/scenes/scene_library_discovery.jpg',

      projectId, 'Yuna', 'ユナ', 'Shrine Maiden & Strategist', 'Kind, intelligent, funny',
      'Long dark violet hair, white and crimson shrine vestments, carrying ancient scrolls',
      'violet hair, anime miko, golden hair clip, gentle expression', '/uploads/scenes/scene_rooftop_sunset.jpg',

      projectId, 'Kuro', 'クロ', 'Shadow Ninja Leader', 'Cruel, clever, dangerous',
      'Midnight-black ninja cowl, crimson mask, twin shadow daggers, smoke aura',
      'masked ninja, red accents, glowing red eyes, shadow particles', '/uploads/scenes/scene_clocktower_lightning.jpg'
    ]);
    console.log('[Migration] Seeded 3 characters: Akira, Yuna, Kuro');
  } else {
    console.log('[Migration] Characters already exist:', charCheck.rows[0].count);
  }

  // Find first scene
  const sceneRes = await db.query('SELECT id FROM scenes ORDER BY id ASC LIMIT 1');
  if (sceneRes.rows.length > 0) {
    const sceneId = sceneRes.rows[0].id;
    const dialCheck = await db.query('SELECT count(*) FROM scene_dialogues WHERE scene_id = $1', [sceneId]);
    if (parseInt(dialCheck.rows[0].count) === 0) {
      const akiraRes = await db.query("SELECT id FROM characters WHERE project_id = $1 AND name = 'Akira'", [projectId]);
      const yunaRes = await db.query("SELECT id FROM characters WHERE project_id = $1 AND name = 'Yuna'", [projectId]);
      const akiraId = akiraRes.rows.length > 0 ? akiraRes.rows[0].id : null;
      const yunaId = yunaRes.rows.length > 0 ? yunaRes.rows[0].id : null;

      await db.query(`
        INSERT INTO scene_dialogues (scene_id, character_id, character_name, dialogue_text, order_index)
        VALUES 
        ($1, $2, 'Akira', 'Finally, I have reached the village entrance.', 1),
        ($1, $3, 'Yuna', 'You are late, Akira!', 2)
      `, [sceneId, akiraId, yunaId]);
      console.log('[Migration] Seeded sample dialogues for scene ' + sceneId);
    }
    await db.query("UPDATE scenes SET status = 'Submitted' WHERE id = $1", [sceneId]);
  }

  console.log('[Migration] Completed successfully!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('[Migration Error]', err);
  process.exit(1);
});
