// ==============================================================================
// ANIME-PLOT STUDIO - APPLICATION CONTROLLER
// ==============================================================================

const state = {
  activeProject: null,
  activePart: null,
  activeScene: null,
  activeTab: 'storyboard',
  currentUser: {
    username: 'sahil',
    display_name: 'Sahil',
    role: 'Director & Lead Writer',
    avatar_color: '#4f46e5'
  },
  projects: [],
  parts: [],
  scenes: [],
  characters: [],
  team: [],
  presets: []
};

// Global dropzone managers
let sceneDropzone = null;
let partDropzone = null;

document.addEventListener('DOMContentLoaded', async () => {
  initCurrentUser();
  initEventListeners();
  initDropzones();
  initPWA();
  await loadInitialData();
});

// Initialize active collaborator from localStorage
function initCurrentUser() {
  const saved = localStorage.getItem('anime_studio_user');
  if (saved) {
    try {
      state.currentUser = JSON.parse(saved);
    } catch (e) {}
  }
  updateUserHeaderDisplay();
}

function updateUserHeaderDisplay() {
  const nameEl = document.getElementById('current-user-name');
  const roleEl = document.getElementById('current-user-role');
  const avatarEl = document.getElementById('current-user-avatar');
  if (nameEl) nameEl.textContent = state.currentUser.display_name;
  if (roleEl) roleEl.textContent = state.currentUser.role;
  if (avatarEl) {
    avatarEl.textContent = getInitials(state.currentUser.display_name);
    avatarEl.style.backgroundColor = state.currentUser.avatar_color || '#4f46e5';
  }
}

// Initial Data Loading
async function loadInitialData() {
  try {
    // 1. Team & Presets
    const [teamData, presetsData, projData] = await Promise.all([
      API.getTeam(),
      API.getPromptPresets(),
      API.getProjects()
    ]);

    state.team = teamData.team || [];
    state.presets = presetsData.presets || [];
    state.projects = projData.projects || [];

    // Select first project or handle empty
    if (state.projects.length > 0) {
      const savedProjId = localStorage.getItem('anime_studio_active_project');
      const found = state.projects.find(p => p.id === parseInt(savedProjId, 10));
      await selectProject(found ? found.id : state.projects[0].id);
    } else {
      renderEmptyProjectState();
    }
  } catch (err) {
    console.error('Initialization error:', err);
    showToast('Failed to connect to PostgreSQL backend: ' + err.message, 'error');
  }
}

// Select and render a Project (Anime Story)
async function selectProject(projectId) {
  try {
    const data = await API.getProject(projectId);
    state.activeProject = data.project;
    state.characters = data.characters || [];
    state.parts = data.parts || [];
    localStorage.setItem('anime_studio_active_project', projectId);

    // Update matching entry in state.projects
    const pIndex = state.projects.findIndex(p => p.id === projectId);
    if (pIndex !== -1) {
      state.projects[pIndex] = {
        ...state.projects[pIndex],
        ...data.project,
        total_parts: state.parts.length
      };
    }

    renderProjectBanner();
    renderStoriesControls();

    // Select first part if available
    if (state.parts.length > 0) {
      await selectPart(state.parts[0].id);
    } else {
      state.activePart = null;
      state.scenes = [];
      renderPartsBar();
      renderScenesView();
    }
    updateStepper();
  } catch (err) {
    console.error('Error selecting project:', err);
    showToast('Failed to load project details', 'error');
  }
}

// Select and render a Part (e.g. Part 1, Part 2...)
async function selectPart(partId) {
  try {
    const data = await API.getPart(partId);
    state.activePart = data.part;
    state.scenes = data.scenes || [];

    renderPartsBar();
    renderScenesView();
    renderReaderView();
    updateStepper();
  } catch (err) {
    console.error('Error selecting part:', err);
    showToast('Failed to load part scenes', 'error');
  }
}

// Render Project Hero Banner
function renderProjectBanner() {
  const p = state.activeProject;
  if (!p) return;

  const titleEl = document.getElementById('project-title');
  const taglineEl = document.getElementById('project-tagline');
  const synopsisEl = document.getElementById('project-synopsis');
  const genreBadge = document.getElementById('project-genre-badge');
  const styleBadge = document.getElementById('project-style-badge');
  const statusBadge = document.getElementById('project-status-badge');

  if (titleEl) titleEl.textContent = p.title;
  if (taglineEl) taglineEl.textContent = p.tagline || '';
  if (synopsisEl) synopsisEl.textContent = p.synopsis || '';
  if (genreBadge) genreBadge.textContent = p.genre || 'Anime';
  if (styleBadge) styleBadge.textContent = p.art_style || 'Cinematic';
  if (statusBadge) statusBadge.textContent = p.status || 'In Production';

  const coverImg = document.getElementById('project-cover-img');
  if (coverImg) {
    coverImg.src = p.cover_image || '/uploads/projects/neon_chronos_poster.svg';
  }

  // Update stats counters
  const partsCountEl = document.getElementById('stat-parts-count');
  const scenesCountEl = document.getElementById('stat-scenes-count');
  if (partsCountEl) partsCountEl.textContent = state.parts.length;
  const totalScenes = state.parts.reduce((sum, pt) => sum + (parseInt(pt.scene_count, 10) || 0), 0);
  if (scenesCountEl) scenesCountEl.textContent = totalScenes;
}

// ==============================================================================
// STEP 1: ANIME STORIES & PLOTS CONTROLLER
// ==============================================================================

// Render Stories Controls (Header Dropdown, Stories Carousel, Stepper)
function renderStoriesControls() {
  // 1. Header Story Dropdown
  const headerSelect = document.getElementById('header-story-dropdown');
  if (headerSelect) {
    headerSelect.innerHTML = '';
    state.projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.title;
      if (state.activeProject && p.id === state.activeProject.id) {
        opt.selected = true;
      }
      headerSelect.appendChild(opt);
    });
  }

  // 2. Stories Carousel
  const container = document.getElementById('stories-carousel');
  if (container) {
    container.innerHTML = '';
    state.projects.forEach(p => {
      const isSelected = state.activeProject && state.activeProject.id === p.id;
      const card = document.createElement('div');
      card.className = `story-thumb-card ${isSelected ? 'active-story' : ''}`;
      card.onclick = () => selectProject(p.id);

      const coverUrl = p.cover_image || '/uploads/projects/cyberpunk_poster.svg';

      card.innerHTML = `
        <div class="story-thumb-cover-wrap">
          <img src="${coverUrl}" class="story-thumb-cover" alt="${escapeHtml(p.title)}" onerror="this.src='/uploads/projects/neon_chronos_poster.svg'">
          <div class="story-thumb-status-badge">${isSelected ? 'ACTIVE STORY' : (p.status || 'In Production')}</div>
        </div>
        <div class="story-thumb-body">
          <div class="story-thumb-title" title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</div>
          <div class="story-thumb-genre">${escapeHtml(p.genre || 'Anime')}</div>
          <div class="story-thumb-meta">
            <span>${p.total_parts || (isSelected ? state.parts.length : 1)} Parts</span>
            <span style="color: var(--primary); font-weight: 700;">${isSelected ? 'Selected' : 'Switch ➔'}</span>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    // Add "+ Create New Story" Card at the end of the carousel
    const addCard = document.createElement('div');
    addCard.className = 'add-story-card';
    addCard.onclick = () => openCreateStoryModal();
    addCard.innerHTML = `
      <div class="add-story-icon">${ICONS.plus}</div>
      <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">+ Create New Story</div>
      <div style="font-size: 0.75rem; color: var(--text-muted);">Step 1: Start New Anime Plot</div>
    `;
    container.appendChild(addCard);
  }
}

// Update 3-Tier Stepper (Story -> Part -> Scene)
function updateStepper() {
  const s1Name = document.getElementById('stepper-story-name');
  const s2Name = document.getElementById('stepper-part-name');
  const s3Name = document.getElementById('stepper-scene-name');
  const card1 = document.getElementById('stepper-step-1');
  const card2 = document.getElementById('stepper-step-2');
  const card3 = document.getElementById('stepper-step-3');

  if (s1Name) s1Name.textContent = state.activeProject ? state.activeProject.title : 'No Story Selected';
  if (s2Name) {
    if (state.activePart) {
      s2Name.textContent = `Part ${state.activePart.part_number}: ${state.activePart.title}`;
    } else {
      s2Name.textContent = state.parts.length > 0 ? `${state.parts.length} Parts Available` : 'Create Part 1';
    }
  }
  if (s3Name) {
    s3Name.textContent = state.activePart ? `${state.scenes.length} Scenes in Part ${state.activePart.part_number}` : 'Select a Part';
  }

  if (card1) card1.classList.toggle('active', !!state.activeProject);
  if (card2) card2.classList.toggle('active', !!state.activePart);
  if (card3) card3.classList.toggle('active', !!state.activePart && state.scenes.length > 0);
}

// Header Story Dropdown Change Handler
function onHeaderStorySelect(projectId) {
  if (projectId) {
    selectProject(parseInt(projectId, 10));
  }
}

// Smooth scroll helper for workflow steps
function scrollToSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Poster Preset Selector in New Story Modal
function selectPosterPreset(element, posterUrl) {
  document.querySelectorAll('#new-story-preset-grid .poster-preset-item').forEach(el => {
    el.classList.remove('selected');
  });
  if (element) element.classList.add('selected');
  const hiddenInput = document.getElementById('new-story-poster-choice');
  if (hiddenInput) hiddenInput.value = posterUrl;
}

// Open Create Story Modal (Step 1)
function openCreateStoryModal() {
  const form = document.getElementById('new-story-form');
  if (form) form.reset();
  const hiddenInput = document.getElementById('new-story-poster-choice');
  if (hiddenInput) hiddenInput.value = '/assets/logo.jpg';
  const firstPreset = document.querySelector('#new-story-preset-grid .poster-preset-item');
  if (firstPreset) selectPosterPreset(firstPreset, '/assets/logo.jpg');
  openModal('new-story-modal');
}

// Submit New Story
async function submitNewStory() {
  const title = document.getElementById('new-story-title').value;
  const tagline = document.getElementById('new-story-tagline').value;
  const genre = document.getElementById('new-story-genre').value;
  const artStyle = document.getElementById('new-story-art-style').value;
  const synopsis = document.getElementById('new-story-synopsis').value;
  const posterChoice = document.getElementById('new-story-poster-choice').value || '/uploads/projects/cyberpunk_poster.svg';
  const posterFileInput = document.getElementById('new-story-poster-file');

  if (!title || !title.trim()) {
    showToast('Story / Anime Title is required!', 'error');
    return;
  }

  try {
    showToast('Creating Anime Story in PostgreSQL database...', 'info');
    const res = await API.createProject({
      title: title.trim(),
      tagline: tagline ? tagline.trim() : '',
      genre: genre,
      art_style: artStyle,
      synopsis: synopsis ? synopsis.trim() : '',
      cover_image: posterChoice,
      created_by: state.currentUser.display_name
    });

    if (!res.success) {
      throw new Error(res.error || 'Failed to create story');
    }

    const newProject = res.project;

    // Upload custom poster if selected
    if (posterFileInput && posterFileInput.files && posterFileInput.files.length > 0) {
      try {
        await API.uploadProjectPoster(newProject.id, posterFileInput.files[0], state.currentUser.display_name);
      } catch (uploadErr) {
        console.warn('Poster upload warning:', uploadErr);
      }
    }

    // Refresh projects list
    const projData = await API.getProjects();
    state.projects = projData.projects || [];

    closeModal('new-story-modal');
    showToast(`Anime Story "${newProject.title}" created successfully! Part 1 is ready.`, 'success');

    // Automatically select the new project and jump to Parts (Step 2)
    await selectProject(newProject.id);
    scrollToSection('section-step-2-parts');
  } catch (err) {
    console.error('Error creating story:', err);
    showToast('Error creating story: ' + err.message, 'error');
  }
}

// Open Edit Story Modal
function openEditStoryModal() {
  const p = state.activeProject;
  if (!p) return;

  document.getElementById('edit-story-title').value = p.title || '';
  document.getElementById('edit-story-tagline').value = p.tagline || '';
  document.getElementById('edit-story-genre').value = p.genre || '';
  document.getElementById('edit-story-art-style').value = p.art_style || '';
  document.getElementById('edit-story-status').value = p.status || 'In Production';
  document.getElementById('edit-story-synopsis').value = p.synopsis || '';

  openModal('edit-story-modal');
}

// Submit Edit Story
async function submitEditStory() {
  const p = state.activeProject;
  if (!p) return;

  const title = document.getElementById('edit-story-title').value;
  const tagline = document.getElementById('edit-story-tagline').value;
  const genre = document.getElementById('edit-story-genre').value;
  const artStyle = document.getElementById('edit-story-art-style').value;
  const status = document.getElementById('edit-story-status').value;
  const synopsis = document.getElementById('edit-story-synopsis').value;

  if (!title || !title.trim()) {
    showToast('Story Title is required!', 'error');
    return;
  }

  try {
    const res = await API.updateProject(p.id, {
      title: title.trim(),
      tagline,
      genre,
      art_style: artStyle,
      status,
      synopsis
    });

    if (res.success) {
      state.activeProject = res.project;
      const projData = await API.getProjects();
      state.projects = projData.projects || [];
      renderProjectBanner();
      renderStoriesControls();
      updateStepper();
      closeModal('edit-story-modal');
      showToast('Anime Story details updated!', 'success');
    }
  } catch (err) {
    showToast('Error updating story: ' + err.message, 'error');
  }
}

// Open Story Poster Upload Modal
function openStoryPosterUploadModal() {
  if (!state.activeProject) return;
  const fileInput = document.getElementById('story-poster-file-input');
  if (fileInput) fileInput.value = '';
  const previewWrap = document.getElementById('story-poster-preview-wrap');
  if (previewWrap) previewWrap.style.display = 'none';
  openModal('upload-story-poster-modal');
}

// Preview poster file when selected
function handleStoryPosterFileChange(input) {
  if (input && input.files && input.files[0]) {
    const file = input.files[0];
    const previewWrap = document.getElementById('story-poster-preview-wrap');
    const previewImg = document.getElementById('story-poster-preview-img');
    if (previewWrap && previewImg) {
      previewImg.src = URL.createObjectURL(file);
      previewWrap.style.display = 'block';
    }
  }
}

// Submit Story Poster Upload
async function submitStoryPosterUpload() {
  if (!state.activeProject) return;
  const fileInput = document.getElementById('story-poster-file-input');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast('Please select a poster image file first', 'error');
    return;
  }

  try {
    showToast('Uploading Anime Story Poster...', 'info');
    const res = await API.uploadProjectPoster(state.activeProject.id, fileInput.files[0], state.currentUser.display_name);
    if (res.success && res.cover_image) {
      state.activeProject.cover_image = res.cover_image;
      renderProjectBanner();
      renderStoriesControls();
      closeModal('upload-story-poster-modal');
      showToast('Anime Story Poster updated!', 'success');
    }
  } catch (err) {
    showToast('Poster upload failed: ' + err.message, 'error');
  }
}

// Confirm Delete Story
async function confirmDeleteStory() {
  if (!state.activeProject) return;
  const storyTitle = state.activeProject.title;
  if (!confirm(`Are you sure you want to delete "${storyTitle}" and all its parts and scenes?`)) {
    return;
  }

  try {
    await API.deleteProject(state.activeProject.id);
    showToast(`Story "${storyTitle}" deleted`, 'info');
    const projData = await API.getProjects();
    state.projects = projData.projects || [];
    if (state.projects.length > 0) {
      await selectProject(state.projects[0].id);
    } else {
      renderEmptyProjectState();
    }
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

// Render Empty Project State (when 0 stories exist)
function renderEmptyProjectState() {
  state.activeProject = null;
  state.activePart = null;
  state.scenes = [];
  state.parts = [];

  const titleEl = document.getElementById('project-title');
  if (titleEl) titleEl.textContent = 'No Anime Stories Yet';
  const taglineEl = document.getElementById('project-tagline');
  if (taglineEl) taglineEl.textContent = 'Click below to create your first Anime Story / Plot!';
  const synopsisEl = document.getElementById('project-synopsis');
  if (synopsisEl) synopsisEl.textContent = 'Get started by creating your anime story. You will then be able to add Parts and Scenes.';

  renderStoriesControls();
  renderPartsBar();
  renderScenesView();
  updateStepper();
}

// Render Parts Carousel (Part 1, Part 2, Part 3...)
function renderPartsBar() {
  const container = document.getElementById('parts-carousel');
  if (!container) return;
  container.innerHTML = '';

  state.parts.forEach(part => {
    const isSelected = state.activePart && state.activePart.id === part.id;
    const card = document.createElement('div');
    card.className = `part-card ${isSelected ? 'active-part' : ''}`;
    card.onclick = () => selectPart(part.id);

    const coverUrl = part.cover_image || '/uploads/parts/part1_shibuya_cover.svg';

    card.innerHTML = `
      <div class="part-cover-wrap">
        <img src="${coverUrl}" class="part-cover-img" alt="${part.title}" onerror="this.src='/uploads/parts/part1_shibuya_cover.svg'">
        <div class="part-badge-tag">PART ${part.part_number}</div>
      </div>
      <div class="part-card-body">
        <div class="part-card-title">${part.title}</div>
        <div class="part-card-summary">${part.summary || 'No summary specified yet.'}</div>
        <div class="part-card-footer">
          <span>${part.scene_count || 0} Scenes</span>
          <button class="part-upload-btn" onclick="openPartUploadModal(event, ${part.id})">
            ${ICONS.upload} Upload Cover
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  // Add "+ New Part" Card
  const addBtn = document.createElement('div');
  addBtn.className = 'add-part-card';
  addBtn.onclick = () => openModal('new-part-modal');
  addBtn.innerHTML = `
    <div class="add-part-icon">${ICONS.plus}</div>
    <div style="font-weight: 700; font-size: 0.9rem;">Add Next Part</div>
    <div style="font-size: 0.75rem;">Part ${state.parts.length + 1}</div>
  `;
  container.appendChild(addBtn);
}

// Render Scenes Grid (Storyboard View)
function renderScenesView() {
  const container = document.getElementById('scenes-grid');
  const banner = document.getElementById('active-part-banner');
  if (!container) return;

  if (!state.activePart) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
        <h3>No Part Selected</h3>
        <p>Please select or create a Part above to view scenes.</p>
      </div>
    `;
    if (banner) banner.style.display = 'none';
    return;
  }

  // Update active part banner
  if (banner) {
    banner.style.display = 'flex';
    document.getElementById('active-part-num').textContent = `PART ${state.activePart.part_number}`;
    document.getElementById('active-part-heading').textContent = state.activePart.title;
    document.getElementById('active-part-desc').textContent = state.activePart.summary || '';
  }

  container.innerHTML = '';

  if (state.scenes.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 2px dashed var(--border-glass);">
        <div style="color: var(--primary); margin-bottom: 1rem;">${ICONS.film}</div>
        <h3 style="margin-bottom: 0.5rem;">No Scenes in Part ${state.activePart.part_number} Yet</h3>
        <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Start building your anime story scene by scene with visual prompts and pictures.</p>
        <button class="btn btn-primary" onclick="openCreateSceneModal()">
          ${ICONS.plus} Add Scene 1
        </button>
      </div>
    `;
    return;
  }

  state.scenes.forEach(scene => {
    const card = document.createElement('div');
    card.className = 'scene-card';
    const primaryImgUrl = scene.primary_image || '/uploads/scenes/shibuya_rain_establishing.svg';

    card.innerHTML = `
      <div class="scene-visual-wrap">
        <img src="${primaryImgUrl}" class="scene-primary-img" alt="${scene.title}" onclick="openLightbox('${primaryImgUrl}', '${scene.title}')">
        <div class="scene-badge-row">
          <div class="scene-number-tag">SCENE ${scene.scene_number}</div>
          <div class="scene-status-tag">${scene.status || 'In Progress'}</div>
        </div>
        <div class="scene-upload-quick-overlay">
          <button class="quick-action-btn" onclick="openSceneUploadModal(event, ${scene.id})">
            ${ICONS.upload} Upload Picture
          </button>
        </div>
      </div>

      <div class="scene-body">
        <div class="scene-title-row">
          <h3 class="scene-title-text">${scene.title}</h3>
        </div>

        <div class="scene-meta-chips">
          <span class="meta-chip highlight">Location: ${scene.location || 'Location'}</span>
          <span class="meta-chip">Time: ${scene.time_of_day || 'Time'}</span>
          <span class="meta-chip">Mood: ${scene.mood || 'Mood'}</span>
          <span class="meta-chip">Shot: ${scene.camera_angle || 'Camera'}</span>
        </div>

        <!-- AI Visual Prompt Box -->
        <div class="prompt-box-card">
          <div class="prompt-box-header">
            <span class="prompt-label">Visual Generation Prompt</span>
            <button class="copy-prompt-btn" onclick="copyToClipboard('${escapeJs(scene.visual_prompt)}', 'Scene ${scene.scene_number} Prompt')">
              ${ICONS.copy} Copy Prompt
            </button>
          </div>
          <div class="prompt-text-display">${escapeHtml(scene.visual_prompt)}</div>
          ${scene.negative_prompt ? `
            <div class="prompt-negative-text">
              <strong>Negative:</strong> ${escapeHtml(scene.negative_prompt)}
            </div>
          ` : ''}
        </div>

        <!-- Narrative Action -->
        ${scene.narrative_script ? `
          <div class="scene-story-preview">
            ${escapeHtml(scene.narrative_script)}
          </div>
        ` : ''}

        <!-- Script Dialogue -->
        ${scene.dialogue ? `
          <div class="scene-dialogue-preview">
            ${escapeHtml(scene.dialogue)}
          </div>
        ` : ''}

        <div class="scene-footer">
          <span>By: <strong>${scene.created_by || 'Team'}</strong></span>
          <div class="scene-action-buttons">
            <button class="btn-icon" title="Edit Scene Details" onclick="openEditSceneModal(${scene.id})">
              ${ICONS.edit}
            </button>
            <button class="btn-icon danger" title="Delete Scene" onclick="confirmDeleteScene(${scene.id})">
              ${ICONS.trash}
            </button>
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// Render Screenplay Reader View
function renderReaderView() {
  const container = document.getElementById('reader-content');
  if (!container || !state.activePart) return;

  const part = state.activePart;
  let html = `
    <div class="reader-header" style="text-align: center;">
      <img src="/assets/logo.jpg" alt="ANIME PLOT STUDIO Logo" style="width: 68px; height: 68px; border-radius: var(--radius-md); box-shadow: 0 4px 14px rgba(15,23,42,0.3); margin-bottom: 0.85rem; border: 1px solid var(--border-glass); object-fit: cover;">
      <div style="color: var(--accent-cyan); font-weight: 800; letter-spacing: 2px; text-transform: uppercase; font-size: 0.85rem; margin-bottom: 0.5rem;">
        ${state.activeProject ? state.activeProject.title : 'Anime Story'}
      </div>
      <h1 style="font-size: 2.2rem; font-weight: 900; margin-bottom: 0.75rem;">
        PART ${part.part_number}: ${part.title}
      </h1>
      <p style="color: var(--text-muted); font-size: 1rem; max-width: 700px; margin: 0 auto;">
        ${part.summary || ''}
      </p>
    </div>
  `;

  if (state.scenes.length === 0) {
    html += `<div style="text-align: center; color: var(--text-dim); padding: 3rem;">No scenes to read yet.</div>`;
  } else {
    state.scenes.forEach(scene => {
      const imgUrl = scene.primary_image || '/uploads/scenes/shibuya_rain_establishing.svg';
      html += `
        <div class="reader-scene-block">
          <div class="reader-scene-heading">
            SCENE ${scene.scene_number}: ${scene.location.toUpperCase()} - ${scene.time_of_day.toUpperCase()}
          </div>
          <div class="reader-layout-grid">
            <div>
              ${scene.narrative_script ? `
                <div class="reader-action-text">${escapeHtml(scene.narrative_script)}</div>
              ` : ''}

              ${scene.dialogue ? `
                <div class="reader-dialogue-block">${escapeHtml(scene.dialogue)}</div>
              ` : ''}

              <div style="margin-top: 1rem; font-size: 0.8rem; color: var(--accent-cyan);">
                <strong>Mood:</strong> ${scene.mood} • <strong>Angle:</strong> ${scene.camera_angle}
              </div>
            </div>

            <div class="reader-visual-card">
              <img src="${imgUrl}" alt="${scene.title}" onclick="openLightbox('${imgUrl}', '${scene.title}')" style="cursor: pointer;">
              <div class="reader-prompt-caption">
                ${escapeHtml(scene.visual_prompt.slice(0, 140))}...
              </div>
            </div>
          </div>
        </div>
      `;
    });
  }

  container.innerHTML = html;
}

// Render Prompt Studio helper presets
function renderPromptStudio() {
  const container = document.getElementById('presets-list-container');
  if (!container) return;
  container.innerHTML = '';

  state.presets.forEach(p => {
    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.padding = '1.25rem';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '0.65rem';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${p.name}</span>
        <span class="meta-badge badge-style">${p.preview_badge}</span>
      </div>
      <div style="font-size: 0.85rem; color: var(--text-muted);">${p.description}</div>
      <div style="background: var(--bg-subtle); border: 1px solid var(--border-glass); padding: 0.75rem; border-radius: var(--radius-sm); font-family: monospace; font-size: 0.8rem; color: var(--text-main); word-break: break-word;">
        ${p.prompt_snippet}
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
        <button class="btn btn-secondary" onclick="copyToClipboard('${escapeJs(p.prompt_snippet)}', '${p.name}')">
          ${ICONS.copy} Copy Snippet
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

// Render Team Collaborators
function renderTeamView() {
  const container = document.getElementById('team-list-container');
  if (!container) return;
  container.innerHTML = '';

  state.team.forEach(m => {
    const isCurrent = state.currentUser.username === m.username;
    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.padding = '1.25rem';
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'space-between';
    card.style.border = isCurrent ? '2px solid var(--primary)' : '1px solid var(--border-glass)';

    const initials = getInitials(m.display_name);

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div style="width: 44px; height: 44px; border-radius: 50%; background: ${m.avatar_color || '#4f46e5'}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1rem; font-weight: 700;">
          ${initials}
        </div>
        <div>
          <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">
            ${m.display_name} ${isCurrent ? '<span style="color: var(--primary); font-size: 0.75rem; font-weight: 600;">(Active You)</span>' : ''}
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${m.role}</div>
        </div>
      </div>
      <div>
        ${!isCurrent ? `
          <button class="btn btn-secondary" onclick="switchCurrentUser('${m.username}')">
            Switch to This Creator
          </button>
        ` : `
          <span class="meta-badge badge-status">Active Creator</span>
        `}
      </div>
    `;
    container.appendChild(card);
  });
}

// Switch Active Collaborator
function switchCurrentUser(username) {
  const member = state.team.find(t => t.username === username);
  if (member) {
    state.currentUser = member;
    localStorage.setItem('anime_studio_user', JSON.stringify(member));
    updateUserHeaderDisplay();
    showToast(`Switched active collaborator to: ${member.display_name}`, 'success');
    renderTeamView();
  }
}

// Setup Multer Dropzones for Scene and Part Uploads
function initDropzones() {
  // Scene Upload Dropzone
  const sceneDropEl = document.getElementById('scene-dropzone');
  const sceneInputEl = document.getElementById('scene-file-input');
  const scenePrevEl = document.getElementById('scene-preview-grid');
  if (sceneDropEl && sceneInputEl && scenePrevEl) {
    sceneDropzone = setupDropzone(sceneDropEl, sceneInputEl, scenePrevEl);
  }

  // Part Upload Dropzone
  const partDropEl = document.getElementById('part-dropzone');
  const partInputEl = document.getElementById('part-file-input');
  const partPrevEl = document.getElementById('part-preview-grid');
  if (partDropEl && partInputEl && partPrevEl) {
    partDropzone = setupDropzone(partDropEl, partInputEl, partPrevEl);
  }
}

// Open Scene Upload Modal (Picture Uploading Scene-wise)
let targetSceneIdForUpload = null;
function openSceneUploadModal(event, sceneId) {
  if (event) event.stopPropagation();
  targetSceneIdForUpload = sceneId;
  const scene = state.scenes.find(s => s.id === sceneId);
  document.getElementById('upload-scene-modal-title').textContent = 
    `Upload Pictures to Scene ${scene ? scene.scene_number : ''}`;
  if (sceneDropzone) sceneDropzone.clearFiles();
  openModal('upload-scene-modal');
}

// Handle Scene Upload Submit
async function submitSceneUpload() {
  if (!targetSceneIdForUpload || !sceneDropzone) return;
  const files = sceneDropzone.getFiles();
  if (files.length === 0) {
    showToast('Please select or drop at least one picture to upload', 'error');
    return;
  }

  const setPrimary = document.getElementById('scene-upload-set-primary').checked;
  const caption = document.getElementById('scene-upload-caption').value;

  try {
    showToast('Uploading picture(s) to PostgreSQL database...', 'info');
    const res = await API.uploadSceneImages(targetSceneIdForUpload, files, {
      uploaded_by: state.currentUser.display_name,
      caption: caption,
      set_primary: setPrimary
    });

    showToast(res.message || 'Scene pictures uploaded successfully!', 'success');
    closeModal('upload-scene-modal');
    // Refresh part scenes
    await selectPart(state.activePart.id);
  } catch (err) {
    console.error('Upload failed:', err);
    showToast('Upload failed: ' + err.message, 'error');
  }
}

// Open Part Upload Modal (Picture Uploading Part-wise)
let targetPartIdForUpload = null;
function openPartUploadModal(event, partId) {
  if (event) event.stopPropagation();
  targetPartIdForUpload = partId;
  const part = state.parts.find(p => p.id === partId);
  document.getElementById('upload-part-modal-title').textContent = 
    `Upload Cover / Artwork to Part ${part ? part.part_number : ''}`;
  if (partDropzone) partDropzone.clearFiles();
  openModal('upload-part-modal');
}

// Handle Part Upload Submit
async function submitPartUpload() {
  if (!targetPartIdForUpload || !partDropzone) return;
  const files = partDropzone.getFiles();
  if (files.length === 0) {
    showToast('Please select or drop at least one picture to upload', 'error');
    return;
  }

  const setCover = document.getElementById('part-upload-set-cover').checked;
  const caption = document.getElementById('part-upload-caption').value;

  try {
    showToast('Uploading picture to Part...', 'info');
    const res = await API.uploadPartImages(targetPartIdForUpload, files, {
      uploaded_by: state.currentUser.display_name,
      caption: caption,
      set_cover: setCover
    });

    showToast(res.message || 'Part cover uploaded successfully!', 'success');
    closeModal('upload-part-modal');
    // Refresh project parts
    await selectProject(state.activeProject.id);
  } catch (err) {
    console.error('Part upload failed:', err);
    showToast('Part upload failed: ' + err.message, 'error');
  }
}

// Create New Part (Part 1, 2, 3...)
async function submitNewPart() {
  const title = document.getElementById('new-part-title').value;
  const summary = document.getElementById('new-part-summary').value;

  if (!title || !title.trim()) {
    showToast('Part title is required', 'error');
    return;
  }

  try {
    const res = await API.createPart(state.activeProject.id, {
      title: title.trim(),
      summary: summary.trim(),
      created_by: state.currentUser.display_name
    });

    showToast(`Created Part ${res.part.part_number} successfully!`, 'success');
    closeModal('new-part-modal');
    document.getElementById('new-part-form').reset();
    await selectProject(state.activeProject.id);
    await selectPart(res.part.id);
  } catch (err) {
    showToast('Error creating part: ' + err.message, 'error');
  }
}

// Open Create Scene Modal
function openCreateSceneModal() {
  document.getElementById('scene-modal-heading').textContent = `Add Scene to Part ${state.activePart.part_number}`;
  document.getElementById('edit-scene-id').value = '';
  document.getElementById('scene-form').reset();
  openModal('scene-edit-modal');
}

// Open Edit Scene Modal
function openEditSceneModal(sceneId) {
  const scene = state.scenes.find(s => s.id === sceneId);
  if (!scene) return;

  document.getElementById('scene-modal-heading').textContent = `Edit Scene ${scene.scene_number}`;
  document.getElementById('edit-scene-id').value = scene.id;
  document.getElementById('scene-title-input').value = scene.title || '';
  document.getElementById('scene-location-input').value = scene.location || '';
  document.getElementById('scene-time-input').value = scene.time_of_day || '';
  document.getElementById('scene-mood-input').value = scene.mood || '';
  document.getElementById('scene-camera-input').value = scene.camera_angle || '';
  document.getElementById('scene-prompt-input').value = scene.visual_prompt || '';
  document.getElementById('scene-negative-input').value = scene.negative_prompt || '';
  document.getElementById('scene-script-input').value = scene.narrative_script || '';
  document.getElementById('scene-dialogue-input').value = scene.dialogue || '';
  document.getElementById('scene-status-input').value = scene.status || 'In Progress';

  openModal('scene-edit-modal');
}

// Submit Scene Form (Create or Update)
async function submitSceneForm() {
  const sceneId = document.getElementById('edit-scene-id').value;
  const title = document.getElementById('scene-title-input').value;
  const location = document.getElementById('scene-location-input').value;
  const time = document.getElementById('scene-time-input').value;
  const mood = document.getElementById('scene-mood-input').value;
  const camera = document.getElementById('scene-camera-input').value;
  const prompt = document.getElementById('scene-prompt-input').value;
  const negative = document.getElementById('scene-negative-input').value;
  const script = document.getElementById('scene-script-input').value;
  const dialogue = document.getElementById('scene-dialogue-input').value;
  const status = document.getElementById('scene-status-input').value;

  if (!title || !prompt) {
    showToast('Scene title and visual prompt are required!', 'error');
    return;
  }

  const payload = {
    title, location, time_of_day: time, mood, camera_angle: camera,
    visual_prompt: prompt, negative_prompt: negative,
    narrative_script: script, dialogue, status,
    created_by: state.currentUser.display_name
  };

  try {
    if (sceneId) {
      await API.updateScene(sceneId, payload);
      showToast('Scene updated in PostgreSQL!', 'success');
    } else {
      await API.createScene(state.activePart.id, payload);
      showToast('New Scene added to Part!', 'success');
    }

    closeModal('scene-edit-modal');
    await selectPart(state.activePart.id);
  } catch (err) {
    showToast('Failed to save scene: ' + err.message, 'error');
  }
}

// Delete Scene
async function confirmDeleteScene(sceneId) {
  if (!confirm('Are you sure you want to delete this scene and its pictures?')) return;
  try {
    await API.deleteScene(sceneId);
    showToast('Scene deleted', 'info');
    await selectPart(state.activePart.id);
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

// Append Preset to Scene Prompt Input
function appendPresetToScenePrompt(snippet) {
  const input = document.getElementById('scene-prompt-input');
  if (input) {
    if (input.value && !input.value.endsWith(', ')) {
      input.value += ', ';
    }
    input.value += snippet;
    showToast('Added style snippet to prompt!', 'info');
  }
}

// Export Full Screenplay to Markdown
function exportScreenplay() {
  if (!state.activeProject) return;
  window.location.href = `/api/projects/${state.activeProject.id}/export?format=markdown`;
  showToast('Downloading Anime Screenplay (.md)...', 'success');
}

// Add Collaborator Friend
async function submitAddFriend() {
  const name = document.getElementById('friend-name-input').value;
  const role = document.getElementById('friend-role-input').value;
  const color = document.getElementById('friend-color-input')?.value || '#4f46e5';

  if (!name || !name.trim()) {
    showToast('Collaborator name is required', 'error');
    return;
  }

  try {
    const res = await API.addTeamMember({
      display_name: name.trim(),
      role: role.trim() || 'Co-Creator',
      avatar_emoji: '',
      avatar_color: color
    });

    state.team.push(res.member);
    renderTeamView();
    closeModal('add-friend-modal');
    document.getElementById('add-friend-form').reset();
    showToast(`Added team collaborator: ${res.member.display_name}!`, 'success');
  } catch (err) {
    showToast('Failed to add collaborator: ' + err.message, 'error');
  }
}

// Switch App Tabs (Storyboard, Reader, Prompt Studio, Team)
function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  document.querySelectorAll('.mobile-nav-item[data-tab]').forEach(m => {
    m.classList.toggle('active', m.dataset.tab === tabName);
  });

  document.getElementById('view-storyboard').style.display = tabName === 'storyboard' ? 'block' : 'none';
  document.getElementById('view-reader').style.display = tabName === 'reader' ? 'block' : 'none';
  document.getElementById('view-prompts').style.display = tabName === 'prompts' ? 'block' : 'none';
  document.getElementById('view-team').style.display = tabName === 'team' ? 'block' : 'none';

  if (tabName === 'reader') renderReaderView();
  if (tabName === 'prompts') renderPromptStudio();
  if (tabName === 'team') renderTeamView();
}

// Event Listeners setup
function initEventListeners() {
  // Navigation tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Modal close handlers (backdrop click & ESC)
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
      closeLightbox();
    }
  });
}

// Helpers
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJs(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// ==============================================================================
// PROGRESSIVE WEB APP (PWA) & MOBILE ACTIONS CONTROLLER
// ==============================================================================

let deferredPwaPrompt = null;

function initPWA() {
  // 1. Register Service Worker with cache & offline support
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          console.log('[PWA] Service Worker registered successfully! Scope:', reg.scope);
          // Check for periodic updates
          if (reg.waiting) {
            console.log('[PWA] New service worker waiting to activate.');
          }
        })
        .catch(err => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
  }

  // 2. Check standalone display mode (already installed & running full screen)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true ||
                       document.referrer.includes('android-app://');

  if (isStandalone) {
    console.log('[PWA] Running as installed standalone PWA app');
    const banner = document.getElementById('pwa-mobile-banner');
    if (banner) banner.style.display = 'none';
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) installBtn.style.display = 'none';
    return;
  }

  // 3. Capture beforeinstallprompt event for custom install triggers
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    console.log('[PWA] beforeinstallprompt event captured');

    // Show desktop header install button
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) installBtn.style.display = 'inline-flex';

    // Show mobile top banner if not previously dismissed in this session
    const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
    if (!dismissed && window.innerWidth <= 768) {
      const banner = document.getElementById('pwa-mobile-banner');
      if (banner) banner.style.display = 'flex';
    }
  });

  // 4. Handle appinstalled event
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] Anime Plot Studio was installed to device');
    deferredPwaPrompt = null;
    const banner = document.getElementById('pwa-mobile-banner');
    if (banner) banner.style.display = 'none';
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) installBtn.style.display = 'none';
    showToast('Anime Plot Studio installed! Launch it anytime from your home screen.', 'success');
  });
}

// Prompt user to install PWA
async function installPWA() {
  if (deferredPwaPrompt) {
    try {
      deferredPwaPrompt.prompt();
      const choiceResult = await deferredPwaPrompt.userChoice;
      console.log('[PWA] User choice:', choiceResult.outcome);
      if (choiceResult.outcome === 'accepted') {
        showToast('Installing Anime Plot Studio...', 'success');
      }
      deferredPwaPrompt = null;
    } catch (err) {
      console.error('[PWA] Install error:', err);
    }
  } else {
    // Helpful guidance for iOS Safari or Chrome when deferredPrompt is not available
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      showToast('To install on iPhone/iPad: Tap Share (⎋) at bottom, then choose "Add to Home Screen" ➕', 'info');
    } else {
      showToast('To install: Open browser menu (⋮) and tap "Install app" or "Add to Home screen"', 'info');
    }
  }
}

// Dismiss PWA banner for current session
function dismissPWABanner() {
  const banner = document.getElementById('pwa-mobile-banner');
  if (banner) banner.style.display = 'none';
  sessionStorage.setItem('pwa_banner_dismissed', 'true');
}

// Open Mobile Quick Action Bottom Sheet
function openMobileActionSheet() {
  openModal('mobile-action-sheet');
}

