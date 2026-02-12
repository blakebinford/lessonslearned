/**
 * API client for the Lessons Learned backend.
 * All requests include the auth token and are proxied through Django.
 */

const BASE = '/api';

function getHeaders() {
  const token = localStorage.getItem('ll_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Token ${token}`;
  return headers;
}

function fileHeaders() {
  const token = localStorage.getItem('ll_token');
  const headers = {};
  if (token) headers['Authorization'] = `Token ${token}`;
  return headers;
}

async function handleResponse(resp) {
  if (resp.status === 401) {
    localStorage.removeItem('ll_token');
    localStorage.removeItem('ll_user');
    localStorage.setItem('ll_session_expired', '1');
    window.location.reload();
    throw new Error('Session expired');
  }
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || data.detail || 'Request failed');
  return data;
}

// ── Auth ──
export async function login(username, password) {
  const resp = await fetch(`${BASE}/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(resp);
}

export async function register(username, password, email) {
  const resp = await fetch(`${BASE}/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, email }),
  });
  return handleResponse(resp);
}

// ── Organizations ──
export async function getOrganizations() {
  const resp = await fetch(`${BASE}/organizations/`, { headers: getHeaders() });
  return handleResponse(resp);
}

export async function updateOrganization(id, data) {
  const resp = await fetch(`${BASE}/organizations/${id}/`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(resp);
}

// ── Lessons ──
export async function getLessons(orgId, params = {}) {
  const query = new URLSearchParams({ org: orgId, ...params });
  const resp = await fetch(`${BASE}/lessons/?${query}`, { headers: getHeaders() });
  return handleResponse(resp);
}

export async function createLesson(data) {
  const resp = await fetch(`${BASE}/lessons/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(resp);
}

export async function updateLesson(id, data) {
  const resp = await fetch(`${BASE}/lessons/${id}/`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(resp);
}

export async function deleteLesson(id) {
  const resp = await fetch(`${BASE}/lessons/${id}/`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (resp.status === 401) {
    localStorage.removeItem('ll_token');
    localStorage.removeItem('ll_user');
    localStorage.setItem('ll_session_expired', '1');
    window.location.reload();
  }
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || 'Delete failed');
  }
  return true;
}

export async function importLessons(orgId, file) {
  const form = new FormData();
  form.append('file', file);
  form.append('organization', orgId);
  const resp = await fetch(`${BASE}/lessons/import_file/`, {
    method: 'POST',
    headers: fileHeaders(),
    body: form,
  });
  return handleResponse(resp);
}

// ── SOW Analysis ──
export async function uploadSOWFile(file) {
  const form = new FormData();
  form.append('file', file);
  const resp = await fetch(`${BASE}/sow/upload/`, {
    method: 'POST',
    headers: fileHeaders(),
    body: form,
  });
  return handleResponse(resp);
}

export async function analyzeSOW(orgId, sowText, workType, filename) {
  const resp = await fetch(`${BASE}/sow/analyze/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      organization: orgId,
      sow_text: sowText,
      work_type: workType,
      filename: filename,
    }),
  });
  return handleResponse(resp);
}

// ── AI Chat ──
export async function chatWithAnalyst(orgId, message, history) {
  const resp = await fetch(`${BASE}/chat/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      organization: orgId,
      message,
      history,
    }),
  });
  return handleResponse(resp);
}
