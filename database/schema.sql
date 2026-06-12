-- 如果是首次部署请直接执行全量建表；如果是已有数据库需迁移，请执行下方 *NEW* 部分。

CREATE TABLE IF NOT EXISTS ecom_batch (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_no TEXT NOT NULL UNIQUE,
  task_name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '',
  market TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT '',
  requirement TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  title_json TEXT NOT NULL DEFAULT '{}',
  workflow_mode TEXT NOT NULL DEFAULT 'auto',
  batch_count INTEGER NOT NULL DEFAULT 1,
  main_image_count INTEGER NOT NULL DEFAULT 1,
  detail_image_count INTEGER NOT NULL DEFAULT 1,
  sku_image_count INTEGER NOT NULL DEFAULT 1,
  product_json TEXT NOT NULL DEFAULT '{}',
  variant_json TEXT NOT NULL DEFAULT '[]',
  spec_json TEXT NOT NULL DEFAULT '[]',
  sku_json TEXT NOT NULL DEFAULT '[]',
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ecom_batch_status ON ecom_batch(status);
CREATE INDEX IF NOT EXISTS idx_ecom_batch_batch_no ON ecom_batch(batch_no);
CREATE INDEX IF NOT EXISTS idx_ecom_batch_created_at ON ecom_batch(created_at);

CREATE TABLE IF NOT EXISTS ecom_job (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  job_no TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'planning',
  progress INTEGER NOT NULL DEFAULT 0,
  current_step TEXT NOT NULL DEFAULT '',
  sku_info TEXT NOT NULL DEFAULT '{}',
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (batch_id) REFERENCES ecom_batch(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ecom_job_batch_id ON ecom_job(batch_id);
CREATE INDEX IF NOT EXISTS idx_ecom_job_status ON ecom_job(status);
CREATE INDEX IF NOT EXISTS idx_ecom_job_job_no ON ecom_job(job_no);
CREATE TABLE IF NOT EXISTS ecom_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL DEFAULT '',
  config_type TEXT NOT NULL DEFAULT 'string',
  description TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ecom_config_key ON ecom_config(config_key);

INSERT OR IGNORE INTO ecom_config (config_key, config_value, config_type, description) VALUES
  ('auth_password', 'admin123', 'password', '登录密码 / JWT 签名密钥'),
  ('r2_public_url', '', 'string', 'R2 公开访问域名（留空则使用相对路径）'),
  ('n8n_workflow_title_url', '', 'url', 'N8N 标题生成工作流 Webhook URL'),
  ('n8n_workflow_plan_url', '', 'url', 'N8N 套图规划工作流 Webhook URL'),
  ('n8n_workflow_main_url', '', 'url', 'N8N 主图生成工作流 Webhook URL'),
  ('n8n_workflow_detail_url', '', 'url', 'N8N 详情图生成工作流 Webhook URL'),
  ('n8n_workflow_sku_url', '', 'url', 'N8N SKU 图生成工作流 Webhook URL');
