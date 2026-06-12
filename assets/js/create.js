/* Ecom Workflow System V1 - Create Task Page */

// ─── State ──────────────────────────────────────────────────────────────────
const state = {
  referenceImages: [],
  attachments: [],
  variants: [],
  specs: [],
  skus: [],
};

// ─── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderVariants();
  renderSpecs();
  updateSKU();
});

// ─── Upload Handling ────────────────────────────────────────────────────────
function setupUploadZone(elementId, category, targetArray) {
  const zone = document.getElementById(elementId);
  const fileInput = zone.querySelector('input[type="file"]');
  const preview = zone.querySelector('.upload-preview');

  zone.addEventListener('click', () => fileInput.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    files.forEach(f => uploadFile(f, category, targetArray, preview));
  });

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    files.forEach(f => uploadFile(f, category, targetArray, preview));
    fileInput.value = '';
  });
}

setupUploadZone('reference-upload', 'reference', state.referenceImages);
setupUploadZone('attachment-upload', 'attachment', state.attachments);

async function uploadFile(file, category, targetArray, previewEl) {
  try {
    const result = await api.uploadFile(file, category);
    targetArray.push({ name: file.name, url: result.url, key: result.key });
    renderUploadPreview(previewEl, targetArray);
  } catch (err) {
    createToast(`上传 ${file.name} 失败: ${err.message}`, 'error');
  }
}

function renderUploadPreview(container, items) {
  container.style.display = items.length > 0 ? 'grid' : 'none';
  container.innerHTML = items.map((item, i) => `
    <div class="upload-item">
      <img src="${item.url}" alt="${item.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22><rect fill=%22%23f3f4f6%22 width=%22100%25%22 height=%22100%25%22/></svg>'">
      <button class="remove-btn" onclick="removeUploadItem(${i}, '${container.id}')">&times;</button>
    </div>
  `).join('');
}

function removeUploadItem(index, containerId) {
  const category = containerId === 'reference-preview' ? state.referenceImages : state.attachments;
  category.splice(index, 1);
  const container = document.getElementById(containerId);
  renderUploadPreview(container, category);
}

// ─── Variant Config ─────────────────────────────────────────────────────────
function addVariant() {
  state.variants.push({ name: '', image: null });
  renderVariants();
  updateSKU();
}

function removeVariant(index) {
  state.variants.splice(index, 1);
  renderVariants();
  updateSKU();
}

function renderVariants() {
  const container = document.getElementById('variant-list');
  container.innerHTML = state.variants.map((v, i) => `
    <div class="config-row">
      <input class="form-input" placeholder="变体名称（如：颜色）" value="${v.name}"
        onchange="state.variants[${i}].name = this.value; updateSKU()">
      <button class="btn btn-secondary btn-sm" onclick="uploadVariantImage(${i})">
        ${v.image ? '已上�? : '上传图片'}
      </button>
      <button class="btn btn-danger btn-sm" onclick="removeVariant(${i})">删除</button>
    </div>
  `).join('');
}

async function uploadVariantImage(index) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const result = await api.uploadFile(file, 'reference');
      state.variants[index].image = result.url;
      renderVariants();
      createToast('变体图片上传成功');
    } catch (err) {
      createToast('上传失败: ' + err.message, 'error');
    }
  };
  input.click();
}

// ─── Spec Config ────────────────────────────────────────────────────────────
function addSpec() {
  state.specs.push({ name: '', image: null, values: [] });
  renderSpecs();
  updateSKU();
}

function removeSpec(index) {
  state.specs.splice(index, 1);
  renderSpecs();
  updateSKU();
}

function renderSpecs() {
  const container = document.getElementById('spec-list');
  container.innerHTML = state.specs.map((s, i) => `
    <div class="card" style="margin-bottom:12px;">
      <div class="config-row">
        <input class="form-input" placeholder="规格名称（如：容量）" value="${s.name}"
          onchange="state.specs[${i}].name = this.value; updateSKU()">
        <button class="btn btn-secondary btn-sm" onclick="uploadSpecImage(${i})">
          ${s.image ? '已上�? : '上传图片'}
        </button>
        <button class="btn btn-danger btn-sm" onclick="removeSpec(${i})">删除规格</button>
      </div>
      <div id="spec-values-${i}">
        ${s.values.map((v, j) => `
          <div class="config-row">
            <input class="form-input" placeholder="规格值（如：500ml�? value="${v}"
              onchange="state.specs[${i}].values[${j}] = this.value; updateSKU()">
            <button class="btn btn-danger btn-sm" onclick="removeSpecValue(${i}, ${j})">删除</button>
          </div>
        `).join('')}
        <button class="btn btn-secondary btn-sm" onclick="addSpecValue(${i})">+ 添加规格�?/button>
      </div>
    </div>
  `).join('');
}

function addSpecValue(specIndex) {
  state.specs[specIndex].values.push('');
  renderSpecs();
  updateSKU();
}

function removeSpecValue(specIndex, valueIndex) {
  state.specs[specIndex].values.splice(valueIndex, 1);
  renderSpecs();
  updateSKU();
}

async function uploadSpecImage(index) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const result = await api.uploadFile(file, 'reference');
      state.specs[index].image = result.url;
      renderSpecs();
      createToast('规格图片上传成功');
    } catch (err) {
      createToast('上传失败: ' + err.message, 'error');
    }
  };
  input.click();
}

// ─── SKU Generation ─────────────────────────────────────────────────────────
function updateSKU() {
  const validVariants = state.variants.filter(v => v.name.trim());
  const validSpecs = state.specs.filter(s => s.name.trim() && s.values.some(v => v.trim()));

  const container = document.getElementById('sku-result');

  if (validVariants.length === 0 && validSpecs.length === 0) {
    container.innerHTML = '<div style="color:var(--gray-400);font-size:0.85rem;">添加变体和规格后，SKU 将自动生�?/div>';
    state.skus = [];
    return;
  }

  // Generate all combinations
  const allOptions = [];
  validVariants.forEach(v => {
    allOptions.push({ type: 'variant', name: v.name, image: v.image });
  });
  validSpecs.forEach(s => {
    s.values.filter(v => v.trim()).forEach(val => {
      allOptions.push({ type: 'spec', name: s.name, value: val });
    });
  });

  // Simple combination: each item becomes a unique SKU
  // For proper cross-product, group by variant and spec
  const variantNames = validVariants.map(v => v.name.trim());
  const specGroups = validSpecs.map(s => ({
    name: s.name.trim(),
    values: s.values.filter(v => v.trim()),
  }));

  // Generate cross-product of all spec values
  function cartesianProduct(groups) {
    if (groups.length === 0) return [[]];
    const [first, ...rest] = groups;
    const restProduct = cartesianProduct(rest);
    const result = [];
    for (const val of first.values) {
      for (const combo of restProduct) {
        result.push([{ groupName: first.name, value: val }, ...combo]);
      }
    }
    return result;
  }

  const specCombos = specGroups.length > 0 ? cartesianProduct(specGroups) : [[]];

  state.skus = [];
  let skuHtml = '';

  for (const variant of validVariants) {
    for (const combo of specCombos) {
      const parts = [variant.name.trim()];
      const specStr = combo.map(c => c.value).join('+');
      if (specStr) parts.push(specStr);
      const skuName = parts.join(' + ');
      state.skus.push({ variant: variant.name.trim(), specs: combo, name: skuName });
      skuHtml += `<span class="sku-tag">${skuName}</span>`;
    }
  }

  container.innerHTML = skuHtml;
  document.getElementById('sku-count').textContent = state.skus.length > 0 ? `�?${state.skus.length} �?SKU` : '';
}

// ─── Form Submit ────────────────────────────────────────────────────────────
document.getElementById('create-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = '提交�?..';

  try {
    const formData = new FormData(e.target);

    const body = {
      taskName: formData.get('taskName'),
      platform: formData.get('platform'),
      market: formData.get('market'),
      language: formData.get('language'),
      requirement: formData.get('requirement'),
      productInfo: {
        productName: formData.get('productName'),
        brand: formData.get('brand'),
        category: formData.get('category'),
        targetAudience: formData.get('targetAudience'),
        priceRange: formData.get('priceRange'),
        referenceImages: state.referenceImages,
        attachments: state.attachments,
      },
      variants: state.variants.filter(v => v.name.trim()),
      specs: state.specs.filter(s => s.name.trim()),
      skus: state.skus,
      batchCount: parseInt(formData.get('batchCount')) || 1,
      mainImageCount: parseInt(formData.get('mainImageCount')) || 1,
      detailImageCount: parseInt(formData.get('detailImageCount')) || 1,
      skuImageCount: parseInt(formData.get('skuImageCount')) || 1,
      workflowMode: formData.get('workflowMode') || 'auto',
    };

    const result = await api.createBatch(body);
    createToast(`任务 ${result.batch_no} 创建成功`);
    setTimeout(() => navigate(`detail.html?id=${result.id}`), 1000);
  } catch (err) {
    createToast('创建失败: ' + err.message, 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = '提交任务';
  }
});
