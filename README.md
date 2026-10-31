# ANIME-PLOT STUDIO — Collaborative Story & Visual Platform

A collaborative anime plot and production platform designed for creative pairs and teams to build anime stories, organize them **Part-wise (Part 1, 2, 3...)**, craft **Scene-wise breakdowns**, engineer **AI Visual Prompts** (Midjourney, Stable Diffusion, Leonardo, Niji), and **Upload Pictures** on both Part-level (arc banners/covers) and Scene-level (storyboard frames/rendered scenes).

Powered by **PostgreSQL 16** (`anime_studio_db`) and Node.js.

---

## Quick Access

- **Local Machine:** [http://localhost:4000](http://localhost:4000)
- **Local Network (Friends/Phones/Laptops):** [http://172.16.20.220:4000](http://172.16.20.220:4000)
- **Cloudflare Custom Subdomain:** `https://anime.aceglory.in`

---

## Core Features

### 1. Team Collaboration (You & Your Friend)
- **Switch Active Creator:** Quick switch between you and your friend (e.g. Sahil, Creative Friend, Alex) from the top-right pill badge.
- **Collaborator Tracking:** Every scene, prompt, picture upload, and feedback note records who created it.
- **Add Friends:** Easily invite more friends with custom roles and avatar color accents.

### 2. Story Structure: Part-wise Organization (Part 1, 2, 3...)
- Built specifically for progressive anime arcs: **Part 1**, **Part 2**, **Part 3**, etc.
- Each Part includes:
  - Part Number & Title
  - Story Arc Summary & Goals
  - Part-wise Cover Artwork
  - Total Scene Count
  - One-click "Create Next Part" button

### 3. Scene-wise Storyboard & Prompt Storage
- Inside every Part, create and organize scenes sequentially (**Scene 1, Scene 2, Scene 3...**).
- Each scene stores:
  - **Scene Title & Number**
  - **Location & Setting** (e.g., Neo-Tokyo Shibuya Crossing in Rain)
  - **Time of Day & Atmosphere** (Midnight, Twilight, Golden Hour)
  - **Mood & Tone** (Cinematic, Intense, Melancholic)
  - **Camera Angle & Shot Type** (Wide Establishing, Low Dutch Tilt, Close-up Profile)
  - **AI Visual Prompt:** Full generation prompt engineered with styles (Makoto Shinkai, Ufotable, Studio Ghibli, 90s Retro Cel, Trigger, MAPPA).
  - **Negative Prompt:** Quality and anatomy preservation filters.
  - **Narrative Script:** Action beats and screenplay directions.
  - **Dialogue:** Formatted character speech.
  - **1-Click Copy:** Ready to paste into Midjourney, Stable Diffusion, Leonardo, or Niji.

### 4. Picture Uploads (Part-wise & Scene-wise)
- **Scene-wise Uploads:**
  - Drag-and-drop or click to upload your rendered AI frames, concept sketches, or storyboard drawings directly to any scene.
  - Upload multiple pictures per scene.
  - 1-click **Set as Scene Keyframe** to choose which picture appears on the storyboard card.
- **Part-wise Uploads:**
  - Upload arc cover artwork and banners to represent Part 1, Part 2, etc.
- **Interactive Lightbox:**
  - Click any picture to zoom full-screen and download.

### 5. Screenplay Reader View
- Switch tabs to **Screenplay Reader** to read the anime story like a published manga script or screenplay with images embedded right next to the dialogue.

### 6. AI Prompt Studio & Style Presets
- Curated anime studio aesthetic presets ready to copy or append with 1 click:
  - Makoto Shinkai Sky & Emotion
  - Ufotable High-Octane Particle Action
  - Studio Trigger Cyberpunk Edgerunners
  - Studio Ghibli Nostalgic Nature
  - MAPPA Gritty Dark Fantasy
  - 90s Retro VHS Cel Anime

### 7. Screenplay Export
- One-click export to standard **Markdown Screenplay (.md)** format for sharing or printing.

---

## Management Commands

```bash
# Start server in background
/home/gtu-itr/anime-story-studio/start_anime_studio.sh

# Stop server
/home/gtu-itr/anime-story-studio/stop_anime_studio.sh

# View live logs
tail -f /home/gtu-itr/anime-story-studio/logs/anime_studio.log
```

---

## PostgreSQL Database Architecture

- **Database Name:** `anime_studio_db`
- **Tables:**
  - `projects`: Series details, genre, art style, poster.
  - `parts`: Part 1, 2, 3... arc summaries, cover images.
  - `scenes`: Scene number, prompts, location, mood, script, dialogue, keyframe image.
  - `media_uploads`: All uploaded pictures for parts and scenes.
  - `users`: Team collaborators and active members.
  - `characters`: Character roster, personality, and visual appearance tags.
  - `prompt_presets`: Curated anime aesthetic prompts library.
  - `scene_comments`: Team review and feedback notes.
