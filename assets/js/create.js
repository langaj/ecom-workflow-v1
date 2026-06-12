/* Ecom Workflow V1 - Create Task Page */

// --- State ---
const state = {
  referenceImages: [],
  attachments: [],
  variants: [],
  specs: [],
  skus: [],
};

document.addEventListener('DOMContentLoaded', () => {
  renderVariants();
  renderSpecs();
  updateSKU();
});

// --- Local file handling (upload happens on submit) ---
function gp(eid) { return document.getElementById(eid.replace('-upload', '-preview')); }

function suz(eid, cat, arr) {
  const z = document.getElementById(eid);
  const fi = z.querySelector('input[type="file"]');
  const pv = gp(eid);
  z.onclick = () => fi.click();
  z.ondragover = e => { e.preventDefault(); z.classList.add('dragover'); };
  z.ondragleave = () => { z.classList.remove('dragover'); };
  z.ondrop = e => { e.preventDefault(); z.classList.remove('dragover'); Array.from(e.dataTransfer.files).forEach(f => alf(f, arr, pv)); };
  fi.onchange = e => { Array.from(e.target.files).forEach(f => alf(f, arr, pv)); fi.value = ''; };
}

suz('reference-upload', 'reference', state.referenceImages);
suz('attachment-upload', 'attachment', state.attachments);

function alf(file, arr, pv) {
  if (!pv) return;
  const url = URL.createObjectURL(file);
  arr.push({ name: file.name, file: file, url: url });
  rup(pv, arr);
}

function rup(c, items) {
  if (!c) return;
  c.style.display = items.length > 0 ? 'grid' : 'none';
  c.innerHTML = items.map((item, i) =>
    '<div class="upload-item"><img src="' + item.url + '" alt="' + item.name + '" style="width:100%;height:120px;object-fit:cover;"><button class="remove-btn" onclick="rui(this,' + i + ')">&times;</button></div>'
  ).join('');
}

function rui(btn, idx) {
  const c = btn.closest('.upload-preview');
  const isRef = c.id === 'reference-preview';
  const arr = isRef ? state.referenceImages : state.attachments;
  if (arr[idx] && arr[idx].url && arr[idx].url.startsWith('blob:')) URL.revokeObjectURL(arr[idx].url);
  arr.splice(idx, 1);
  rup(c, arr);
}

// --- Variant ---
function addVariant() { state.variants.push({ name: '', image: null }); rv(); updateSKU(); }
function removeVariant(i) { state.variants.splice(i, 1); rv(); updateSKU(); }

function rv() {
  const c = document.getElementById('variant-list');
  if (!c) return;
  c.innerHTML = state.variants.map((v, i) =>
    '<div class="config-row"><input class="form-input" placeholder="e.g. Color" value="' + esc(v.name) + '" onchange="state.variants[' + i + '].name=this.value;updateSKU()"><button class="btn btn-secondary btn-sm" onclick="uv(' + i + ')">' + (v.image ? 'OK' : 'Img') + '</button><button class="btn btn-danger btn-sm" onclick="removeVariant(' + i + ')">X</button></div>'
  ).join('');
}

async function uv(i) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const r = await api.uploadFile(f, 'reference'); state.variants[i].image = r.url; rv(); }
    catch (err) { createToast('Upload failed: ' + err.message, 'error'); }
  };
  inp.click();
}

// --- Spec ---
function addSpec() { state.specs.push({ name: '', image: null, values: [] }); rs(); updateSKU(); }
function removeSpec(i) { state.specs.splice(i, 1); rs(); updateSKU(); }

function rs() {
  const c = document.getElementById('spec-list');
  if (!c) return;
  c.innerHTML = state.specs.map((s, i) =>
    '<div class="card" style="margin-bottom:12px;"><div class="config-row"><input class="form-input" placeholder="e.g. Size" value="' + esc(s.name) + '" onchange="state.specs[' + i + '].name=this.value;updateSKU()"><button class="btn btn-secondary btn-sm" onclick="us(' + i + ')">' + (s.image ? 'OK' : 'Img') + '</button><button class="btn btn-danger btn-sm" onclick="removeSpec(' + i + ')">X</button></div><div>' +
    s.values.map((v, j) => '<div class="config-row"><input class="form-input" placeholder="e.g. 500ml" value="' + esc(v) + '" onchange="state.specs[' + i + '].values[' + j + ']=this.value;updateSKU()"><button class="btn btn-danger btn-sm" onclick="removeSpecValue(' + i + ',' + j + ')">X</button></div>').join('') +
    '<button class="btn btn-secondary btn-sm" onclick="addSpecValue(' + i + ')">+ Value</button></div></div>'
  ).join('');
}

function addSpecValue(i) { state.specs[i].values.push(''); rs(); updateSKU(); }
function removeSpecValue(i, j) { state.specs[i].values.splice(j, 1); rs(); updateSKU(); }

async function us(i) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const r = await api.uploadFile(f, 'reference'); state.specs[i].image = r.url; rs(); }
    catch (err) { createToast('Upload failed: ' + err.message, 'error'); }
  };
  inp.click();
}

// --- SKU ---
function updateSKU() {
  const vv = state.variants.filter(v => v.name.trim());
  const vs = state.specs.filter(s => s.name.trim() && s.values.some(x => x.trim()));
  const c = document.getElementById('sku-result');
  if (!c) return;
  if (vv.length === 0 && vs.length === 0) { c.innerHTML = '<div style="color:var(--gray-400);font-size:0.85rem;">Add variants & specs to generate SKUs</div>'; state.skus = []; return; }
  const g = vs.map(s => ({ name: s.name.trim(), values: s.values.filter(x => x.trim()) }));
  function cart(g) { if (g.length === 0) return [[]]; const [f, ...r] = g; return cart(r).flatMap(co => f.values.map(v => [{ groupName: f.name, value: v }, ...co])); }
  const combos = g.length > 0 ? cart(g) : [[]];
  state.skus = [];
  let html = '';
  for (const v of vv) {
    for (const co of combos) {
      const n = v.name.trim() + (co.length ? ' + ' + co.map(c => c.value).join('+') : '');
      state.skus.push({ variant: v.name.trim(), specs: co, name: n });
      html += '<span class="sku-tag">' + esc(n) + '</span>';
    }
  }
  c.innerHTML = html;
  const e = document.getElementById('sku-count');
  if (e) e.textContent = state.skus.length + ' SKUs';
}

function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// --- Upload files then submit ---
async function uploadArr(arr, cat) {
  const res = [];
  for (const item of arr) {
    if (!item.file) { res.push(item); continue; }
    try {
      const r = await api.uploadFile(item.file, cat);
      if (item.url && item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
      res.push({ name: item.name, url: r.url, key: r.key });
    } catch (err) { createToast('Upload ' + item.name + ' failed: ' + err.message, 'error'); throw err; }
  }
  return res;
}

document.getElementById('create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submit-btn');
  btn.disabled = true; btn.textContent = 'Uploading...';
  try {
    const refs = await uploadArr(state.referenceImages, 'reference');
    const atts = await uploadArr(state.attachments, 'attachment');
    btn.textContent = 'Submitting...';
    const fd = new FormData(e.target);
    const body = {
      taskName: fd.get('taskName'),
      platform: '', market: '', language: '',
      requirement: fd.get('requirement') || '',
      productInfo: {
        productName: fd.get('productName') || '',
        referenceImages: refs,
        attachments: atts,
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
    const r = await api.createBatch(body);
    createToast('Task ' + r.batch_no + ' created');
    setTimeout(() => navigate('detail.html?id=' + r.id), 1000);
  } catch (err) {
    createToast('Submit failed: ' + err.message, 'error');
    btn.disabled = false; btn.textContent = 'Submit';
  }
});