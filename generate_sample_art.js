const fs = require('fs');
const path = require('path');
const db = require('./db');

const scenesDir = path.join(__dirname, 'uploads', 'scenes');
const partsDir = path.join(__dirname, 'uploads', 'parts');
const projDir = path.join(__dirname, 'uploads', 'projects');

[scenesDir, partsDir, projDir].forEach(d => fs.mkdirSync(d, { recursive: true }));

function generateAnimeSceneSVG(title, subtitle, color1, color2, iconPath) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
  <defs>
    <linearGradient id="skyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color1}"/>
      <stop offset="50%" stop-color="#090d16"/>
      <stop offset="100%" stop-color="${color2}"/>
    </linearGradient>
    <linearGradient id="neonGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9"/>
      <stop offset="50%" stop-color="#c084fc" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#f43f5e" stop-opacity="0.9"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="15" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="1280" height="720" fill="url(#skyGrad)"/>
  <rect width="1280" height="720" fill="url(#grid)"/>

  <!-- City Skyline / Cyberpunk Silhouettes -->
  <polygon points="0,520 80,480 140,510 220,440 280,470 340,380 420,430 500,320 580,410 650,350 740,460 820,390 900,430 980,310 1060,400 1150,360 1220,440 1280,420 1280,720 0,720" fill="#05070d"/>

  <!-- Glowing Windows & Billboards -->
  <rect x="225" y="445" width="50" height="90" fill="#06b6d4" opacity="0.35" filter="url(#glow)"/>
  <rect x="495" y="325" width="80" height="180" fill="#ec4899" opacity="0.4" filter="url(#glow)"/>
  <rect x="975" y="315" width="80" height="150" fill="#3b82f6" opacity="0.35" filter="url(#glow)"/>

  <!-- Giant Moon / Hologram Ring -->
  <circle cx="640" cy="240" r="160" fill="none" stroke="url(#neonGlow)" stroke-width="6" opacity="0.6" filter="url(#glow)"/>
  <circle cx="640" cy="240" r="140" fill="rgba(192, 132, 252, 0.04)"/>

  <!-- Rain Streaks -->
  <line x1="120" y1="40" x2="100" y2="280" stroke="#38bdf8" stroke-width="1.5" opacity="0.4"/>
  <line x1="380" y1="120" x2="360" y2="420" stroke="#c084fc" stroke-width="1.2" opacity="0.4"/>
  <line x1="720" y1="20" x2="700" y2="340" stroke="#38bdf8" stroke-width="1.5" opacity="0.35"/>
  <line x1="940" y1="80" x2="920" y2="400" stroke="#f43f5e" stroke-width="1.2" opacity="0.4"/>
  <line x1="1120" y1="160" x2="1100" y2="480" stroke="#38bdf8" stroke-width="1.5" opacity="0.35"/>

  <!-- Floor Reflection -->
  <rect x="0" y="580" width="1280" height="140" fill="rgba(6, 182, 212, 0.12)" filter="url(#glow)"/>

  <!-- Character Silhouette Center -->
  <path d="M 640 430 Q 645 420 648 400 Q 652 385 645 375 Q 640 370 635 375 Q 628 385 632 400 Q 635 420 640 430 Z" fill="#ffffff" filter="url(#glow)"/>
  <polygon points="630,430 650,430 660,560 620,560" fill="#0f172a"/>
  <!-- Katana Laser Blade -->
  <line x1="655" y1="480" x2="750" y2="390" stroke="#38bdf8" stroke-width="4" filter="url(#glow)"/>

  <!-- Title Badge overlay -->
  <rect x="40" y="40" width="540" height="110" rx="16" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
  <text x="65" y="80" font-family="'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="28" fill="#ffffff" letter-spacing="1">
    ${title.toUpperCase()}
  </text>
  <text x="65" y="118" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#94a3b8">
    ${subtitle}
  </text>

  <!-- Aspect Ratio & Watermark Tag -->
  <rect x="1140" y="40" width="100" height="34" rx="8" fill="rgba(139, 92, 246, 0.3)" stroke="#8b5cf6" stroke-width="1"/>
  <text x="1190" y="62" font-family="monospace" font-weight="bold" font-size="14" fill="#c084fc" text-anchor="middle">16:9 • 8K</text>
</svg>`;
}

async function run() {
  console.log('Generating initial anime studio sample art...');

  // 1. Scene 1 SVG
  const scene1Path = path.join(scenesDir, 'shibuya_rain_establishing.svg');
  fs.writeFileSync(
    scene1Path,
    generateAnimeSceneSVG('Scene 1: Shibuya Rain', 'Ultra-Wide Establishing Shot • Makoto Shinkai Style', '#0f172a', '#1e1b4b')
  );

  // 2. Scene 2 SVG
  const scene2Path = path.join(scenesDir, 'chrono_core_awakening.svg');
  fs.writeFileSync(
    scene2Path,
    generateAnimeSceneSVG('Scene 2: Chrono Rift', 'Subterranean Vault • Ufotable Elemental Action', '#451a03', '#1e1b4b')
  );

  // 3. Scene 3 SVG
  const scene3Path = path.join(scenesDir, 'astral_blade_drawn.svg');
  fs.writeFileSync(
    scene3Path,
    generateAnimeSceneSVG('Scene 3: Astral Blade', 'Katana Unsheathing • Azure Particle Climax', '#082f49', '#311042')
  );

  // 4. Part 1 Cover SVG
  const part1CoverPath = path.join(partsDir, 'part1_shibuya_cover.svg');
  fs.writeFileSync(
    part1CoverPath,
    generateAnimeSceneSVG('Part 1: The Midnight Breach', 'Shibuya Core Arc • Episodes 1 - 3', '#18181b', '#3b0764')
  );

  // 5. Part 2 Cover SVG
  const part2CoverPath = path.join(partsDir, 'part2_clocktower_cover.svg');
  fs.writeFileSync(
    part2CoverPath,
    generateAnimeSceneSVG('Part 2: Clocktower Duel', 'Temporal Climax Arc • Episodes 4 - 6', '#172554', '#4c0519')
  );

  // 6. Project Poster SVG
  const projectCoverPath = path.join(projDir, 'neon_chronos_poster.svg');
  fs.writeFileSync(
    projectCoverPath,
    generateAnimeSceneSVG('NEON CHRONOS: ASTRAL HORIZON', 'Official Anime Series Concept Artwork', '#030712', '#4c1d95')
  );

  // Update DB with these generated paths
  const s1Url = '/uploads/scenes/shibuya_rain_establishing.svg';
  const s2Url = '/uploads/scenes/chrono_core_awakening.svg';
  const s3Url = '/uploads/scenes/astral_blade_drawn.svg';
  const p1CoverUrl = '/uploads/parts/part1_shibuya_cover.svg';
  const p2CoverUrl = '/uploads/parts/part2_clocktower_cover.svg';
  const projCoverUrl = '/uploads/projects/neon_chronos_poster.svg';

  await db.query('UPDATE projects SET cover_image = $1 WHERE id = 1', [projCoverUrl]);
  await db.query('UPDATE parts SET cover_image = $1 WHERE id = 1', [p1CoverUrl]);
  await db.query('UPDATE parts SET cover_image = $1 WHERE id = 2', [p2CoverUrl]);

  // Update scenes
  await db.query('UPDATE scenes SET primary_image = $1 WHERE scene_number = 1', [s1Url]);
  await db.query('UPDATE scenes SET primary_image = $1 WHERE scene_number = 2', [s2Url]);
  await db.query('UPDATE scenes SET primary_image = $1 WHERE scene_number = 3', [s3Url]);

  // Insert media_uploads rows
  await db.query(`
    INSERT INTO media_uploads (project_id, part_id, scene_id, file_name, file_path, file_url, file_size, mime_type, caption, asset_type, uploaded_by)
    VALUES 
    (1, 1, 1, 'shibuya_rain_establishing.svg', $1, $2, 4096, 'image/svg+xml', 'Wide Establishing Shot of Shibuya in Rain', 'scene_frame', 'Sahil'),
    (1, 1, 2, 'chrono_core_awakening.svg', $3, $4, 4096, 'image/svg+xml', 'Chrono Relic Supercharged Core', 'scene_frame', 'Creative Friend'),
    (1, 1, 3, 'astral_blade_drawn.svg', $5, $6, 4096, 'image/svg+xml', 'Astral Blade Ignition Frame', 'scene_frame', 'Sahil'),
    (1, 1, NULL, 'part1_shibuya_cover.svg', $7, $8, 4096, 'image/svg+xml', 'Part 1 Arc Visual Banner', 'part_cover', 'Sahil'),
    (1, 2, NULL, 'part2_clocktower_cover.svg', $9, $10, 4096, 'image/svg+xml', 'Part 2 Arc Visual Banner', 'part_cover', 'Creative Friend')
    ON CONFLICT DO NOTHING;
  `, [
    scene1Path, s1Url,
    scene2Path, s2Url,
    scene3Path, s3Url,
    part1CoverPath, p1CoverUrl,
    part2CoverPath, p2CoverUrl
  ]);

  console.log('Sample anime artwork and DB records generated successfully!');
  db.pool.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
