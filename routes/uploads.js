const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

// Ensure upload directories exist
const uploadBaseDir = path.join(__dirname, '..', 'uploads');
const partsDir = path.join(uploadBaseDir, 'parts');
const scenesDir = path.join(uploadBaseDir, 'scenes');
const projectsDir = path.join(uploadBaseDir, 'projects');

[uploadBaseDir, partsDir, scenesDir, projectsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (req.params.sceneId) {
      cb(null, scenesDir);
    } else if (req.params.partId) {
      cb(null, partsDir);
    } else {
      cb(null, projectsDir);
    }
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `${cleanBase}-${uniqueSuffix}${ext}`);
  }
});

// File filter: accept images and video clips (Midjourney, Kling, Sora, Runway, etc.)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif|svg|mp4|webm|mov/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const mime = file.mimetype;
  if (allowedTypes.test(ext) || allowedTypes.test(mime) || mime.startsWith('video/') || mime.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files (PNG, JPG, WEBP, GIF, SVG, MP4, WEBM, MOV) are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB max per picture or video clip
});

// UPLOAD TO SCENE (Scene-wise pictures)
router.post('/scene/:sceneId', upload.array('images', 10), async (req, res) => {
  try {
    const sceneId = req.params.sceneId;
    const uploadedBy = req.body.uploaded_by || 'Sahil';
    const caption = req.body.caption || '';
    const setPrimary = req.body.set_primary !== 'false';

    // Verify scene and get part_id & project_id
    const sceneRes = await db.query(`
      SELECT s.id, s.part_id, pt.project_id, s.primary_image
      FROM scenes s
      JOIN parts pt ON pt.id = s.part_id
      WHERE s.id = $1
    `, [sceneId]);

    if (sceneRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    const { part_id, project_id, primary_image } = sceneRes.rows[0];
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ success: false, error: 'No image files uploaded' });
    }

    const savedMedia = [];
    let firstFileUrl = null;

    for (const file of files) {
      const fileUrl = `/uploads/scenes/${file.filename}`;
      if (!firstFileUrl) firstFileUrl = fileUrl;

      const mediaRes = await db.query(`
        INSERT INTO media_uploads (
          project_id, part_id, scene_id, file_name, file_path, file_url,
          file_size, mime_type, caption, asset_type, uploaded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'scene_frame', $10)
        RETURNING *
      `, [
        project_id,
        part_id,
        sceneId,
        file.originalname,
        file.path,
        fileUrl,
        file.size,
        file.mimetype,
        caption || file.originalname,
        uploadedBy
      ]);

      savedMedia.push(mediaRes.rows[0]);
    }

    // Always update scene primary_image and mark status as Art Ready
    if (!primary_image || setPrimary) {
      await db.query(`
        UPDATE scenes 
        SET primary_image = $1, 
            status = CASE WHEN status = 'Submitted' THEN 'Submitted' ELSE 'Art Ready' END
        WHERE id = $2
      `, [firstFileUrl, sceneId]);
    }

    res.json({
      success: true,
      message: `Successfully uploaded ${savedMedia.length} scene image(s)`,
      media: savedMedia,
      primary_image: firstFileUrl
    });
  } catch (err) {
    console.error('Error uploading scene images:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// UPLOAD TO PART (Part-wise pictures / Arc covers)
router.post('/part/:partId', upload.array('images', 10), async (req, res) => {
  try {
    const partId = req.params.partId;
    const uploadedBy = req.body.uploaded_by || 'Bunny';
    const caption = req.body.caption || '';
    const setCover = req.body.set_cover === 'true';

    // Verify part and get project_id
    const partRes = await db.query('SELECT * FROM parts WHERE id = $1', [partId]);
    if (partRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Part not found' });
    }

    const part = partRes.rows[0];
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ success: false, error: 'No image files uploaded' });
    }

    const savedMedia = [];
    let firstFileUrl = null;

    for (const file of files) {
      const fileUrl = `/uploads/parts/${file.filename}`;
      if (!firstFileUrl) firstFileUrl = fileUrl;

      const mediaRes = await db.query(`
        INSERT INTO media_uploads (
          project_id, part_id, scene_id, file_name, file_path, file_url,
          file_size, mime_type, caption, asset_type, uploaded_by
        ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, 'part_cover', $9)
        RETURNING *
      `, [
        part.project_id,
        partId,
        file.originalname,
        file.path,
        fileUrl,
        file.size,
        file.mimetype,
        caption || file.originalname,
        uploadedBy
      ]);

      savedMedia.push(mediaRes.rows[0]);
    }

    // Set as part cover if requested or if none exists
    if (!part.cover_image || setCover) {
      await db.query('UPDATE parts SET cover_image = $1 WHERE id = $2', [firstFileUrl, partId]);
    }

    res.json({
      success: true,
      message: `Successfully uploaded ${savedMedia.length} part image(s)`,
      media: savedMedia,
      cover_image: firstFileUrl
    });
  } catch (err) {
    console.error('Error uploading part images:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// UPLOAD TO PROJECT (Project main poster)
router.post('/project/:projectId', upload.single('image'), async (req, res) => {
  try {
    const projectId = req.params.projectId;
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    const fileUrl = `/uploads/projects/${req.file.filename}`;
    await db.query('UPDATE projects SET cover_image = $1 WHERE id = $2', [fileUrl, projectId]);

    await db.query(`
      INSERT INTO media_uploads (
        project_id, file_name, file_path, file_url, file_size, mime_type, caption, asset_type, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Series Poster', 'project_cover', $7)
    `, [
      projectId,
      req.file.originalname,
      req.file.path,
      fileUrl,
      req.file.size,
      req.file.mimetype,
      req.body.uploaded_by || 'Team'
    ]);

    res.json({ success: true, cover_image: fileUrl });
  } catch (err) {
    console.error('Error uploading project cover:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// SET KEYFRAME FOR SCENE
router.put('/media/:id/set-keyframe', async (req, res) => {
  try {
    const mediaId = req.params.id;
    const mediaRes = await db.query('SELECT * FROM media_uploads WHERE id = $1', [mediaId]);
    if (mediaRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    const media = mediaRes.rows[0];
    if (media.scene_id) {
      await db.query('UPDATE scenes SET primary_image = $1 WHERE id = $2', [media.file_url, media.scene_id]);
    } else if (media.part_id) {
      await db.query('UPDATE parts SET cover_image = $1 WHERE id = $2', [media.file_url, media.part_id]);
    }

    res.json({ success: true, message: 'Keyframe updated successfully', url: media.file_url });
  } catch (err) {
    console.error('Error setting keyframe:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE MEDIA ASSET
router.delete('/media/:id', async (req, res) => {
  try {
    const mediaId = req.params.id;
    const mediaRes = await db.query('SELECT * FROM media_uploads WHERE id = $1', [mediaId]);
    if (mediaRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    const media = mediaRes.rows[0];

    // Delete file from disk safely
    if (fs.existsSync(media.file_path)) {
      try {
        fs.unlinkSync(media.file_path);
      } catch (e) {
        console.warn('Could not remove file on disk:', e.message);
      }
    }

    await db.query('DELETE FROM media_uploads WHERE id = $1', [mediaId]);

    // If scene was using this as primary_image, clear it or pick next
    if (media.scene_id) {
      const nextMediaRes = await db.query(
        'SELECT file_url FROM media_uploads WHERE scene_id = $1 ORDER BY created_at DESC LIMIT 1',
        [media.scene_id]
      );
      const nextUrl = nextMediaRes.rows.length > 0 ? nextMediaRes.rows[0].file_url : null;
      await db.query('UPDATE scenes SET primary_image = $1 WHERE id = $2', [nextUrl, media.scene_id]);
    }

    res.json({ success: true, message: 'Media deleted successfully' });
  } catch (err) {
    console.error('Error deleting media:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// SAVE DIALOG-CAPTIONED IMAGE (from client-side canvas)
router.post('/scene/:sceneId/save-dialog-image', async (req, res) => {
  try {
    const sceneId = req.params.sceneId;
    const { imageBase64, caption, uploaded_by } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'No image data provided' });
    }

    const sceneRes = await db.query(`
      SELECT s.id, s.part_id, pt.project_id
      FROM scenes s
      JOIN parts pt ON pt.id = s.part_id
      WHERE s.id = $1
    `, [sceneId]);

    if (sceneRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }
    const { part_id, project_id } = sceneRes.rows[0];

    // Decode base64
    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer;
    let ext = '.png';
    if (matches && matches.length === 3) {
      buffer = Buffer.from(matches[2], 'base64');
      if (matches[1].includes('jpeg') || matches[1].includes('jpg')) ext = '.jpg';
    } else {
      buffer = Buffer.from(imageBase64, 'base64');
    }

    const filename = `dialog_frame_${sceneId}_${Date.now()}${ext}`;
    const filePath = path.join(scenesDir, filename);
    fs.writeFileSync(filePath, buffer);
    const fileUrl = `/uploads/scenes/${filename}`;

    // Update scene primary_image
    await db.query('UPDATE scenes SET primary_image = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [fileUrl, sceneId]);

    // Save to media_uploads
    const mediaRes = await db.query(`
      INSERT INTO media_uploads (
        project_id, part_id, scene_id, file_name, file_path, file_url,
        file_size, mime_type, caption, asset_type, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'dialog_frame', $10)
      RETURNING *
    `, [
      project_id,
      part_id,
      sceneId,
      filename,
      filePath,
      fileUrl,
      buffer.length,
      ext === '.png' ? 'image/png' : 'image/jpeg',
      caption || 'Visual Dialog Frame',
      uploaded_by || 'Creator'
    ]);

    res.json({
      success: true,
      file_url: fileUrl,
      media: mediaRes.rows[0],
      message: 'Dialog frame saved to scene successfully'
    });
  } catch (err) {
    console.error('Error saving dialog image:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
