/* Ecom Workflow System V1 - API Client */

const API_BASE = '/api';

async function apiRequest(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(`${API_BASE}${path}`, opts);
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || `Request failed (${resp.status})`);
  }
  return data;
}

const api = {

  // Dashboard
  getDashboard() {
    return apiRequest('GET', '/dashboard');
  },

  // Batches
  createBatch(body) {
    return apiRequest('POST', '/batches', body);
  },

  listBatches(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiRequest('GET', `/batches${qs ? '?' + qs : ''}`);
  },

  getBatch(id) {
    return apiRequest('GET', `/batches/${id}`);
  },

  updateBatch(id, body) {
    return apiRequest('PUT', `/batches/${id}`, body);
  },

  deleteBatch(id) {
    return apiRequest('DELETE', `/batches/${id}`);
  },

  // Jobs
  listJobs(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiRequest('GET', `/jobs${qs ? '?' + qs : ''}`);
  },

  getJob(id) {
    return apiRequest('GET', `/jobs/${id}`);
  },

  // Upload
  async uploadFile(file, category = 'reference') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    const resp = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'Upload failed');
    }
    return data;
  },
};

/* ─── UI Helpers ──────────────────────────────────────────────────────────── */

function createToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3000);
}

function getStatusBadge(status) {
  const labels = {
    pending: 'Pending',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
    planning: 'Planning',
    main_image: 'Main Image',
    detail_image: 'Detail Image',
    sku_image: 'SKU Image',
    exporting: 'Exporting',
    uploading: 'Uploading',
  };
  const label = labels[status] || status;
  return `<span class="badge badge-${status}">${label}</span>`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function navigate(url) {
  window.location.href = url;
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}
