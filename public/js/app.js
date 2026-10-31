// ==============================================================================
// ANIME-PLOT STUDIO - APPLICATION CONTROLLER
// ==============================================================================

const state = {
  activeProject: null,
  activePart: null,
  activeScene: null,
  activeTab: 'landing',
  isLoggedIn: false,
  currentUser: {
    username: 'mewo',
    display_name: 'Mewo',
    role: 'Founder & Main Director',
    avatar_color: '#db2777'
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
  checkAuthSession();
  initEventListeners();
  initDropzones();
  initPWA();
  await loadInitialData();

  // If visitor is not logged in, always show public landing showcase
  if (!state.isLoggedIn) {
    switchTab('landing');
  } else {
    // If logged in, check URL hash or stay on storyboard/landing
    const hash = window.location.hash.replace('#', '');
    if (['landing', 'storyboard', 'reader', 'prompts', 'team'].includes(hash)) {
      switchTab(hash);
    } else {
      switchTab('storyboard');
    }
  }
});

// Check persistent authentication session (localStorage / sessionStorage)
function checkAuthSession() {
  const saved = localStorage.getItem('anime_plot_auth') || sessionStorage.getItem('anime_plot_auth');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.user) {
        state.isLoggedIn = true;
        state.currentUser = parsed.user;
      }
    } catch (e) {
      console.warn('Failed to parse saved auth session:', e);
    }
  }
  if (!state.currentUser) {
    const legacyUser = localStorage.getItem('anime_studio_user');
    if (legacyUser) {
      try {
        state.currentUser = JSON.parse(legacyUser);
      } catch (e) {}
    }
  }
  if (!state.currentUser) {
    state.currentUser = {
      id: 1,
      username: 'sahil',
      display_name: 'Sahil',
      role: 'Visual Producer & AI Artist',
      avatar_color: '#4f46e5',
      avatar_emoji: '🎨'
    };
  }
  state.isLoggedIn = true;
  updateAuthUI();
}

function updateAuthUI() {
  const loginBtn = document.getElementById('header-login-btn');
  const userPill = document.getElementById('header-user-pill');
  const logoutBtn = document.getElementById('header-logout-btn');
  const storySelector = document.getElementById('header-story-selector-wrap');
  const createStoryBtn = document.getElementById('header-create-story-btn');
  const landingCtaText = document.getElementById('landing-main-cta-text');

  if (state.isLoggedIn && state.currentUser) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userPill) userPill.style.display = 'flex';
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    if (storySelector) storySelector.style.display = 'flex';
    if (createStoryBtn) createStoryBtn.style.display = 'inline-flex';
    if (landingCtaText) landingCtaText.textContent = `Enter Studio Workspace (${state.currentUser.display_name})`;
    updateUserHeaderDisplay();
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (userPill) userPill.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (storySelector) storySelector.style.display = 'none';
    if (createStoryBtn) createStoryBtn.style.display = 'none';
    if (landingCtaText) landingCtaText.textContent = 'Enter Studio Workspace (Creator Login)';
  }
}

function updateUserHeaderDisplay() {
  if (!state.currentUser) return;
  const nameEl = document.getElementById('current-user-name');
  const roleEl = document.getElementById('current-user-role');
  const avatarEl = document.getElementById('current-user-avatar');
  if (nameEl) nameEl.textContent = state.currentUser.display_name;
  if (roleEl) roleEl.textContent = state.currentUser.role;
  if (avatarEl) {
    avatarEl.textContent = getInitials(state.currentUser.display_name);
    avatarEl.style.backgroundColor = state.currentUser.avatar_color || '#db2777';
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

    // Render landing showcase with all stories
    renderLandingShowcase();

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

  // Update Publish to Landing button
  const pubLabel = document.getElementById('btn-toggle-publish-label');
  const pubBtn = document.getElementById('btn-toggle-publish-story');
  if (pubLabel && pubBtn) {
    const isPub = p.is_published !== false;
    pubLabel.textContent = isPub ? 'Published on Landing ✓' : 'Publish to Landing';
    if (isPub) {
      pubBtn.style.borderColor = '#10b981';
      pubBtn.style.color = '#10b981';
    } else {
      pubBtn.style.borderColor = '';
      pubBtn.style.color = '';
    }
  }
}

// Toggle current active story publication on Landing page
async function toggleCurrentStoryPublish() {
  if (!state.activeProject) return;
  const currentStatus = state.activeProject.is_published !== false;
  const nextStatus = !currentStatus;

  try {
    showToast(nextStatus ? 'Publishing story to Landing page...' : 'Hiding story from Landing page...', 'info');
    await API.togglePublishProject(state.activeProject.id, nextStatus);
    state.activeProject.is_published = nextStatus;

    // Update in state.projects list
    const pIndex = state.projects.findIndex(p => p.id === state.activeProject.id);
    if (pIndex !== -1) {
      state.projects[pIndex].is_published = nextStatus;
    }

    renderProjectBanner();
    renderLandingShowcase();
    showToast(nextStatus ? 'Story is now LIVE on Landing Showcase!' : 'Story hidden from Landing page', 'success');
  } catch (err) {
    showToast('Failed to update publication: ' + err.message, 'error');
  }
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
    const hasArt = scene.primary_image && !scene.primary_image.includes('shibuya_rain_establishing.svg');
    const isVideo = primaryImgUrl && /\.(mp4|webm|mov)$/i.test(primaryImgUrl);
    const promptToCopy = scene.visual_prompt || scene.narrative_script || '';

    card.innerHTML = `
      <div class="scene-visual-wrap">
        ${isVideo ? `
          <video controls src="${primaryImgUrl}" class="scene-primary-video" playsinline style="width: 100%; height: 220px; object-fit: contain; background: #000; border-radius: 12px; display: block;"></video>
        ` : `
          <img src="${primaryImgUrl}" class="scene-primary-img" alt="${escapeHtml(scene.title)}" onclick="openLightbox('${primaryImgUrl}', '${escapeJs(scene.title)}')">
        `}
        <div class="scene-badge-row">
          <div class="scene-number-tag">SCENE ${scene.scene_number}</div>
          ${isVideo ? '<div class="scene-status-tag" style="background: rgba(16, 185, 129, 0.95); color: #fff;">🎬 Video Ready</div>' : (hasArt ? '<div class="scene-status-tag" style="background: rgba(16, 185, 129, 0.95); color: #fff;">✨ Art Ready</div>' : '<div class="scene-status-tag" style="background: rgba(245, 158, 11, 0.95); color: #fff;">⏳ Awaiting Art</div>')}
        </div>
        <div class="scene-upload-quick-overlay">
          <button class="quick-action-btn" onclick="openSceneUploadModal(event, ${scene.id})">
            ${ICONS.upload} ${isVideo ? 'Change Video' : (hasArt ? 'Change Art' : 'Upload Art')}
          </button>
        </div>
      </div>

      <div class="scene-body">
        <!-- Producer & Creator Action Strip: Copy Prompt, Upload Art/Video, Add Dialogue -->
        <div class="scene-manager-bar" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="btn-copy-prompt-glow" onclick="copyScenePromptForBunny('${escapeJs(promptToCopy)}', ${scene.scene_number})" title="1-Tap Copy Prompt for Midjourney / Sora / Kling">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            <span>Copy AI Prompt</span>
          </button>
          <button class="btn-upload-art-direct" onclick="openSceneUploadModal(event, ${scene.id})" title="Upload generated picture or video clip">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            <span>Upload Pic / Video</span>
          </button>
          ${hasArt && !isVideo ? `
            <button class="btn-dialog-art-direct" onclick="openDialogueStudio(${scene.id}, '${primaryImgUrl}', '${escapeJs(scene.title)}', '${escapeJs(scene.dialogue || '')}')" title="Add Dialogue / Subtitles on this Image and Download" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; font-weight: 700; border-radius: 10px; padding: 0.5rem 0.85rem; font-size: 0.82rem; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>💬 Add Dialogue &amp; Download</span>
            </button>
          ` : ''}
        </div>

        <div class="scene-title-row">
          <h3 class="scene-title-text">${escapeHtml(scene.title)}</h3>
        </div>

        <div class="scene-meta-chips">
          <span class="meta-chip highlight">Location: ${escapeHtml(scene.location || 'Neo-Tokyo')}</span>
          <span class="meta-chip">Time: ${escapeHtml(scene.time_of_day || 'Day')}</span>
          <span class="meta-chip">Mood: ${escapeHtml(scene.mood || 'Cinematic')}</span>
          <span class="meta-chip">Shot: ${escapeHtml(scene.camera_angle || 'Medium Shot')}</span>
        </div>

        <!-- AI Visual Prompt Box -->
        <div class="prompt-box-card">
          <div class="prompt-box-header">
            <span class="prompt-label">AI Visual Prompt (Midjourney / Sora / Kling)</span>
            <button class="copy-prompt-btn" onclick="copyScenePromptForBunny('${escapeJs(promptToCopy)}', ${scene.scene_number})">
              ${ICONS.copy} Copy Prompt
            </button>
          </div>
          <div class="prompt-text-display">${escapeHtml(promptToCopy)}</div>
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
            <strong>Dialogue:</strong> ${escapeHtml(scene.dialogue)}
          </div>
        ` : ''}

        <div class="scene-footer">
          <span>By: <strong>${escapeHtml(scene.created_by || 'Story Writer')}</strong></span>
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

// 1-Tap Copy Scene Prompt for Bunny (AI Art Producer)
function copyScenePromptForBunny(promptText, sceneNum) {
  copyToClipboard(promptText, `Scene ${sceneNum} Prompt`);
  showToast(`Scene ${sceneNum} Prompt copied! Ready for Midjourney / Sora / Kling.`, 'success');
}
const copyScenePromptForSahil = copyScenePromptForBunny;

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
  let member = state.team ? state.team.find(t => t.username.toLowerCase() === username.toLowerCase()) : null;
  if (!member && (username === 'jiya' || username === 'mewo')) {
    member = { id: 4, username: 'jiya', display_name: 'Jiya', role: 'Story Writer & Creator', avatar_color: '#db2777', avatar_emoji: '👑' };
  } else if (!member && (username === 'sahil' || username === 'bunny')) {
    member = { id: 1, username: 'sahil', display_name: 'Sahil', role: 'Visual Producer & AI Artist', avatar_color: '#4f46e5', avatar_emoji: '🎨' };
  }
  if (member) {
    state.currentUser = member;
    state.isLoggedIn = true;
    localStorage.setItem('anime_studio_user', JSON.stringify(member));
    localStorage.setItem('anime_plot_auth', JSON.stringify({ user: member, logged_in_at: new Date().toISOString() }));
    updateAuthUI();
    updateUserHeaderDisplay();
    const btnJiya = document.getElementById('cqs-btn-jiya');
    const btnSahil = document.getElementById('cqs-btn-sahil');
    if (btnJiya) btnJiya.classList.toggle('active', member.username === 'jiya' || member.username === 'mewo');
    if (btnSahil) btnSahil.classList.toggle('active', member.username === 'sahil' || member.username === 'bunny');
    showToast(`Active Creator: ${member.display_name} (${member.role})`, 'success');
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

// ==============================================================================
// STEP 3: SIMPLE SCENE CREATION & EDITING (DIRECTOR MEWO & MANAGER BUNNY)
// ==============================================================================

// Open Create Scene Modal (Single Text Box for Director Mewo)
function openCreateSceneModal() {
  if (!state.activePart) {
    showToast('Please select or create a Part first', 'info');
    return;
  }
  const partNum = state.activePart ? state.activePart.part_number : 1;
  const nextSceneNum = state.scenes ? state.scenes.length + 1 : 1;

  const heading = document.getElementById('scene-modal-heading');
  if (heading) heading.textContent = `Add Scene ${nextSceneNum} to Part ${partNum}`;

  const editIdInp = document.getElementById('edit-scene-id');
  if (editIdInp) editIdInp.value = '';

  const unifiedInp = document.getElementById('scene-unified-input');
  if (unifiedInp) unifiedInp.value = '';

  openModal('scene-edit-modal');
}

// Open Edit Scene Modal
function openEditSceneModal(sceneId) {
  const scene = state.scenes.find(s => s.id === sceneId);
  if (!scene) return;

  const heading = document.getElementById('scene-modal-heading');
  if (heading) heading.textContent = `Edit Scene ${scene.scene_number}`;

  const editIdInp = document.getElementById('edit-scene-id');
  if (editIdInp) editIdInp.value = scene.id;

  const unifiedInp = document.getElementById('scene-unified-input');
  if (unifiedInp) {
    let combined = '';
    if (scene.narrative_script) combined += scene.narrative_script + '\n\n';
    if (scene.visual_prompt && !combined.includes(scene.visual_prompt)) {
      combined += 'Prompt: ' + scene.visual_prompt;
    }
    unifiedInp.value = combined.trim() || scene.visual_prompt || '';
  }

  openModal('scene-edit-modal');
}

// Submit Scene Form (Pure Single Textbox for Director Mewo)
async function submitSceneForm() {
  const sceneId = document.getElementById('edit-scene-id')?.value || '';
  const unified = document.getElementById('scene-unified-input')?.value?.trim() || '';

  if (!unified) {
    showToast('Please paste your scene description and prompts first!', 'error');
    return;
  }

  // Parse prompt and description from unified input
  let prompt = unified;
  let script = unified;
  let title = '';

  // Check if there is an explicit "Prompt: ..."
  const promptMatch = unified.match(/(?:prompt|visual\s*prompt|midjourney|sd)[:\-]\s*([^\n\r]+(?:[\n\r]+[^\n\r]+)*)/i);
  if (promptMatch && promptMatch[1]) {
    prompt = promptMatch[1].trim();
    const splitIndex = unified.toLowerCase().indexOf(promptMatch[0].toLowerCase());
    if (splitIndex > 0) {
      script = unified.substring(0, splitIndex).trim();
    }
  }

  // Detect title from first line if short
  const lines = unified.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 0 && lines[0].length < 60 && !/^(prompt|visual)/i.test(lines[0])) {
    title = lines[0].replace(/^(scene\s*\d*[:\-]?\s*)/i, 'Scene: ');
  }

  const nextSceneNum = state.scenes ? state.scenes.length + 1 : 1;
  if (!title) {
    title = `Scene ${nextSceneNum}: Visual Beat`;
  }

  const payload = {
    title: title,
    location: 'Neo-Tokyo Shibuya',
    time_of_day: 'Midnight Rain',
    mood: 'Cinematic Anime Action',
    camera_angle: 'Medium Shot',
    visual_prompt: prompt,
    negative_prompt: 'low quality, blurry, deformed hands, extra limbs, bad anatomy',
    narrative_script: script,
    dialogue: '',
    status: 'Prompt Ready',
    created_by: state.currentUser ? state.currentUser.display_name : 'Director Mewo'
  };

  try {
    if (sceneId) {
      await API.updateScene(sceneId, payload);
      showToast('Scene updated in studio!', 'success');
    } else {
      await API.createScene(state.activePart.id, payload);
      showToast('New Scene added! Ready for Bunny to copy prompt & generate art.', 'success');
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

// Switch App Tabs (Landing, Storyboard, Reader, Prompt Studio, Team)
function switchTab(tabName) {
  state.isLoggedIn = true;
  if (!state.currentUser) {
    state.currentUser = {
      id: 1,
      username: 'sahil',
      display_name: 'Sahil',
      role: 'Visual Producer & AI Artist',
      avatar_color: '#4f46e5',
      avatar_emoji: '🎨'
    };
  }
  updateAuthUI();

  state.activeTab = tabName;
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  document.querySelectorAll('.mobile-nav-item[data-tab]').forEach(m => {
    m.classList.toggle('active', m.dataset.tab === tabName);
  });

  const vLanding = document.getElementById('view-landing');
  const vStoryboard = document.getElementById('view-storyboard');
  const vReader = document.getElementById('view-reader');
  const vPrompts = document.getElementById('view-prompts');
  const vTeam = document.getElementById('view-team');

  if (vLanding) vLanding.style.display = tabName === 'landing' ? 'block' : 'none';
  if (vStoryboard) vStoryboard.style.display = tabName === 'storyboard' ? 'block' : 'none';
  if (vReader) vReader.style.display = tabName === 'reader' ? 'block' : 'none';
  if (vPrompts) vPrompts.style.display = tabName === 'prompts' ? 'block' : 'none';
  if (vTeam) vTeam.style.display = tabName === 'team' ? 'block' : 'none';

  if (tabName === 'landing') renderLandingShowcase();
  if (tabName === 'storyboard') {
    renderPartsBar();
    renderScenesView();
    updateStepper();
  }
  if (tabName === 'reader') renderReaderView();
  if (tabName === 'prompts') renderPromptStudio();
  if (tabName === 'team') renderTeamView();
}

// ==============================================================================
// AUTHENTICATION & LANDING SHOWCASE CONTROLLER (MEWO & BUNNY)
// ==============================================================================

// Select login profile in modal (Mewo or Bunny)
function selectLoginProfile(username) {
  const chipMewo = document.getElementById('chip-mewo');
  const chipBunny = document.getElementById('chip-bunny');
  const userInp = document.getElementById('login-username');
  const passInp = document.getElementById('login-password');

  if (username === 'mewo' || username === 'jiya') {
    if (chipMewo) chipMewo.classList.add('selected');
    if (chipBunny) chipBunny.classList.remove('selected');
    if (userInp) userInp.value = 'mewo';
  } else {
    if (chipBunny) chipBunny.classList.add('selected');
    if (chipMewo) chipMewo.classList.remove('selected');
    if (userInp) userInp.value = 'bunny';
  }
  // User explicitly asked: "in login page dont use pree filed pasword and username ok"
  // So DO NOT fill password! Clear it and focus password input so user can type it.
  if (passInp) {
    passInp.value = '';
    passInp.focus();
  }
}

// Submit login form with credentials (username: mewo/bunny, password: 44113290)
async function submitLogin() {
  const userInp = document.getElementById('login-username');
  const passInp = document.getElementById('login-password');
  const rememberInp = document.getElementById('login-remember');
  const submitBtn = document.getElementById('login-submit-btn');

  const username = userInp ? userInp.value.trim().toLowerCase() : '';
  const password = passInp ? passInp.value.trim() : '';

  if (!username || !password) {
    showToast('Please enter both username and password', 'error');
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying Credentials...';
    }

    const res = await API.login(username, password);

    if (res.success && res.user) {
      state.isLoggedIn = true;
      state.currentUser = res.user;

      const authData = JSON.stringify({
        token: res.token,
        user: res.user,
        logged_in_at: new Date().toISOString()
      });

      if (rememberInp && rememberInp.checked) {
        localStorage.setItem('anime_plot_auth', authData);
      } else {
        sessionStorage.setItem('anime_plot_auth', authData);
      }

      updateAuthUI();
      closeModal('login-modal');
      showToast(`Welcome, ${res.user.display_name}! (${res.user.role})`, 'success');
      switchTab('storyboard');
    } else {
      showToast(res.error || 'Invalid credentials', 'error');
    }
  } catch (err) {
    console.error('Login error:', err);
    showToast(err.message || 'Login failed. Please check credentials.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Login & Enter Studio';
    }
  }
}

// Creator logout
function logoutUser() {
  localStorage.removeItem('anime_plot_auth');
  sessionStorage.removeItem('anime_plot_auth');
  state.isLoggedIn = false;
  updateAuthUI();
  switchTab('landing');
  showToast('Logged out from Creator account', 'info');
}

// Handler for Landing Page Main CTA button
function handleEnterStudioOrLogin() {
  if (state.isLoggedIn) {
    switchTab('storyboard');
  } else {
    openModal('login-modal');
  }
}

// Render Public Landing Page Anime Stories Showcase
function renderLandingShowcase() {
  const container = document.getElementById('landing-stories-grid');
  if (!container) return;

  if (!state.projects || state.projects.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1.5rem; background: var(--bg-card); border-radius: 20px; border: 2px dashed var(--border-glass);">
        <div style="font-size: 2.8rem; margin-bottom: 0.75rem;">🎬</div>
        <h3 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 0.5rem;">No Published Anime Stories Yet</h3>
        <p style="color: var(--text-muted); max-width: 520px; margin: 0 auto 1.5rem auto;">
          Director Mewo &amp; Manager Bunny can create the first anime story and publish it here for readers.
        </p>
        <button class="btn btn-primary" onclick="handleEnterStudioOrLogin()">
          + Create First Anime Story
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  state.projects.forEach(project => {
    const isPub = project.is_published !== false;
    // Non-logged-in visitors see only published stories (or all if not filtered)
    if (!state.isLoggedIn && !isPub) return;

    const card = document.createElement('div');
    card.className = 'showcase-card';

    const poster = project.cover_image || '/assets/logo.jpg';

    card.innerHTML = `
      <div class="showcase-cover-wrap">
        <img src="${poster}" class="showcase-cover-img" alt="${escapeHtml(project.title)}" loading="lazy" onclick="openLightbox('${poster}', '${escapeJs(project.title)}')">
        <div class="showcase-badge-row">
          <span class="showcase-genre-chip">${escapeHtml(project.genre || 'Action / Anime')}</span>
          ${isPub ? '<span class="showcase-pub-badge">Published</span>' : '<span class="showcase-pub-badge" style="background: rgba(245, 158, 11, 0.85);">Draft</span>'}
        </div>
      </div>

      <div class="showcase-content">
        <div class="showcase-title-row">
          <div>
            <h3 class="showcase-title">${escapeHtml(project.title)}</h3>
            ${project.tagline ? `<div class="showcase-tagline">"${escapeHtml(project.tagline)}"</div>` : ''}
          </div>
        </div>

        <p class="showcase-synopsis">
          ${escapeHtml(project.synopsis || 'An exciting original anime story created at Anime Plot Studio.')}
        </p>

        <div class="showcase-stats-row">
          <span class="showcase-stat-item">
            <strong>${project.total_parts || 1}</strong> Parts
          </span>
          <span class="showcase-stat-item">
            <strong>${project.total_scenes || 0}</strong> Scenes
          </span>
          <span class="showcase-stat-item">
            <strong>${project.total_images || 0}</strong> Visuals
          </span>
        </div>

        <div class="showcase-actions-row">
          <button class="btn btn-primary btn-sm showcase-read-btn" onclick="openReaderForProject(${project.id})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <span>Read Screenplay</span>
          </button>
          <button class="btn btn-secondary btn-sm showcase-studio-btn" onclick="openStudioForProject(${project.id})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="20" x="2" y="2" rx="2.18" ry="2.18"/><path d="M7 2v20"/><path d="M17 2v20"/><path d="M2 12h20"/></svg>
            <span>Open in Studio</span>
          </button>
          ${state.isLoggedIn ? `
            <button class="btn btn-secondary btn-sm" onclick="togglePublishProjectStatus(${project.id}, ${!isPub})" title="${isPub ? 'Hide from Landing' : 'Publish on Landing'}" style="padding: 0.4rem 0.65rem; font-size: 0.75rem;">
              ${isPub ? 'Hide from Landing' : 'Show on Landing'}
            </button>
          ` : ''}
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  // If all projects were drafts and none visible to guest
  if (container.children.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
        <p>No stories published to showcase yet. Creators can log in to publish stories.</p>
      </div>
    `;
  }
}

// 1-Click: Open Screenplay Reader directly for a project from Landing
async function openReaderForProject(projectId) {
  await selectProject(projectId);
  switchTab('reader');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 1-Click: Open Story in Studio Workspace from Landing
async function openStudioForProject(projectId) {
  await selectProject(projectId);
  switchTab('storyboard');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Toggle project published status on landing page
async function togglePublishProjectStatus(projectId, newStatus) {
  try {
    await API.togglePublishProject(projectId, newStatus);
    showToast(newStatus ? 'Story published to Landing Showcase!' : 'Story hidden from Landing page', 'info');
    const projData = await API.getProjects();
    state.projects = projData.projects || [];
    renderLandingShowcase();
    if (state.activeProject && state.activeProject.id === projectId) {
      state.activeProject.is_published = newStatus;
      renderProjectBanner();
    }
  } catch (err) {
    showToast('Failed to update story status: ' + err.message, 'error');
  }
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


// ==============================================================================
// DIALOGUE & CAPTION STUDIO CONTROLLER
// ==============================================================================
let dialogueStudio = {
  sceneId: null,
  imageUrl: '',
  sceneTitle: '',
  style: 'anime-yellow',
  position: 'bottom',
  fontSize: 32,
  charName: '',
  text: '',
  img: null,
  customX: null,
  customY: null,
  isDragging: false
};

function openDialogueStudio(sceneId, imageUrl, sceneTitle, defaultDialogue) {
  dialogueStudio.sceneId = sceneId;
  dialogueStudio.imageUrl = imageUrl;
  dialogueStudio.sceneTitle = sceneTitle;
  dialogueStudio.customX = null;
  dialogueStudio.customY = null;
  dialogueStudio.position = 'bottom';
  dialogueStudio.style = 'anime-yellow';
  dialogueStudio.fontSize = 32;

  let char = '';
  let txt = defaultDialogue || '';
  const colonMatch = txt.match(/^([A-Za-z0-9_\s]{2,20})[:\-]\s*(.*)$/s);
  if (colonMatch) {
    char = colonMatch[1].trim();
    txt = colonMatch[2].trim();
  } else if (!char) {
    char = state.currentUser ? state.currentUser.display_name.toUpperCase() : 'MEWO';
  }

  dialogueStudio.charName = char;
  dialogueStudio.text = txt || 'I will never give up on this story!';

  const nameInput = document.getElementById('dialogue-char-name');
  const textInput = document.getElementById('dialogue-text-input');
  const fontSlider = document.getElementById('dialogue-font-size-slider');
  const fontVal = document.getElementById('dialogue-font-size-val');

  if (nameInput) nameInput.value = dialogueStudio.charName;
  if (textInput) textInput.value = dialogueStudio.text;
  if (fontSlider) fontSlider.value = dialogueStudio.fontSize;
  if (fontVal) fontVal.textContent = `${dialogueStudio.fontSize}px`;

  updateDialogueStyleButtons();
  updateDialoguePosButtons();

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    dialogueStudio.img = img;
    const resBadge = document.getElementById('canvas-resolution-badge');
    if (resBadge) resBadge.textContent = `${img.naturalWidth || img.width} x ${img.naturalHeight || img.height}`;
    renderDialogueCanvas();
  };
  img.onerror = () => {
    img.removeAttribute('crossorigin');
    img.src = imageUrl;
  };
  img.src = imageUrl;

  openModal('dialogue-studio-modal');
  initDialogueCanvasDrag();
}

function setDialogueStyle(styleName) {
  dialogueStudio.style = styleName;
  updateDialogueStyleButtons();
  renderDialogueCanvas();
}

function updateDialogueStyleButtons() {
  document.querySelectorAll('#dialogue-style-buttons button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.style === dialogueStudio.style);
  });
}

function setDialoguePosition(pos) {
  dialogueStudio.position = pos;
  dialogueStudio.customX = null;
  dialogueStudio.customY = null;
  updateDialoguePosButtons();
  renderDialogueCanvas();
}

function updateDialoguePosButtons() {
  ['bottom', 'center', 'top'].forEach(p => {
    const el = document.getElementById(`pos-btn-${p}`);
    if (el) el.classList.toggle('active', dialogueStudio.position === p && dialogueStudio.customX === null);
  });
}

function onFontSizeSliderChange(val) {
  dialogueStudio.fontSize = parseInt(val, 10);
  const fontVal = document.getElementById('dialogue-font-size-val');
  if (fontVal) fontVal.textContent = `${val}px`;
  renderDialogueCanvas();
}

function renderDialogueCanvas() {
  const canvas = document.getElementById('dialogue-canvas');
  if (!canvas || !dialogueStudio.img) return;

  const nameInput = document.getElementById('dialogue-char-name');
  const textInput = document.getElementById('dialogue-text-input');
  if (nameInput) dialogueStudio.charName = nameInput.value.trim();
  if (textInput) dialogueStudio.text = textInput.value.trim();

  const img = dialogueStudio.img;
  const cw = img.naturalWidth || img.width || 1280;
  const ch = img.naturalHeight || img.height || 720;
  canvas.width = cw;
  canvas.height = ch;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0, cw, ch);

  if (!dialogueStudio.text && !dialogueStudio.charName) return;

  const scale = Math.max(0.6, cw / 1280);
  const baseFs = dialogueStudio.fontSize * scale;
  const charFs = Math.max(14, baseFs * 0.75);

  ctx.save();

  function wrapLines(text, maxW, font) {
    ctx.font = font;
    const words = text.split(/\s+/);
    const lines = [];
    let curLine = words[0] || '';
    for (let i = 1; i < words.length; i++) {
      const w = words[i];
      const testLine = curLine + ' ' + w;
      if (ctx.measureText(testLine).width < maxW) {
        curLine = testLine;
      } else {
        lines.push(curLine);
        curLine = w;
      }
    }
    if (curLine) lines.push(curLine);
    return lines;
  }

  function drawRoundRect(x, y, w, h, r, fillStyle, strokeStyle, lineWidth) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (strokeStyle && lineWidth) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  const maxTextWidth = cw * 0.78;
  const textFont = `bold ${baseFs}px 'Noto Sans', 'Segoe UI', -apple-system, sans-serif`;
  const nameFont = `900 ${charFs}px 'Noto Sans', 'Segoe UI', -apple-system, sans-serif`;

  const lines = wrapLines(dialogueStudio.text || '', maxTextWidth, textFont);
  const lineHeight = baseFs * 1.35;
  const textBlockHeight = lines.length * lineHeight;

  let targetY;
  if (dialogueStudio.customY !== null) {
    targetY = dialogueStudio.customY;
  } else if (dialogueStudio.position === 'top') {
    targetY = ch * 0.15;
  } else if (dialogueStudio.position === 'center') {
    targetY = ch * 0.5 - textBlockHeight / 2;
  } else {
    targetY = ch * 0.82 - textBlockHeight;
  }

  let targetX = dialogueStudio.customX !== null ? dialogueStudio.customX : cw / 2;
  const style = dialogueStudio.style;

  if (style === 'manga-bubble') {
    ctx.font = textFont;
    let maxLw = 0;
    lines.forEach(l => {
      const w = ctx.measureText(l).width;
      if (w > maxLw) maxLw = w;
    });

    const padX = baseFs * 1.2;
    const padY = baseFs * 0.9;
    const bubbleW = Math.max(cw * 0.35, maxLw + padX * 2);
    const bubbleH = textBlockHeight + padY * 2 + (dialogueStudio.charName ? charFs * 1.4 : 0);
    const bubbleX = targetX - bubbleW / 2;
    const bubbleY = targetY;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12 * scale;
    drawRoundRect(bubbleX, bubbleY, bubbleW, bubbleH, 20 * scale, '#ffffff', '#111827', 4 * scale);
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.moveTo(bubbleX + bubbleW * 0.3, bubbleY + bubbleH);
    ctx.lineTo(bubbleX + bubbleW * 0.25, bubbleY + bubbleH + 22 * scale);
    ctx.lineTo(bubbleX + bubbleW * 0.4, bubbleY + bubbleH);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 4 * scale;
    ctx.strokeStyle = '#111827';
    ctx.stroke();

    let curY = bubbleY + padY + baseFs * 0.85;

    if (dialogueStudio.charName) {
      ctx.font = nameFont;
      ctx.fillStyle = '#db2777';
      ctx.textAlign = 'left';
      ctx.fillText(dialogueStudio.charName.toUpperCase(), bubbleX + padX, curY);
      curY += charFs * 1.35;
    }

    ctx.font = textFont;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left';
    lines.forEach(line => {
      ctx.fillText(line, bubbleX + padX, curY);
      curY += lineHeight;
    });

  } else if (style === 'cinematic-box') {
    const barH = textBlockHeight + 65 * scale;
    const barY = ch - barH;
    
    const grad = ctx.createLinearGradient(0, barY, 0, ch);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.0)');
    grad.addColorStop(0.25, 'rgba(15, 23, 42, 0.85)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, barY, cw, barH);

    ctx.fillStyle = '#db2777';
    ctx.fillRect(0, barY + barH * 0.2, 8 * scale, barH * 0.6);

    let startX = 40 * scale;
    let textY = barY + 35 * scale;

    if (dialogueStudio.charName) {
      ctx.font = nameFont;
      const nw = ctx.measureText(dialogueStudio.charName).width + 24 * scale;
      drawRoundRect(startX, textY, nw, charFs * 1.6, 6 * scale, '#db2777');
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(dialogueStudio.charName.toUpperCase(), startX + nw / 2, textY + charFs * 1.15);
      textY += charFs * 1.8;
    }

    ctx.font = textFont;
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    lines.forEach(line => {
      ctx.fillText(line, startX, textY + baseFs * 0.85);
      textY += lineHeight;
    });

  } else {
    let textColor = '#fff200';
    let outlineColor = '#000000';
    let glowColor = null;

    if (style === 'anime-white') {
      textColor = '#ffffff';
    } else if (style === 'neon-cyan') {
      textColor = '#00ffff';
      glowColor = '#00ffff';
    }

    ctx.font = textFont;
    let maxLw = 0;
    lines.forEach(l => {
      const w = ctx.measureText(l).width;
      if (w > maxLw) maxLw = w;
    });

    if (dialogueStudio.charName) {
      ctx.font = nameFont;
      const nw = ctx.measureText(dialogueStudio.charName + ': ').width;
      if (nw > maxLw) maxLw = nw;
    }

    const padX = baseFs * 1.1;
    const padY = baseFs * 0.65;
    const boxW = Math.min(cw * 0.92, maxLw + padX * 2);
    const boxH = textBlockHeight + padY * 2 + (dialogueStudio.charName ? charFs * 1.3 : 0);
    const boxX = targetX - boxW / 2;
    const boxY = targetY;

    drawRoundRect(boxX, boxY, boxW, boxH, 14 * scale, 'rgba(0, 0, 0, 0.65)', 'rgba(255, 255, 255, 0.12)', 1.5 * scale);

    let curY = boxY + padY + (dialogueStudio.charName ? charFs * 0.9 : baseFs * 0.85);

    if (dialogueStudio.charName) {
      ctx.font = nameFont;
      ctx.fillStyle = '#f472b6';
      ctx.textAlign = 'center';
      ctx.fillText(dialogueStudio.charName.toUpperCase(), targetX, curY);
      curY += charFs * 1.35;
    }

    ctx.font = textFont;
    ctx.textAlign = 'center';
    const strokeW = Math.max(3, baseFs * 0.12);

    lines.forEach(line => {
      ctx.lineWidth = strokeW;
      ctx.strokeStyle = outlineColor;
      ctx.strokeText(line, targetX, curY);

      if (glowColor) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 10 * scale;
      }
      ctx.fillStyle = textColor;
      ctx.fillText(line, targetX, curY);
      ctx.shadowBlur = 0;

      curY += lineHeight;
    });
  }

  ctx.restore();
}

function downloadDialogueImage() {
  const canvas = document.getElementById('dialogue-canvas');
  if (!canvas) return;

  try {
    const sceneNum = dialogueStudio.sceneId || 'frame';
    canvas.toBlob(blob => {
      if (!blob) {
        showToast('Could not export canvas to image', 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scene_${sceneNum}_anime_dialogue.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Downloaded dialogue image successfully!', 'success');
    }, 'image/png');
  } catch (err) {
    console.error('Download error:', err);
    showToast('Download error: ' + err.message, 'error');
  }
}

async function saveDialogueImageToScene() {
  const canvas = document.getElementById('dialogue-canvas');
  if (!canvas || !dialogueStudio.sceneId) return;

  try {
    showToast('Saving dialogue frame to Scene...', 'info');
    const dataUrl = canvas.toDataURL('image/png');
    const uploader = state.currentUser ? state.currentUser.display_name : 'Sahil';
    const caption = dialogueStudio.text ? `Dialogue: ${dialogueStudio.text.slice(0, 50)}...` : 'Visual Dialogue Frame';

    const res = await API.saveSceneDialogImage(dialogueStudio.sceneId, dataUrl, caption, uploader);

    if (res.success) {
      showToast('Dialogue frame saved to scene successfully!', 'success');
      closeModal('dialogue-studio-modal');
      if (state.activePart) {
        await selectPart(state.activePart.id);
      }
    } else {
      showToast(res.error || 'Failed to save dialogue frame', 'error');
    }
  } catch (err) {
    console.error('Save to scene failed:', err);
    showToast('Failed to save dialogue frame: ' + err.message, 'error');
  }
}

function initDialogueCanvasDrag() {
  const canvas = document.getElementById('dialogue-canvas');
  if (!canvas || canvas._dragInited) return;
  canvas._dragInited = true;

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function onStart(e) {
    dialogueStudio.isDragging = true;
    const pt = getCanvasCoords(e);
    dialogueStudio.customX = pt.x;
    dialogueStudio.customY = pt.y;
    renderDialogueCanvas();
  }

  function onMove(e) {
    if (!dialogueStudio.isDragging) return;
    e.preventDefault();
    const pt = getCanvasCoords(e);
    dialogueStudio.customX = pt.x;
    dialogueStudio.customY = pt.y;
    renderDialogueCanvas();
  }

  function onEnd() {
    dialogueStudio.isDragging = false;
  }

  canvas.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);

  canvas.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
}
