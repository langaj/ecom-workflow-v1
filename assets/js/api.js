/* Ecom Workflow System V1 - API Client */

const API_BASE = 'https://ess.langaj.work/api';

// --- JWT Auth ---
const TOKEN_KEY = 'ecom_token';

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }


async function apiRequest(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  const token = getToken();
  if (token) {
    opts.headers['Authorization'] = 'Bearer ' + token;
  }
  if (body) {
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(`${API_BASE}${path}`, opts);
  if (resp.status === 401) {
    clearToken();
    showLogin();
    throw new Error('Session expired, please login again');
  }
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
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const resp = await fetch(`${API_BASE}/upload`, { method: 'POST', headers, body: formData });
    const data = await resp.json();
    if (!resp.ok) {

      throw new Error(data.error || 'Upload failed');
    }
    return data;
  },

  // Config
  getConfig() {
    return apiRequest('GET', '/config');
  },
  updateConfig(items) {
    return apiRequest('PUT', '/config', { items });
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


// --- Login ---
async function login() {
  const pwd = document.getElementById('login-password')?.value;
  if (!pwd) return;
  try {
    const resp = await fetch(API_BASE + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      const errEl = document.getElementById('login-error');
      if (errEl) { errEl.textContent = data.error || 'Login failed'; errEl.style.display = 'block'; }
      return;
    }
    setToken(data.token);
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.remove();
    createToast('登录成功');
    // Reload page so API data loads fresh
    location.reload();
  } catch (err) {
    const errEl = document.getElementById('login-error');
    if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
}

function showLogin() {
  if (document.getElementById('login-overlay')) return;
  const div = document.createElement('div');
  div.id = 'login-overlay';
  div.innerHTML = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;">' +
    '<div style="background:#fff;padding:40px;border-radius:8px;width:360px;box-shadow:0 8px 32px rgba(0,0,0,0.2);text-align:center;">' +
    '<h2 style="margin-bottom:8px;">Ecom Workflow</h2>' +
    '<p style="color:#6b7280;margin-bottom:24px;font-size:0.9rem;">请输入访问密码</p>' +
    '<input id="login-password" type="password" placeholder="密码" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:0.9rem;margin-bottom:16px;box-sizing:border-box;" onkeydown="if(event.key===\'Enter\')login()">' +
    '<div id="login-error" style="color:#dc2626;font-size:0.85rem;margin-bottom:12px;display:none;"></div>' +
    '<button onclick="login()" style="width:100%;padding:10px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:0.9rem;cursor:pointer;">登录</button>' +
    '</div></div>';
  document.body.appendChild(div);
  setTimeout(function() { var el = document.getElementById('login-password'); if (el) el.focus(); }, 100);
}

// Auto-show login if no token
(function() {
  if (!getToken()) { showLogin(); }
})();

/* --- SSE Events --- */
function connectEvents(batchId, onEvent, onError) {
  const es = new EventSource(API_BASE.replace('/api','') + '/api/events?batch_id=' + batchId);
  es.addEventListener('job_update', e => { try { onEvent('job_update', JSON.parse(e.data)); } catch {} });
  es.addEventListener('batch_update', e => { try { onEvent('batch_update', JSON.parse(e.data)); } catch {} });
  es.addEventListener('phase_error', e => { try { onEvent('phase_error', JSON.parse(e.data)); } catch {} });
  es.onerror = () => { if (onError) onError(); };
  return es;
}
