const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initDB, pool } = require('./db');
const projectsRouter = require('./routes/projects');
const partsRouter = require('./routes/parts');
const scenesRouter = require('./routes/scenes');
const uploadsRouter = require('./routes/uploads');
const teamRouter = require('./routes/team');
const charactersRouter = require('./routes/characters');
const commentsRouter = require('./routes/comments');
const presetsRouter = require('./routes/presets');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving
const publicDir = path.join(__dirname, 'public');
const uploadsDir = path.join(__dirname, 'uploads');

[uploadsDir, path.join(uploadsDir, 'parts'), path.join(uploadsDir, 'scenes'), path.join(uploadsDir, 'projects')].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(express.static(publicDir));
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/projects', projectsRouter);
app.use('/api/parts', partsRouter);
app.use('/api/scenes', scenesRouter);
app.use('/api/upload', uploadsRouter);
app.use('/api/team', teamRouter);
app.use('/api/characters', charactersRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/prompt-presets', presetsRouter);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT NOW() as now, current_database() as db');
    res.json({
      status: 'healthy',
      service: 'ANIME-PLOT STUDIO - Collaborative Platform',
      database: dbRes.rows[0].db,
      timestamp: dbRes.rows[0].now,
      uptime: process.uptime()
    });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// Fallback to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Startup sequence
async function startServer() {
  try {
    console.log('[Server] Connecting to PostgreSQL and initializing schema...');
    await initDB();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(`ANIME-PLOT STUDIO - COLLABORATION PLATFORM`);
      console.log(`Running at: http://127.0.0.1:${PORT}`);
      console.log(`Uploads dir: ${uploadsDir}`);
      console.log(`Database: PostgreSQL (anime_studio_db)`);
      console.log(`====================================================`);
    });
    return server;
  } catch (err) {
    console.error('[Server Fatal] Failed to start:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
