/* Ecom Workflow System V1 - Task Detail Page */

let batchData = null;

document.addEventListener('DOMContentLoaded', async () => {
  const id = getQueryParam('id');
  if (!id) {
    document.getElementById('detail-content').innerHTML = '<div class="empty-state"><p>Missing task ID</p></div>';
    return;
  }

  await loadDetail(id);
});

async function loadDetail(id) {
  const content = document.getElementById('detail-content');
  content.innerHTML = '<div class="loading"><div class="spinner"></div> 加载中..</div>';

  try {
    batchData = await api.getBatch(id);
    content.innerHTML = '';

    renderBasicInfo(batchData);
    renderProductInfo(batchData);
    renderTitleInfo(batchData);
    renderReferences(batchData);
    renderAttachments(batchData);
    renderVariantSpecInfo(batchData);
    renderSKUList(batchData);
    renderGeneratedImages(batchData);
    renderExcel(batchData);
    renderJobs(batchData);

    // Set page title
    document.title = `${batchData.batch_no} - ${batchData.task_name}`;
    document.querySelector('.topbar-title').textContent = `${batchData.batch_no} - ${batchData.task_name}`;

  } catch (err) {
    content.innerHTML = `<div class="empty-state"><p>加载Failed: ${err.message}</p></div>`;
    createToast('加载详情Failed: ' + err.message, 'error');
  }
}

function renderBasicInfo(data) {
  const section = createSection('Basic Info');
  section.innerHTML = `
    <div class="detail-grid">
      <div class="detail-field">
        <span class="detail-field-label">批次</span>
        <span class="detail-field-value">${data.batch_no}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">状态</span>
        <span class="detail-field-value">${getStatusBadge(data.status)}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">任务名称</span>
        <span class="detail-field-value">${data.task_name}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">平台</span>
        <span class="detail-field-value">${data.platform || '-'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">市场</span>
        <span class="detail-field-value">${data.market || '-'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">语言</span>
        <span class="detail-field-value">${data.language || '-'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">工作流模式</s/span>
        <span class="detail-field-value">${data.workflow_mode || '-'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">Created时间</span>
        <span class="detail-field-value">${formatDateTime(data.created_at)}</span>
      </div>
      <div class="detail-field" style="grid-column: 1 / -1;">
        <span class="detail-field-label">需求描述</s/span>
        <span class="detail-field-value">${data.requirement || '-'}</span>
      </div>
    </div>
  `;
}

function renderProductInfo(data) {
  const product = data.product_json || {};
  if (!product.productName && !product.brand) return;

  const section = createSection('Product Info');
  section.innerHTML = `
    <div class="detail-grid">
      <div class="detail-field">
        <span class="detail-field-label">商品名称</span>
        <span class="detail-field-value">${product.productName || '-'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">品牌</span>
        <span class="detail-field-value">${product.brand || '-'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">品类</span>
        <span class="detail-field-value">${product.category || '-'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">目标受众</span>
        <span class="detail-field-value">${product.targetAudience || '-'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">价格区间</span>
        <span class="detail-field-value">${product.priceRange || '-'}</span>
      </div>
    </div>
  `;
}

function renderTitleInfo(data) {
  const title = data.title_json || {};
  // title_json: { product_title: "...", sku_titles: { "B240612-001": "...", ... } }
  if (!title.product_title && !title.sku_titles) return;
  const section = createSection('Generated Titles');
  let html = '';
  if (title.product_title) {
    html += '<div class="detail-field" style="margin-bottom:12px">' +
      '<span class="detail-field-label">Product Title</span>' +
      '<span class="detail-field-value">' + esc(title.product_title) + '</span></div>';
  }
  if (title.sku_titles) {
    const skuEntries = Object.entries(title.sku_titles);
    if (skuEntries.length > 0) {
      html += '<h4 style="margin:8px 0;font-size:0.85rem;color:var(--gray-600);">SKU Titles</h4>';
      html += '<div style="display:grid;gap:6px">';
      for (const [jobNo, skuTitle] of skuEntries) {
        html += '<div class="detail-field"><span class="detail-field-label">' + esc(jobNo) + '</span>' +
          '<span class="detail-field-value">' + esc(skuTitle) + '</span></div>';
      }
      html += '</div>';
    }
  }
  section.innerHTML = html;
}

function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function renderReferences(data) {
  const section = createSection('Reference Images');
  const product = data.product_json || {};
  const images = (product.referenceImages || []).filter(i => i.url);
  if (images.length === 0) {
    section.innerHTML = '<div style="color:var(--gray-400);font-size:0.85rem;">无Reference Images</div>';
    return;
  }
  section.innerHTML = `<div class="image-grid">${images.map(img => `
    <div class="image-grid-item">
      <img src="${img.url}" alt="${img.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22><rect fill=%22%23f3f4f6%22 width=%22100%25%22 height=%22100%25%22/></svg>'">
      <div class="image-label">${img.name}</div>
    </div>
  `).join('')}</div>`;
}

function renderAttachments(data) {
  const section = createSection('Attachments');
  const product = data.product_json || {};
  const images = (product.attachments || []).filter(i => i.url);
  if (images.length === 0) {
    section.innerHTML = '<div style="color:var(--gray-400);font-size:0.85rem;">无附件素材</s/div>';
    return;
  }
  section.innerHTML = `<div class="image-grid">${images.map(img => `
    <div class="image-grid-item">
      <img src="${img.url}" alt="${img.name}">
      <div class="image-label">${img.name}</div>
    </div>
  `).join('')}</div>`;
}

function renderVariantSpecInfo(data) {
  const variants = data.variant_json || [];
  const specs = data.spec_json || [];
  if (variants.length === 0 && specs.length === 0) return;

  const section = createSection('Variant & Spec Config');
  let html = '';

  if (variants.length > 0) {
    html += '<h4 style="margin:8px 0;font-size:0.85rem;color:var(--gray-600);">Variants</h4>';
    html += `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">`;
    html += variants.map(v => `<span class="sku-tag">${v.name}</span>`).join('');
    html += '</div>';
  }

  if (specs.length > 0) {
    html += '<h4 style="margin:8px 0;font-size:0.85rem;color:var(--gray-600);">Specs</h4>';
    html += specs.map(s => `
      <div style="margin-bottom:4px;">
        <strong style="font-size:0.85rem;">${s.name}:</strong>
        ${(s.values || []).map(v => `<span class="sku-tag" style="margin-left:4px;">${v}</span>`).join('')}
      </div>
    `).join('');
  }

  section.innerHTML = html;
}

function renderSKUList(data) {
  const skus = data.sku_json || [];
  if (skus.length === 0) return;

  const section = createSection('SKU List');
  section.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${skus.map(s => `<span class="sku-tag">${s.name || JSON.stringify(s)}</span>`).join('')}
    </div>
    <div style="margin-top:8px;font-size:0.85rem;color:var(--gray-500);">?${skus.length} ?SKU</div>
  `;
}

function renderGeneratedImages(data) {
  const result = data.result_json || {};
  const mainImages = result.mainImages || [];
  const detailImages = result.detailImages || [];
  const skuImages = result.skuImages || [];

  if (mainImages.length === 0 && detailImages.length === 0 && skuImages.length === 0) {
    // Check jobs for images
    const jobs = data.jobs || [];
    const allImages = jobs.flatMap(j => {
      const r = j.result_json || {};
      return (r.images || []);
    });
    if (allImages.length === 0) return;
  }

  const section = createSection('Generated Images');
  let html = '';

  if (mainImages.length > 0) {
    html += '<h4 style="margin:8px 0;font-size:0.85rem;color:var(--gray-600);">Main Image</h4>';
    html += `<div class="image-grid">${mainImages.map(url => `
      <div class="image-grid-item"><img src="${url}" alt="Main Image"></div>
    `).join('')}</div>`;
  }

  if (detailImages.length > 0) {
    html += '<h4 style="margin:12px 0 8px;font-size:0.85rem;color:var(--gray-600);">详情图</s/h4>';
    html += `<div class="image-grid">${detailImages.map(url => `
      <div class="image-grid-item"><img src="${url}" alt="详情图</s></div>
    `).join('')}</div>`;
  }

  if (skuImages.length > 0) {
    html += '<h4 style="margin:12px 0 8px;font-size:0.85rem;color:var(--gray-600);">SKU ?/h4>';
    html += `<div class="image-grid">${skuImages.map(url => `
      <div class="image-grid-item"><img src="${url}" alt="SKU?></div>
    `).join('')}</div>`;
  }

  section.innerHTML = html;
}

function renderExcel(data) {
  const result = data.result_json || {};
  const excelUrl = result.excelUrl;
  if (!excelUrl) return;

  const section = createSection('Excel');
  section.innerHTML = `<a href="${excelUrl}" target="_blank" class="btn btn-primary btn-sm">Download Excel</a>`;
}

function renderJobs(data) {
  // Add workflow control buttons
  addWorkflowControls(data);

  const jobs = data.jobs || [];
  if (jobs.length === 0) return;

  const section = createSection('Job Log');

  const jobStatusOrder = ['planning', 'main_image', 'detail_image', 'sku_image', 'exporting', 'uploading', 'completed', 'failed'];

  let html = '';
  jobs.forEach(job => {
    const progress = job.progress || 0;
    const stepIndex = jobStatusOrder.indexOf(job.status);

    html += `
      <div class="card" style="padding:16px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <strong>${job.job_no}</strong>
          ${getStatusBadge(job.status)}
        </div>
        <div class="progress-bar" style="margin-bottom:8px;">
          <div class="progress-fill" style="width:${progress}%"></div>
        </div>
        <div style="font-size:0.8rem;color:var(--gray-500);">
          Step: ${job.current_step || '-'} | Progress: ${progress}%
        </div>
        <div class="timeline" style="margin-top:8px;">
          ${jobStatusOrder.filter(s => s !== 'completed' && s !== 'failed').map((step, i) => {
            const idx = jobStatusOrder.indexOf(job.status);
            const cls = i < idx ? 'completed' : (i === idx ? 'active' : '');
                        const labels = {
              planning: "规划中",
              main_image: "生成主图",
              detail_image: "生成详情图",
              sku_image: "生成SKU图",
              exporting: "导出中",
              uploading: "上传中",
            };
            return `<div class="timeline-item ${cls}">${labels[step] || step}</div>`;
          }).join('')}
          ${job.status === 'completed' ? '<div class="timeline-item completed">已完成</div>' : ''}
          ${job.status === 'failed' ? '<div class="timeline-item active" style="color:var(--red-600);">Failed</div>' : ''}
        </div>
        <div style="font-size:0.8rem;color:var(--gray-400);margin-top:8px;">
          Created: ${formatDateTime(job.created_at)} | Updated: ${formatDateTime(job.updated_at)}
        </div>
        ${job.result_json && Object.keys(job.result_json).length > 0 ? `
          <details style="margin-top:8px;">
            <summary style="font-size:0.8rem;color:var(--gray-500);cursor:pointer;">View result data</summary>
            <pre style="font-size:0.75rem;background:var(--gray-50);padding:8px;border-radius:4px;margin-top:4px;overflow-x:auto;max-height:200px;">${JSON.stringify(job.result_json, null, 2)}</pre>
          </details>
        ` : ''}
      </div>
    `;
  });

  section.innerHTML = html;
}

/* --- Workflow Controls --- */
function addWorkflowControls(data) {
  const container = document.getElementById('detail-content');
  if (data.status === 'pending') {
    const div = document.createElement('div');
    div.innerHTML = '<div style="margin-bottom:16px;display:flex;gap:12px;align-items:center">' +
      '<button class="btn btn-primary" onclick="startWorkflow(' + data.id + ')">Push to Workflow</button>' +
      '<span style="font-size:0.85rem;color:var(--gray-500)">Batch is pending. Review and push to start.</span></div>';
    container.insertBefore(div.firstElementChild, container.firstChild);
  } else if (data.status === 'running') {
    const div = document.createElement('div');
    const phases = ['title_generating','planning','main_image','detail_image','sku_image'];
    const labels = ['Title','Plan','Main Image','Detail Image','SKU Image'];
    const mode = data.workflow_mode;
    let btns = '';
    if (mode === 'manual') {
      btns = phases.map((p,i) => '<button class="btn btn-secondary btn-sm" onclick="pushPhase(' + data.id + ',\'' + p + '\')">Push ' + labels[i] + '</button>').join(' ');
    } else {
      btns = '<span style="font-size:0.85rem;color:var(--gray-500)">Auto mode: Worker orchestrates phases automatically.</span>';
    }
    div.innerHTML = '<div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' + btns + '</div>';
    container.insertBefore(div.firstElementChild, container.firstChild);
  }
}

async function startWorkflow(id) {
  try {
    const r = await fetch(API_BASE + '/batches/' + id + '/start', { method: 'POST', headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' } });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    createToast('Workflow started');
    loadDetail(id);
  } catch (e) { createToast('Start failed: ' + e.message, 'error'); }
}

async function pushPhase(id, phase) {
  try {
    const r = await fetch(API_BASE + '/batches/' + id + '/push-phase', { method: 'POST', headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' }, body: JSON.stringify({ phase }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    createToast('Phase pushed: ' + phase);
  } catch (e) { createToast('Push failed: ' + e.message, 'error'); }
}

/* --- Auto Refresh via SSE --- */
let eventSource = null;
let refreshTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  const id = getQueryParam('id');
  if (id) setupAutoRefresh(id);
});

async function setupAutoRefresh(batchId) {
  // Try SSE first
  try {
    eventSource = connectEvents(batchId,
      (type, data) => {
        if (type === 'job_update' || type === 'batch_update' || type === 'phase_error') {
          loadDetail(batchId);
        }
      },
      () => { /* fall back to polling */ }
    );
  } catch {}
  // Fallback: poll every 4s
  refreshTimer = setInterval(async () => {
    try {
      const resp = await fetch(API_BASE + '/batches/' + batchId, {
        headers: { 'Authorization': 'Bearer ' + getToken() },
      });
      const data = await resp.json();
      // Only refresh if still running
      if (data.status === 'running' || data.status === 'pending') return;
      // If completed/failed, stop polling
      clearInterval(refreshTimer);
      refreshTimer = null;
      if (eventSource) { eventSource.close(); eventSource = null; }
      // Reload one last time
      loadDetail(batchId);
    } catch {}
  }, 4000);
}

function createSection(title) {
  const container = document.getElementById('detail-content');
  const section = document.createElement('div');
  section.className = 'detail-section';
  section.innerHTML = `<div class="detail-section-title">${title}</div>`;
  container.appendChild(section);
  return section;
}
