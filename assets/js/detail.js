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
  content.innerHTML = '<div class="loading"><div class="spinner"></div> 加载�?..</div>';

  try {
    batchData = await api.getBatch(id);
    content.innerHTML = '';

    renderBasicInfo(batchData);
    renderProductInfo(batchData);
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
        <span class="detail-field-label">批次�?/span>
        <span class="detail-field-value">${data.batch_no}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">状�?/span>
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
        <span class="detail-field-label">工作流模�?/span>
        <span class="detail-field-value">${data.workflow_mode || '-'}</span>
      </div>
      <div class="detail-field">
        <span class="detail-field-label">Created时间</span>
        <span class="detail-field-value">${formatDateTime(data.created_at)}</span>
      </div>
      <div class="detail-field" style="grid-column: 1 / -1;">
        <span class="detail-field-label">需求描�?/span>
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
    section.innerHTML = '<div style="color:var(--gray-400);font-size:0.85rem;">无附件素�?/div>';
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
    <div style="margin-top:8px;font-size:0.85rem;color:var(--gray-500);">�?${skus.length} �?SKU</div>
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
    html += '<h4 style="margin:12px 0 8px;font-size:0.85rem;color:var(--gray-600);">详情�?/h4>';
    html += `<div class="image-grid">${detailImages.map(url => `
      <div class="image-grid-item"><img src="${url}" alt="详情�?></div>
    `).join('')}</div>`;
  }

  if (skuImages.length > 0) {
    html += '<h4 style="margin:12px 0 8px;font-size:0.85rem;color:var(--gray-600);">SKU �?/h4>';
    html += `<div class="image-grid">${skuImages.map(url => `
      <div class="image-grid-item"><img src="${url}" alt="SKU�?></div>
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
              planning: '规划�?, main_image: '生成Main Image', detail_image: '生成详情�?,
              sku_image: '生成SKU�?, exporting: '导出�?, uploading: '上传�?,
            };
            return `<div class="timeline-item ${cls}">${labels[step] || step}</div>`;
          }).join('')}
          ${job.status === 'completed' ? '<div class="timeline-item completed">已完�?/div>' : ''}
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

function createSection(title) {
  const container = document.getElementById('detail-content');
  const section = document.createElement('div');
  section.className = 'detail-section';
  section.innerHTML = `<div class="detail-section-title">${title}</div>`;
  container.appendChild(section);
  return section;
}
