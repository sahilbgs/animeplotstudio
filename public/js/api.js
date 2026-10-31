// ==============================================================================
// ANIME-PLOT STUDIO - API CLIENT
// ==============================================================================

const API = {
  // Base request wrapper
  async request(endpoint, options = {}) {
    const url = `/api${endpoint}`;
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // Health
  async getHealth() {
    return this.request('/health');
  },

  // Projects
  async getProjects() {
    return this.request('/projects');
  },

  async getProject(id) {
    return this.request(`/projects/${id}`);
  },

  async createProject(projectData) {
    return this.request('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData)
    });
  },

  async updateProject(id, projectData) {
    return this.request(`/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData)
    });
  },

  async deleteProject(id) {
    return this.request(`/projects/${id}`, { method: 'DELETE' });
  },

  async uploadProjectPoster(projectId, file, uploadedBy = 'Team') {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('uploaded_by', uploadedBy);
    const res = await fetch(`/api/upload/project/${projectId}`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to upload story poster');
    return data;
  },

  // Parts
  async getParts(projectId) {
    return this.request(`/parts/project/${projectId}`);
  },

  async getPart(id) {
    return this.request(`/parts/${id}`);
  },

  async createPart(projectId, partData) {
    return this.request(`/parts/project/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partData)
    });
  },

  async updatePart(id, partData) {
    return this.request(`/parts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partData)
    });
  },

  async deletePart(id) {
    return this.request(`/parts/${id}`, { method: 'DELETE' });
  },

  // Scenes
  async getScenes(partId) {
    return this.request(`/scenes/part/${partId}`);
  },

  async getScene(id) {
    return this.request(`/scenes/${id}`);
  },

  async createScene(partId, sceneData) {
    return this.request(`/scenes/part/${partId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sceneData)
    });
  },

  async updateScene(id, sceneData) {
    return this.request(`/scenes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sceneData)
    });
  },

  async deleteScene(id) {
    return this.request(`/scenes/${id}`, { method: 'DELETE' });
  },

  // Picture / Image Uploads (Part-wise & Scene-wise)
  async uploadSceneImages(sceneId, files, options = {}) {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }
    if (options.uploaded_by) formData.append('uploaded_by', options.uploaded_by);
    if (options.caption) formData.append('caption', options.caption);
    if (options.set_primary) formData.append('set_primary', 'true');

    const res = await fetch(`/api/upload/scene/${sceneId}`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  },

  async uploadPartImages(partId, files, options = {}) {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }
    if (options.uploaded_by) formData.append('uploaded_by', options.uploaded_by);
    if (options.caption) formData.append('caption', options.caption);
    if (options.set_cover) formData.append('set_cover', 'true');

    const res = await fetch(`/api/upload/part/${partId}`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  },

  async setKeyframe(mediaId) {
    return this.request(`/upload/media/${mediaId}/set-keyframe`, { method: 'PUT' });
  },

  async deleteMedia(mediaId) {
    return this.request(`/upload/media/${mediaId}`, { method: 'DELETE' });
  },

  // Team collaborators
  async getTeam() {
    return this.request('/team');
  },

  async addTeamMember(memberData) {
    return this.request('/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memberData)
    });
  },

  // Characters
  async getCharacters(projectId) {
    return this.request(`/characters/project/${projectId}`);
  },

  async createCharacter(projectId, charData) {
    return this.request(`/characters/project/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(charData)
    });
  },

  async deleteCharacter(id) {
    return this.request(`/characters/${id}`, { method: 'DELETE' });
  },

  // Comments / Collaboration feedback
  async getSceneComments(sceneId) {
    return this.request(`/comments/scene/${sceneId}`);
  },

  async addSceneComment(sceneId, commentData) {
    return this.request(`/comments/scene/${sceneId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(commentData)
    });
  },

  // Prompt Presets
  async getPromptPresets() {
    return this.request('/prompt-presets');
  },

  // Auth & Creators (Mewo Founder & Bunny Manager)
  async login(username, password) {
    return this.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  },

  async getCreators() {
    return this.request('/auth/creators');
  },

  async togglePublishProject(projectId, isPublished) {
    return this.updateProject(projectId, { is_published: isPublished });
  }
};

