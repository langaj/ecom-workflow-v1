// Ecom Workflow System V1 - Cloudflare Worker
// Single file architecture. All routes in one place.


// ─── Route handler ───────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // CORS headers for frontend
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response;

      // ── Dashboard ──────────────────────────────────────────────────────────
      if (method === 'GET' && path === '/api/dashboard') {
        response = await handleDashboard(env);

      // ── Batches ──────────────────────────────────────────────────────────
      } else if (method === 'POST' && path === '/api/batches') {
        response = await handleCreateBatch(request, env);
      } else if (method === 'GET' && path === '/api/batches') {
        response = await handleListBatches(request, env);
      } else if (method === 'GET' && path.match(/^\/api\/batches\/\d+$/)) {
        const id = path.split('/')[3];
        response = await handleGetBatch(id, env);
      } else if (method === 'PUT' && path.match(/^\/api\/batches\/\d+$/)) {
        const id = path.split('/')[3];
        response = await handleUpdateBatch(id, request, env);
      } else if (method === 'DELETE' && path.match(/^\/api\/batches\/\d+$/)) {
        const id = path.split('/')[3];
        response = await handleDeleteBatch(id, env);

      // ── Jobs ─────────────────────────────────────────────────────────────
      } else if (method === 'GET' && path === '/api/jobs') {
        response = await handleListJobs(request, env);
      } else if (method === 'GET' && path.match(/^\/api\/jobs\/\d+$/)) {
        const id = path.split('/')[3];
        response = await handleGetJob(id, env);

      // ── Upload ───────────────────────────────────────────────────────────
      } else if (method === 'POST' && path === '/api/upload') {
        response = await handleUpload(request, env);

      // ── Callback ─────────────────────────────────────────────────────────
      } else if (method === 'POST' && path === '/api/callback/job') {
        response = await handleJobCallback(request, env);

      } else {
        response = jsonResponse({ error: 'Not Found' }, 404);
      }

      // Add CORS headers
      const resp = new Response(response.body, {
        status: response.status,
        headers: { ...corsHeaders, ...Object.fromEntries(response.headers) },
      });
      return resp;

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function generateBatchNo() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `B${y}${m}${d}${h}${min}-${rand}`;
}

function generateJobNo(batchNo, index) {
  return `${batchNo}-${String(index).padStart(3, '0')}`;
}

function parseJsonSafe(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

async function handleDashboard(env) {
  const db = env.DB;
  const [totalRow, pendingRow, runningRow, completedRow, failedRow, recentRows] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM ecom_batch').first(),
    db.prepare("SELECT COUNT(*) as count FROM ecom_batch WHERE status = 'pending'").first(),
    db.prepare("SELECT COUNT(*) as count FROM ecom_batch WHERE status = 'running'").first(),
    db.prepare("SELECT COUNT(*) as count FROM ecom_batch WHERE status = 'completed'").first(),
    db.prepare("SELECT COUNT(*) as count FROM ecom_batch WHERE status = 'failed'").first(),
    db.prepare('SELECT id, batch_no, task_name, status, created_at, updated_at FROM ecom_batch ORDER BY created_at DESC LIMIT 10').all(),
  ]);

  return jsonResponse({
    total: totalRow.count,
    pending: pendingRow.count,
    running: runningRow.count,
    completed: completedRow.count,
    failed: failedRow.count,
    recent: recentRows.results,
  });
}

// ─── Batch CRUD ──────────────────────────────────────────────────────────────

async function handleCreateBatch(request, env) {
  const db = env.DB;
  const body = await request.json();

  const batchNo = generateBatchNo();
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const productJson = JSON.stringify(body.productInfo || {});
  const variantJson = JSON.stringify(body.variants || []);
  const specJson = JSON.stringify(body.specs || []);
  const skuJson = JSON.stringify(body.skus || []);

  const result = await db.prepare(`
    INSERT INTO ecom_batch (batch_no, task_name, platform, market, language, requirement,
      status, workflow_mode, batch_count, main_image_count, detail_image_count,
      sku_image_count, product_json, variant_json, spec_json, sku_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    batchNo,
    body.taskName || '',
    body.platform || '',
    body.market || '',
    body.language || '',
    body.requirement || '',
    body.workflowMode || 'auto',
    body.batchCount || 1,
    body.mainImageCount || 1,
    body.detailImageCount || 1,
    body.skuImageCount || 1,
    productJson, variantJson, specJson, skuJson,
    now, now
  ).run();

  const batchId = result.meta.last_row_id;

  // Generate jobs based on skus
  const skus = body.skus || [];
  if (skus.length > 0) {
    const stmt = db.prepare(`
      INSERT INTO ecom_job (batch_id, job_no, status, progress, current_step, sku_info, created_at, updated_at)
      VALUES (?, ?, 'planning', 0, '', ?, ?, ?)
    `);
    for (let i = 0; i < skus.length; i++) {
      const jobNo = generateJobNo(batchNo, i + 1);
      await stmt.bind(batchId, jobNo, JSON.stringify(skus[i]), now, now).run();
    }
  } else {
    // No SKUs, create a default job
    const jobNo = generateJobNo(batchNo, 1);
    await db.prepare(`
      INSERT INTO ecom_job (batch_id, job_no, status, progress, current_step, sku_info, created_at, updated_at)
      VALUES (?, ?, 'planning', 0, '', '{}', ?, ?)
    `).bind(batchId, jobNo, now, now).run();
  }

  return jsonResponse({
    id: batchId,
    batch_no: batchNo,
    message: 'Batch created successfully',
  }, 201);
}

async function handleListBatches(request, env) {
  const db = env.DB;
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const page = parseInt(url.searchParams.get('page')) || 1;
  const pageSize = parseInt(url.searchParams.get('pageSize')) || 20;
  const offset = (page - 1) * pageSize;

  let query = 'SELECT id, batch_no, task_name, status, created_at, updated_at FROM ecom_batch WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as count FROM ecom_batch WHERE 1=1';
  const params = [];
  const countParams = [];

  if (status) {
    query += ' AND status = ?';
    countQuery += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }
  if (search) {
    query += ' AND (task_name LIKE ? OR batch_no LIKE ?)';
    countQuery += ' AND (task_name LIKE ? OR batch_no LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like);
    countParams.push(like, like);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(pageSize, offset);

  const [rows, countRow] = await Promise.all([
    db.prepare(query).bind(...params).all(),
    db.prepare(countQuery).bind(...countParams).first(),
  ]);

  return jsonResponse({
    data: rows.results,
    total: countRow.count,
    page,
    pageSize,
  });
}

async function handleGetBatch(id, env) {
  const db = env.DB;
  const batch = await db.prepare('SELECT * FROM ecom_batch WHERE id = ?').bind(id).first();
  if (!batch) {
    return jsonResponse({ error: 'Batch not found' }, 404);
  }

  // Enrich with jobs
  const jobs = await db.prepare('SELECT * FROM ecom_job WHERE batch_id = ? ORDER BY job_no ASC').bind(id).all();

  return jsonResponse({
    ...batch,
    product_json: parseJsonSafe(batch.product_json, {}),
    variant_json: parseJsonSafe(batch.variant_json, []),
    spec_json: parseJsonSafe(batch.spec_json, []),
    sku_json: parseJsonSafe(batch.sku_json, []),
    result_json: parseJsonSafe(batch.result_json, {}),
    jobs: jobs.results.map(j => ({
      ...j,
      sku_info: parseJsonSafe(j.sku_info, {}),
      result_json: parseJsonSafe(j.result_json, {}),
    })),
  });
}

async function handleUpdateBatch(id, request, env) {
  const db = env.DB;
  const body = await request.json();
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const existing = await db.prepare('SELECT id FROM ecom_batch WHERE id = ?').bind(id).first();
  if (!existing) {
    return jsonResponse({ error: 'Batch not found' }, 404);
  }

  const updates = [];
  const params = [];

  const fields = ['task_name', 'platform', 'market', 'language', 'requirement',
    'status', 'workflow_mode', 'batch_count', 'main_image_count',
    'detail_image_count', 'sku_image_count'];

  const fieldMap = {
    taskName: 'task_name', platform: 'platform', market: 'market',
    language: 'language', requirement: 'requirement', status: 'status',
    workflowMode: 'workflow_mode', batchCount: 'batch_count',
    mainImageCount: 'main_image_count', detailImageCount: 'detail_image_count',
    skuImageCount: 'sku_image_count',
  };

  for (const [bodyKey, dbKey] of Object.entries(fieldMap)) {
    if (body[bodyKey] !== undefined) {
      updates.push(`${dbKey} = ?`);
      params.push(body[bodyKey]);
    }
  }

  // JSON fields
  if (body.productInfo) {
    updates.push('product_json = ?');
    params.push(JSON.stringify(body.productInfo));
  }
  if (body.variants) {
    updates.push('variant_json = ?');
    params.push(JSON.stringify(body.variants));
  }
  if (body.specs) {
    updates.push('spec_json = ?');
    params.push(JSON.stringify(body.specs));
  }
  if (body.skus) {
    updates.push('sku_json = ?');
    params.push(JSON.stringify(body.skus));
  }
  if (body.result) {
    updates.push('result_json = ?');
    params.push(JSON.stringify(body.result));
  }

  if (updates.length === 0) {
    return jsonResponse({ message: 'No fields to update' });
  }

  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  await db.prepare(`UPDATE ecom_batch SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  return jsonResponse({ message: 'Batch updated successfully' });
}

async function handleDeleteBatch(id, env) {
  const db = env.DB;
  const existing = await db.prepare('SELECT id FROM ecom_batch WHERE id = ?').bind(id).first();
  if (!existing) {
    return jsonResponse({ error: 'Batch not found' }, 404);
  }

  // Delete jobs first, then batch
  await db.prepare('DELETE FROM ecom_job WHERE batch_id = ?').bind(id).run();
  await db.prepare('DELETE FROM ecom_batch WHERE id = ?').bind(id).run();

  return jsonResponse({ message: 'Batch deleted successfully' });
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

async function handleListJobs(request, env) {
  const db = env.DB;
  const url = new URL(request.url);
  const batchId = url.searchParams.get('batch_id');
  const status = url.searchParams.get('status');
  const page = parseInt(url.searchParams.get('page')) || 1;
  const pageSize = parseInt(url.searchParams.get('pageSize')) || 50;
  const offset = (page - 1) * pageSize;

  let query = 'SELECT j.*, b.task_name, b.batch_no FROM ecom_job j LEFT JOIN ecom_batch b ON j.batch_id = b.id WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as count FROM ecom_job WHERE 1=1';
  const params = [];
  const countParams = [];

  if (batchId) {
    query += ' AND j.batch_id = ?';
    countQuery += ' AND batch_id = ?';
    params.push(batchId);
    countParams.push(batchId);
  }
  if (status) {
    query += ' AND j.status = ?';
    countQuery += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }

  query += ' ORDER BY j.created_at DESC LIMIT ? OFFSET ?';
  params.push(pageSize, offset);

  const [rows, countRow] = await Promise.all([
    db.prepare(query).bind(...params).all(),
    db.prepare(countQuery).bind(...countParams).first(),
  ]);

  return jsonResponse({
    data: rows.results,
    total: countRow.count,
    page,
    pageSize,
  });
}

async function handleGetJob(id, env) {
  const db = env.DB;
  const job = await db.prepare(`
    SELECT j.*, b.task_name, b.batch_no FROM ecom_job j
    LEFT JOIN ecom_batch b ON j.batch_id = b.id
    WHERE j.id = ?
  `).bind(id).first();

  if (!job) {
    return jsonResponse({ error: 'Job not found' }, 404);
  }

  return jsonResponse({
    ...job,
    sku_info: parseJsonSafe(job.sku_info, {}),
    result_json: parseJsonSafe(job.result_json, {}),
  });
}

// ─── Upload to R2 ────────────────────────────────────────────────────────────

async function handleUpload(request, env) {
  const formData = await request.formData();
  const file = formData.get('file');
  const category = formData.get('category') || 'reference';

  if (!file) {
    return jsonResponse({ error: 'No file provided' }, 400);
  }

  const validCategories = ['reference', 'attachment', 'main', 'detail', 'sku', 'excel'];
  if (!validCategories.includes(category)) {
    return jsonResponse({ error: 'Invalid category' }, 400);
  }

  const fileName = file.name;
  const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
  const key = `${category}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  await env.R2.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
  });

  // Generate public URL (requires R2 public bucket or custom domain)
  const publicUrl = `${env.R2_PUBLIC_URL || ''}/${key}`;

  return jsonResponse({ url: publicUrl, key });
}

// ─── N8N Job Callback ───────────────────────────────────────────────────────

async function handleJobCallback(request, env) {
  const db = env.DB;
  const body = await request.json();
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // body: { job_no, status, current_step, progress, result, images }
  const { job_no, status, current_step, progress, result, images } = body;

  if (!job_no) {
    return jsonResponse({ error: 'job_no is required' }, 400);
  }

  const job = await db.prepare('SELECT * FROM ecom_job WHERE job_no = ?').bind(job_no).first();
  if (!job) {
    return jsonResponse({ error: 'Job not found' }, 404);
  }

  const resultJson = result ? JSON.stringify(result) : job.result_json;
  const step = current_step || job.current_step;
  const prog = progress !== undefined ? progress : job.progress;

  // UPDATE ecom_job
  await db.prepare(`
    UPDATE ecom_job SET status = ?, current_step = ?, progress = ?, result_json = ?, updated_at = ?
    WHERE id = ?
  `).bind(status || job.status, step, prog, resultJson, now, job.id).run();

  // UPDATE ecom_batch status if needed
  if (status === 'failed') {
    await db.prepare(`
      UPDATE ecom_batch SET status = 'failed', updated_at = ?
      WHERE id = ? AND status != 'failed'
    `).bind(now, job.batch_id).run();
  } else {
    // Check if all jobs in batch are completed
    const pendingJobs = await db.prepare(`
      SELECT COUNT(*) as count FROM ecom_job WHERE batch_id = ? AND status != 'completed'
    `).bind(job.batch_id).first();

    if (pendingJobs.count === 0) {
      await db.prepare(`
        UPDATE ecom_batch SET status = 'completed', updated_at = ?
        WHERE id = ?
      `).bind(now, job.batch_id).run();
    } else if (status === 'planning' || status === 'main_image' || status === 'detail_image' || status === 'sku_image') {
      // Ensure batch is marked as running when jobs start processing
      await db.prepare(`
        UPDATE ecom_batch SET status = 'running', updated_at = ?
        WHERE id = ? AND status IN ('pending', 'running')
      `).bind(now, job.batch_id).run();
    }
  }

  return jsonResponse({ message: 'Job updated successfully' });
}
