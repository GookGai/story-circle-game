const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error || data?.message || `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  async get(path) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  async post(path, body) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async put(path, body) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  async delete(path) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};
