const API_BASE = '/api';

/**
 * Perform an HTTP request to the backend API.
 * Automatically attaches JWT auth token if available.
 * @param {string} path - The sub-path of the API (e.g. '/auth/me')
 * @param {string} method - HTTP Verb (GET, POST, PUT, DELETE, PATCH)
 * @param {object|null} body - Object payload to serialize as JSON
 * @returns {Promise<any>} The parsed JSON response
 */
export async function apiRequest(path, method = 'GET', body = null) {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, config);
  
  // Parse response body safely
  let data;
  try {
    data = await response.json();
  } catch (err) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}
