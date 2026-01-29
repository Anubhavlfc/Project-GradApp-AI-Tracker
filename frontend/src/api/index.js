/**
 * API Service for GradTrack AI
 * 
 * This module handles all communication with the backend API.
 * The UI sends requests here, and this module handles the HTTP calls.
 */

import axios from 'axios';

// Base API URL - uses environment variable in production, proxy in development
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout for AI responses
});

// ============================================
// Chat API
// ============================================

/**
 * Send a message to the AI agent
 * @param {string} message - User's message
 * @param {string} sessionId - Session identifier
 * @returns {Promise<{response: string, tools_used: string[], reasoning_steps: object[]}>}
 */
export async function sendChatMessage(message, sessionId = 'default') {
  const response = await api.post('/chat', {
    message,
    session_id: sessionId,
  });
  return response.data;
}

// ============================================
// Applications API
// ============================================

/**
 * Get all applications
 * @returns {Promise<{applications: object[]}>}
 */
export async function getApplications() {
  const response = await api.get('/applications');
  return response.data;
}

/**
 * Get a single application by ID
 * @param {number} appId - Application ID
 * @returns {Promise<object>}
 */
export async function getApplication(appId) {
  const response = await api.get(`/applications/${appId}`);
  return response.data;
}

/**
 * Create a new application
 * @param {object} application - Application data
 * @returns {Promise<{id: number, message: string}>}
 */
export async function createApplication(application) {
  const response = await api.post('/applications', application);
  return response.data;
}

/**
 * Update an existing application
 * @param {number} appId - Application ID
 * @param {object} updates - Fields to update
 * @returns {Promise<{message: string}>}
 */
export async function updateApplication(appId, updates) {
  const response = await api.put(`/applications/${appId}`, updates);
  return response.data;
}

/**
 * Delete an application
 * @param {number} appId - Application ID
 * @returns {Promise<{message: string}>}
 */
export async function deleteApplication(appId) {
  const response = await api.delete(`/applications/${appId}`);
  return response.data;
}

/**
 * Update application status (for drag and drop)
 * @param {number} appId - Application ID
 * @param {string} status - New status
 * @returns {Promise<{message: string}>}
 */
export async function updateApplicationStatus(appId, status) {
  const response = await api.put(`/applications/${appId}/status?status=${status}`);
  return response.data;
}

// ============================================
// Profile API
// ============================================

/**
 * Get user profile
 * @returns {Promise<object>}
 */
export async function getProfile() {
  const response = await api.get('/profile');
  return response.data;
}

/**
 * Update user profile
 * @param {object} profile - Profile data
 * @returns {Promise<{message: string}>}
 */
export async function updateProfile(profile) {
  const response = await api.put('/profile', profile);
  return response.data;
}

// ============================================
// Memory API (for debugging/transparency)
// ============================================

/**
 * Search memory for relevant context
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<{results: object[]}>}
 */
export async function searchMemory(query, limit = 5) {
  const response = await api.get('/memory/search', {
    params: { query, limit }
  });
  return response.data;
}

/**
 * Get recent conversations
 * @param {number} limit - Max results
 * @returns {Promise<{conversations: object[]}>}
 */
export async function getRecentConversations(limit = 10) {
  const response = await api.get('/memory/conversations', {
    params: { limit }
  });
  return response.data;
}

// ============================================
// Health Check
// ============================================

/**
 * Check API health
 * @returns {Promise<{status: string, timestamp: string}>}
 */
export async function checkHealth() {
  const response = await api.get('/health');
  return response.data;
}

// Export the api instance for custom requests
export default api;
