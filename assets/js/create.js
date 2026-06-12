/* Ecom Workflow System V1 - Create Task Page */

// --- State ---
const state = {
  referenceImages: [],
  attachments: [],
  variants: [],
  specs: [],
  skus: [],
};

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  renderVariants();
  renderSpecs();
  updateSKU();
});

// --- Upload Handling ---
function setupUploadZone(elementId, category, targetArray) {
  const zone = document.getElementById(elementId);
  const fileInput = zone.querySelector('input[type="file"]');
  const preview = zone.querySelector('.upload-preview');

  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => { zone.classList.remove('dragover'); });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    Array.from(e.dataTransfer.files).forEach(f => uploadFile(f, category, targetArray, preview));
  });
  fileInput.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(f => uploadFile(f, category, targetArray, preview));
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
    createToast('Upload failed: ' + err.message, 'error');
  }
}

function renderUploadPreview(container, items) {
  container.style.display = items.length > 0 ? 'grid' : 'none';
  container.innerHTML = items.map((item, i) => '<div class="upload-item"><img src="' + item.url + '" alt="' + item.name + '" onerror="this.src=' + "'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22><rect fill=%22%23f3f4f6%22 width=%22100%25%22 height=%22100%25%22/></svg>'" + '"><button class="remove-btn" onclick="removeUploadItem(' + i + ', ' + "'" + container.id + "'" + ')">&times;</button></div>').join('');
}

function removeUploadItem(index, containerId) {
  const category = containerId === 'reference-preview' ? state.referenceImages : state.attachments;
  category.splice(index, 1);
  renderUploadPreview(document.getElementById(containerId), category);
}

// --- Variant Config ---
function addVariant() { state.variants.push({ name: '', image: null }); renderVariants(); updateSKU(); }
function removeVariant(index) { state.variants.splice(index, 1); renderVariants(); updateSKU(); }

function renderVariants() {
  const c = document.getElementById('variant-list');
  c.innerHTML = state.variants.map((v, i) => '<div class="config-row"><input class="form-input" placeholder="Variant name" value="' + v.name + '" onchange="state.variants[' + i + '].name=this.value;updateSKU()"><button class="btn btn-secondary btn-sm" onclick="uploadVariantImage(' + i + ')">' + (v.image ? 'Uploaded' : 'Upload') + '</button><button class="btn btn-danger btn-sm" onclick="removeVariant(' + i + ')">X</button></div>').join('');
}

async function uploadVariantImage(index) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const result = await api.uploadFile(file, 'reference');
      state.variants[index].image = result.url;
      renderVariants();
      createToast('Variant img uploaded');
    } catch (err) { createToast('Upload failed: ' + err.message, 'error'); }
  };
  input.click();
}

// --- Spec Config ---
function addSpec() { state.specs.push({ name: '', image: null, values: [] }); renderSpecs(); updateSKU(); }
function removeSpec(index) { state.specs.splice(index, 1); renderSpecs(); updateSKU(); }

function renderSpecs() {
  const c = document.getElementById('spec-list');
  c.innerHTML = state.specs.map((s, i) => '<div class="card" style="margin-bottom:12px;"><div class="config-row"><input class="form-input" placeholder="Spec name" value="' + s.name + '" onchange="state.specs[' + i + '].name=this.value;updateSKU()"><button class="btn btn-secondary btn-sm" onclick="uploadSpecImage(' + i + ')">' + (s.image ? 'Uploaded' : 'Upload') + '</button><button class="btn btn-danger btn-sm" onclick="removeSpec(' + i + ')">X</button></div><div id="spec-values-' + i + '">' + s.values.map((v, j) => '<div class="config-row"><input class="form-input" placeholder="Value" value="' + v + '" onchange="state.specs[' + i + '].values[' + j + ']=this.value;updateSKU()"><button class="btn btn-danger btn-sm" onclick="removeSpecValue(' + i + ',' + j + ')">X</button></div>').join('') + '<button class="btn btn-secondary btn-sm" onclick="addSpecValue(' + i + ')">+ Add Value</button></div></div>').join('');
}

function addSpecValue(i) { state.specs[i].values.push(''); renderSpecs(); updateSKU(); }
function removeSpecValue(i, j) { state.specs[i].values.splice(j, 1); renderSpecs(); updateSKU(); }

async function uploadSpecImage(index) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const result = await api.uploadFile(file, 'reference');
      state.specs[index].image = result.url;
      renderSpecs();
      createToast('Spec img uploaded');
    } catch (err) { createToast('Upload failed: ' + err.message, 'error'); }
  };
  input.click();
}

// --- SKU Generation ---
function updateSKU() {
  const vv = state.variants.filter(v => v.name.trim());
  const vs = state.specs.filter(s => s.name.trim() && s.values.some(x => x.trim()));
  const container = document.getElementById('sku-result');

  if (vv.length === 0 && vs.length === 0) {
    container.innerHTML = '<div style="color:var(--gray-400);font-size:0.85rem;">Add variants and specs to generate SKUs</div>';
    state.skus = []; return;
  }

  const groups = vs.map(s => ({ name: s.name.trim(), values: s.values.filter(x => x.trim()) }));
  function cartesian(g) {
    if (g.length === 0) return [[]];
    const [first, ...rest] = g;
    return cartesian(rest).flatMap(combo => first.values.map(val => [{ groupName: first.name, value: val }, ...combo]));
  }
  const combos = groups.length > 0 ? cartesian(groups) : [[]];
  state.skus = [];
  let html = '';
  for (const v of vv) {
    for (const combo of combos) {
      const name = v.name.trim() + (combo.length ? ' + ' + combo.map(c => c.value).join('+') : '');
      state.skus.push({ variant: v.name.trim(), specs: combo, name: name });
      html += '<span class="sku-tag">' + name + '</span>';
    }
  }
  container.innerHTML = html;
  document.getElementById('sku-count').textContent = state.skus.length > 0 ? state.skus.length + ' SKUs' : '';
}

// --- Submit ---
document.getElementById('create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submit-btn');
  btn.disabled = true; btn.textContent = 'Submitting...';
  try {
    const fd = new FormData(e.target);
    const body = {
      taskName: fd.get('taskName'), platform: fd.get('platform'), market: fd.get('market'),
      language: fd.get('language'), requirement: fd.get('requirement'),
      productInfo: {
        productName: fd.get('productName'), brand: fd.get('brand'), category: fd.get('category'),
        targetAudience: fd.get('targetAudience'), priceRange: fd.get('priceRange'),
        referenceImages: state.referenceImages, attachments: state.attachments,
      },
      variants: state.variants.filter(v => v.name.trim()),
      specs: state.specs.filter(s => s.name.trim()),
      skus: state.skus,
      batchCount: parseInt(fd.get('batchCount')) || 1,
      mainImageCount: parseInt(fd.get('mainImageCount')) || 1,
      detailImageCount: parseInt(fd.get('detailImageCount')) || 1,
      skuImageCount: parseInt(fd.get('skuImageCount')) || 1,
      workflowMode: fd.get('workflowMode') || 'auto',
    };
    const result = await api.createBatch(body);
    createToast('Task ' + result.batch_no + ' created');
    setTimeout(() => navigate('detail.html?id=' + result.id), 1000);
  } catch (err) {
    createToast('Create failed: ' + err.message, 'error');
    btn.disabled = false; btn.textContent = 'Submit Task';
  }
});
