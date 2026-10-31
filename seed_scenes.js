const { query, pool } = require('./db');

async function seedScenes() {
  const p1Id = 1;
  const s2 = await query(`
    INSERT INTO scenes (part_id, scene_number, title, location, time_of_day, mood, camera_angle, lighting_style, visual_prompt, negative_prompt, narrative_script, dialogue, characters_involved, status, created_by)
    VALUES ($1, 2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id;
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
    ['Ren Kazama'],
    'Prompt Ready',
    'Creative Friend'
  ]);

  const s3 = await query(`
    INSERT INTO scenes (part_id, scene_number, title, location, time_of_day, mood, camera_angle, lighting_style, visual_prompt, negative_prompt, narrative_script, dialogue, characters_involved, status, created_by)
    VALUES ($1, 3, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id;
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
    ['Ren Kazama'],
    'In Progress',
    'Sahil'
  ]);

  console.log(`Successfully seeded Scene 2 (ID: ${s2.rows[0].id}) and Scene 3 (ID: ${s3.rows[0].id})`);
  pool.end();
}

seedScenes().catch(err => {
  console.error(err);
  process.exit(1);
});
