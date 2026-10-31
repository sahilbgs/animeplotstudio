const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  host: process.env.PG_HOST || '127.0.0.1',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER || 'gtu_admin',
  password: process.env.PG_PASSWORD || '44113290',
  database: process.env.PG_DATABASE || 'anime_studio_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]', err);
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Team Members / Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        role VARCHAR(100) DEFAULT 'Anime Story Creator',
        avatar_color VARCHAR(30) DEFAULT '#8b5cf6',
        avatar_emoji VARCHAR(20) DEFAULT '⚡',
        password VARCHAR(255) DEFAULT '44113290',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255) DEFAULT '44113290';`);

    // 2. Projects (Anime Series)
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        tagline VARCHAR(255),
        synopsis TEXT,
        genre VARCHAR(100) DEFAULT 'Sci-Fi Action / Cyberpunk Fantasy',
        target_audience VARCHAR(100) DEFAULT 'Shonen / Seinen',
        art_style VARCHAR(100) DEFAULT 'Makoto Shinkai & Ufotable Hybrid',
        cover_image TEXT,
        status VARCHAR(50) DEFAULT 'In Production',
        created_by VARCHAR(100) DEFAULT 'Jiya & Sahil',
        is_published BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true;`);

    // 3. Characters
    await client.query(`
      CREATE TABLE IF NOT EXISTS characters (
        id SERIAL PRIMARY KEY,
        project_id INT REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        japanese_name VARCHAR(150),
        role VARCHAR(100) DEFAULT 'Protagonist',
        personality TEXT,
        appearance TEXT,
        visual_prompt_tags TEXT,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Parts (Episodes / Arcs / Chapters: Part 1, Part 2, Part 3...)
    await client.query(`
      CREATE TABLE IF NOT EXISTS parts (
        id SERIAL PRIMARY KEY,
        project_id INT REFERENCES projects(id) ON DELETE CASCADE,
        part_number INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        summary TEXT,
        cover_image TEXT,
        status VARCHAR(50) DEFAULT 'Drafting',
        order_index INT DEFAULT 1,
        created_by VARCHAR(100) DEFAULT 'Team',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Scenes (Scene-wise breakdown inside each Part)
    await client.query(`
      CREATE TABLE IF NOT EXISTS scenes (
        id SERIAL PRIMARY KEY,
        part_id INT REFERENCES parts(id) ON DELETE CASCADE,
        scene_number INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        location VARCHAR(255) DEFAULT 'Neo-Tokyo Shibuya Crossing',
        time_of_day VARCHAR(50) DEFAULT 'Midnight Rain',
        mood VARCHAR(100) DEFAULT 'Cinematic & Intense',
        camera_angle VARCHAR(100) DEFAULT 'Wide Cinematic Establishing Shot',
        lighting_style VARCHAR(100) DEFAULT 'Neon Cyberpunk & Volumetric Fog',
        visual_prompt TEXT NOT NULL,
        negative_prompt TEXT DEFAULT 'low quality, blurry, bad anatomy, deformed limbs, watermark, text',
        aspect_ratio VARCHAR(20) DEFAULT '16:9',
        ai_model_preset VARCHAR(100) DEFAULT 'Midjourney v6 / Niji',
        narrative_script TEXT,
        dialogue TEXT,
        characters_involved TEXT[] DEFAULT '{}',
        primary_image TEXT,
        order_index INT DEFAULT 1,
        status VARCHAR(50) DEFAULT 'In Progress',
        created_by VARCHAR(100) DEFAULT 'Team',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Media Uploads (Pictures uploaded for Parts and Scenes)
    await client.query(`
      CREATE TABLE IF NOT EXISTS media_uploads (
        id SERIAL PRIMARY KEY,
        project_id INT REFERENCES projects(id) ON DELETE CASCADE,
        part_id INT REFERENCES parts(id) ON DELETE SET NULL,
        scene_id INT REFERENCES scenes(id) ON DELETE SET NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_size BIGINT DEFAULT 0,
        mime_type VARCHAR(100),
        caption TEXT,
        asset_type VARCHAR(50) DEFAULT 'scene_frame',
        uploaded_by VARCHAR(100) DEFAULT 'Sahil',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Collaboration Comments & Scene Feedback
    await client.query(`
      CREATE TABLE IF NOT EXISTS scene_comments (
        id SERIAL PRIMARY KEY,
        scene_id INT REFERENCES scenes(id) ON DELETE CASCADE,
        author_name VARCHAR(100) NOT NULL,
        comment_text TEXT NOT NULL,
        comment_type VARCHAR(50) DEFAULT 'feedback',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Prompt Templates / Style Presets Library
    await client.query(`
      CREATE TABLE IF NOT EXISTS prompt_presets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        description TEXT,
        prompt_snippet TEXT NOT NULL,
        negative_snippet TEXT,
        preview_badge VARCHAR(50) DEFAULT 'Popular'
      );
    `);

    await client.query('COMMIT');
    console.log('[PostgreSQL] Database tables initialized successfully.');

    // Seed default team members if empty
    const userCheck = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCheck.rows[0].count, 10) === 0) {
      await pool.query(`
        INSERT INTO users (username, display_name, role, avatar_color, avatar_emoji) VALUES
        ('sahil', 'Sahil', 'Director & Lead Writer', '#8b5cf6', '🎬'),
        ('friend', 'Creative Friend', 'Art Director & Prompt Master', '#ec4899', '✨'),
        ('alex', 'Alex', 'Storyboard Specialist', '#06b6d4', '🖌️');
      `);
      console.log('[PostgreSQL] Seeded default team collaborators.');
    }

    // Seed prompt presets if empty
    const presetCheck = await pool.query('SELECT COUNT(*) FROM prompt_presets');
    if (parseInt(presetCheck.rows[0].count, 10) === 0) {
      const presets = [
        ['Makoto Shinkai Sky & Emotion', 'Style', 'Luminous skies, hyper-detailed clouds, emotional golden hour lighting', 'in the style of Makoto Shinkai, breathtaking detailed luminous sky, dynamic clouds, lens flare, vivid emotional anime lighting, 8k resolution, cinematic atmosphere', 'blurry, dull colors, lowres, flat shading', 'Trending'],
        ['Ufotable High-Octane Action', 'Style', 'Dynamic battle scenes with fluid particle sparks, elemental magic, intense camera tilt', 'in the style of Ufotable, Demon Slayer aesthetic, explosive elemental magic swirls, glowing katana trail, dynamic action pose, intense camera blur, cinematic 3D anime lighting', 'static pose, low quality, stiff animation, bad hands', 'Epic Action'],
        ['Cyberpunk Edgerunners Neon Grid', 'Style', 'High-contrast neon cyan and magenta, futuristic techwear, gritty cyberpunk', 'Studio Trigger style, Cyberpunk Edgerunners aesthetic, vibrant neon yellow and cyan highlights, gritty futuristic city background, techwear jacket, high octane bold outlines', 'pastel, washed out, watercolor, vintage', 'Cyberpunk'],
        ['Studio Ghibli Nostalgic Nature', 'Style', 'Hand-painted watercolor aesthetic, lush green hills, serene whimsical anime', 'Studio Ghibli style, Hayao Miyazaki aesthetic, hand-drawn traditional anime cel art, lush overgrown greenery, whimsical warm sunlight, gentle breeze, nostalgic atmosphere', '3d render, cgi, harsh lighting, gritty', 'Classic'],
        ['MAPPA Gritty Dark Fantasy', 'Style', 'Intense shadows, gritty texture, high-detail facial expressions like Jujutsu Kaisen', 'MAPPA studio style, dark urban fantasy aesthetic, deep contrasting shadows, glowing curse energy aura, hyper-detailed expressive eyes, cinematic composition', 'cute, chibi, blurry, poorly drawn eyes', 'Dark Fantasy'],
        ['90s Retro Cel Anime', 'Style', 'Grainy nostalgic VHS anime aesthetic, Cowboy Bebop / Sailor Moon era', '90s vintage anime cel, retro anime screenshot, VHS tape grain texture, soft color bleed, classic hand-painted anime aesthetic, nostalgic 1990s anime', 'modern 3d cgi, hyper polished, oversaturated digital', 'Retro VHS'],
        ['Dramatic Low Angle Shot', 'Camera', 'Powerful upwards angle making the character look heroic or imposing', 'cinematic extreme low angle shot, looking up at the character, majestic heroic perspective, dynamic wide field of view, dramatic perspective distortion', 'flat angle, passport photo, eye-level boring shot', 'Camera'],
        ['Tokyo Rain Reflection', 'Lighting', 'Wet pavement, glowing neon reflections in puddles, rain drops', 'heavy rain pouring down, wet asphalt reflecting vibrant neon billboards, glowing street lamps in the mist, floating raindrops illuminated by streetlights', 'dry, plain background, sunny day', 'Lighting']
      ];
      for (const p of presets) {
        await pool.query(
          'INSERT INTO prompt_presets (name, category, description, prompt_snippet, negative_snippet, preview_badge) VALUES ($1, $2, $3, $4, $5, $6)',
          p
        );
      }
      console.log('[PostgreSQL] Seeded prompt presets.');
    }

    // Seed a sample project if none exists
    const projCheck = await pool.query('SELECT COUNT(*) FROM projects');
    if (parseInt(projCheck.rows[0].count, 10) === 0) {
      const projRes = await pool.query(`
        INSERT INTO projects (title, tagline, synopsis, genre, target_audience, art_style, created_by)
        VALUES (
          $1, $2, $3, $4, $5, $6, $7
        ) RETURNING id;
      `, [
        'Neon Chronos: Astral Horizon',
        'When time fractures, two cyber-samurai must pierce the veil of Neo-Tokyo.',
        'Set in the neon-drenched metropolis of Neo-Tokyo in the year 2099. Sahil and his partner Ren discover that an ancient digital relic known as the Chrono Core has cracked reality into splintered timelines. Together, they must traverse temporal fractures across the city to stop the Chrono Syndicate from rewriting human history.',
        'Cyberpunk Action / Supernatural Fantasy',
        'Seinen / Shonen',
        'Makoto Shinkai x Ufotable Hybrid (Luminous Skies + High-Octane Particle Action)',
        'Sahil & Team'
      ]);
      const projId = projRes.rows[0].id;

      // Seed Characters
      await pool.query(`
        INSERT INTO characters (project_id, name, japanese_name, role, personality, appearance, visual_prompt_tags) VALUES
        ($1, 'Ren Kazama', '風間 蓮', 'Protagonist', 'Calm, tactical cyber-swordsman with an astral-infused katana.', 'Silver hair with cyan neon streak, tech-coat with glowing cybernetic gauntlet.', '1boy, silver spiky hair, cyan highlights, glowing mechanical cyber arm, black cyberpunk trench coat, holding glowing katana'),
        ($1, 'Aria Vance', 'ヴァンス アリア', 'Deuteragonist', 'Brilliant chronotech engineer and sniper who manipulates micro-time warps.', 'Amber eyes, twin dark braids, holographic ocular visor, tactical combat flight jacket.', '1girl, twin dark braids, glowing amber ocular visor, futuristic tactical sniper jacket, floating holographic data shards');
      `, [projId]);

      // Seed Part 1
      const p1Res = await pool.query(`
        INSERT INTO parts (project_id, part_number, title, summary, status, order_index, created_by)
        VALUES ($1, 1, $2, $3, 'In Production', 1, 'Sahil') RETURNING id;
      `, [
        projId,
        'Part 1: The Midnight Breach at Shibuya Core',
        'Ren and Aria infiltrate the subterranean research vault beneath Shibuya Crossing as an unnatural temporal rift tears through the rain-slicked city.'
      ]);
      const p1Id = p1Res.rows[0].id;

      // Seed Part 2
      const p2Res = await pool.query(`
        INSERT INTO parts (project_id, part_number, title, summary, status, order_index, created_by)
        VALUES ($1, 2, $2, $3, 'Drafting', 2, 'Creative Friend') RETURNING id;
      `, [
        projId,
        'Part 2: The Shattered Clocktower Duel',
        'Suspended atop the fractured temporal clocktower, Ren confronts the enigmatic Syndicate Phantom while Aria holds off waves of chronodrones.'
      ]);
      const p2Id = p2Res.rows[0].id;

      // Seed Scenes for Part 1
      const s1Res = await pool.query(`
        INSERT INTO scenes (part_id, scene_number, title, location, time_of_day, mood, camera_angle, lighting_style, visual_prompt, negative_prompt, narrative_script, dialogue, characters_involved, status, created_by)
        VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Rendered', 'Sahil') RETURNING id;
      `, [
        p1Id,
        'Scene 1: Overlooking Shibuya in the Temporal Rain',
        'Rooftop above Shibuya Crossing, Neo-Tokyo',
        'Midnight Rain',
        'Cinematic, Moody, Anticipation',
        'Ultra-Wide Establishing Shot',
        'Neon Reflections in Rain & Holographic Glow',
        'masterpiece, best quality, cinematic anime still, Makoto Shinkai and Ufotable aesthetic, wide establishing shot of Neo-Tokyo Shibuya crossing at midnight under pouring neon rain, towering holographic billboards, flying aerocars through volumetric mist, lone cyber warrior standing on rooftop edge in silhouette, intricate reflections on wet glass and asphalt, 8k resolution, photorealistic anime rendering --ar 16:9 --v 6.0',
        'blurry, low quality, bad anatomy, deformed limbs, artifacts, text watermark',
        'Torrential rain cascades over the neon skyscrapers of Shibuya. Below, holographic adverts flicker between English and Japanese kanji. On the edge of the broadcast antenna tower, Ren stands motionless, his cybernetic gauntlet humming with faint azure sparks.',
        'REN: "Aria, do you read me? The temporal signature is spiking right under the crossing."',
        ['Ren Kazama', 'Aria Vance']
      ]);

      const s2Res = await pool.query(`
        INSERT INTO scenes (part_id, scene_number, title, location, time_of_day, mood, camera_angle, lighting_style, visual_prompt, negative_prompt, narrative_script, dialogue, characters_involved, status, created_by)
        VALUES ($1, 2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Prompt Ready', 'Creative Friend') RETURNING id;
      `, [
        p1Id,
        'Scene 2: Awakening of the Chrono Rift',
        'Subterranean Vault beneath Shibuya Metro',
        'Midnight',
        'Sudden Shock & Supercharged Energy',
        'Low Angle Dutch Tilt on Chrono Relic',
        'Blinding Golden Energy Core & Deep Cyan Shadows',
        'masterpiece, ultra-detailed anime visual, Ufotable dynamic action lighting, an ancient glowing crystalline orb suspended in mid-air fracturing into swirling golden light ribbons, shockwaves shattering stone pillars, cyan energy arcs whipping through dust, high tension cinematic anime scene, particles floating, 8k resolution --ar 16:9',
        'lowres, bad quality, washed out colors, flat drawing',
        'The vault doors buckle inward. The Chrono Core shatters its containment ring, defying gravity. Golden temporal ribbons tear through the subterranean chamber, freezing falling water droplets in mid-air.',
        'ARIA (via comlink): "Ren! Do not get closer! The local entropy field is collapsing!"\nREN: "If I do not draw the blade now, this whole sector gets erased."',
        ['Ren Kazama']
      ]);

      const s3Res = await pool.query(`
        INSERT INTO scenes (part_id, scene_number, title, location, time_of_day, mood, camera_angle, lighting_style, visual_prompt, negative_prompt, narrative_script, dialogue, characters_involved, status, created_by)
        VALUES ($1, 3, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'In Progress', 'Sahil') RETURNING id;
      `, [
        p1Id,
        'Scene 3: Unsheathing the Astral Blade',
        'Fractured Shibuya Crossing Plaza',
        'Frozen Time / Golden Haze',
        'Heroic, Climax, Epic Resolve',
        'Close-up Dynamic Profile on Katana Unsheathing',
        'Glowing Azure Blade Light illuminating Ren\'s Determined Face',
        'masterpiece, top tier anime art, Ufotable demon slayer style, close up dynamic action shot of Ren drawing a glowing azure energy katana from scabbard, bright blue particle sparks exploding along the blade edge, intense focused eyes, silver hair fluttering in energy wind, high contrast shadows, cinematic movie frame --ar 16:9',
        'low quality, deformed hands, extra fingers, blurry face, missing katana',
        'Ren grips the hilt of the Astral Blade. As steel slides from scabbard, a shockwave of azure luminescence pushes back the temporal fog. Droplets of water shatter into light.',
        'REN: "Time isn\'t a river. It is a forge. And I decide what gets forged today."',
        ['Ren Kazama']
      ]);

      // Seed Scene comments
      await pool.query(`
        INSERT INTO scene_comments (scene_id, author_name, comment_text, comment_type) VALUES
        ($1, 'Sahil', 'Let us make sure the background shows the Shibuya 109 building replaced by the Chrono Corp Megatower!', 'art_direction'),
        ($1, 'Creative Friend', 'Love this! I am rendering the Midjourney frame right now with the updated prompt and uploading it here!', 'feedback'),
        ($2, 'Creative Friend', 'The golden ribbon prompt gives insane Ufotable vibes. Let me know if you want more particles!', 'prompt_tweak');
      `, [s1Res.rows[0].id, s2Res.rows[0].id]);

      console.log('[PostgreSQL] Seeded initial Anime Story Project with Part 1 & Part 2 and Scenes!');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PostgreSQL Init Error]', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDB,
  query: (text, params) => pool.query(text, params),
};
