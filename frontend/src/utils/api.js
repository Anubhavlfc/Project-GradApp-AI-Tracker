const API_BASE = '/api'

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }

  const response = await fetch(url, config)

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || `HTTP error ${response.status}`)
  }

  return response.json()
}

export const api = {
  // Applications
  getApplications: (status = null) => {
    const params = status ? `?status=${status}` : ''
    return fetchAPI(`/applications${params}`)
  },

  getApplication: (id) => fetchAPI(`/applications/${id}`),

  createApplication: (data) =>
    fetchAPI('/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateApplication: (id, data) =>
    fetchAPI(`/applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteApplication: (id) =>
    fetchAPI(`/applications/${id}`, {
      method: 'DELETE',
    }),

  getApplicationStats: () => fetchAPI('/applications/stats/summary'),

  // Tasks
  getTasks: (params = {}) => {
    const searchParams = new URLSearchParams()
    if (params.status) searchParams.append('status', params.status)
    if (params.application_id) searchParams.append('application_id', params.application_id)
    const query = searchParams.toString()
    return fetchAPI(`/tasks${query ? `?${query}` : ''}`)
  },

  getUpcomingTasks: (days = 7) => fetchAPI(`/tasks/upcoming?days=${days}`),

  getTask: (id) => fetchAPI(`/tasks/${id}`),

  createTask: (data) =>
    fetchAPI('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTask: (id, data) =>
    fetchAPI(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  completeTask: (id) =>
    fetchAPI(`/tasks/${id}/complete`, {
      method: 'PUT',
    }),

  deleteTask: (id) =>
    fetchAPI(`/tasks/${id}`, {
      method: 'DELETE',
    }),

  getTaskStats: () => fetchAPI('/tasks/stats/summary'),

  // Profile
  getProfile: () => fetchAPI('/profile'),

  updateProfile: (data) =>
    fetchAPI('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Essays
  saveEssay: (data) =>
    fetchAPI('/essays', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getEssay: (applicationId, essayType = 'sop') =>
    fetchAPI(`/essays/${applicationId}?essay_type=${essayType}`),

  // Interviews
  saveInterview: (data) =>
    fetchAPI('/interviews', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getInterviews: (applicationId) => fetchAPI(`/interviews/${applicationId}`),

  // Chat
  sendChatMessage: (message) =>
    fetchAPI('/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  resetChat: () =>
    fetchAPI('/chat/reset', {
      method: 'POST',
    }),

  // Memory
  getMemoryStats: () => fetchAPI('/memory/stats'),

  searchMemory: (query, n = 5) =>
    fetchAPI(`/memory/search?query=${encodeURIComponent(query)}&n_results=${n}`),
}

export default api
