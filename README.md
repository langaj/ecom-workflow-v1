# Ecom Workflow System V1

电商 AI 套图生产系统 — 内部使用的商品套图自动化生产平台。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Cloudflare Pages (纯静态 HTML + CSS + JS，连接 GitHub 自动部署) |
| 后端 | Cloudflare Worker (在线编辑器部署，独立账号) |
| 数据库 | Cloudflare D1 |
| 文件存储 | Cloudflare R2 |
| 工作流 | N8N |
| 代码仓库 | GitHub |

## 域名

| 用途 | 域名 | 部署方式 |
|---|---|---|
| 前端 Pages | `ecom.langaj.cn` | GitHub 仓库 → Pages 自动部署 |
| 后端 Worker | `ecom.langaj.work` | 在线编辑器粘贴代码 |

> Pages 构建设置：**Root directory** 设为 `frontend`

## 项目结构

```
frontend/                   # Cloudflare Pages 站点
  index.html                # 仪表盘
  jobs.html                 # 任务列表
  create.html               # 创建任务（核心页面）
  detail.html               # 任务详情
  assets/
    css/style.css           # 全局样式
    js/
      api.js                # API 客户端（指向 https://ecom.langaj.work/api）
      dashboard.js
      jobs.js
      create.js
      detail.js
worker/
  index.js                  # Worker 源码（复制到在线编辑器）
database/
  schema.sql                # D1 建表 SQL（表名：ecom_batch, ecom_job）
项目需求.md                  # 原始需求文档
README.md
```

## API 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/dashboard` | 仪表盘统计数据 |
| POST | `/api/batches` | 创建批次任务 |
| GET | `/api/batches` | 批次列表（支持搜索、筛选、分页） |
| GET | `/api/batches/{id}` | 批次详情（含 Jobs） |
| PUT | `/api/batches/{id}` | 更新批次 |
| DELETE | `/api/batches/{id}` | 删除批次 |
| GET | `/api/jobs` | Job 列表 |
| GET | `/api/jobs/{id}` | Job 详情 |
| POST | `/api/upload` | 上传文件到 R2 |
| POST | `/api/callback/job` | N8N 工作流回调 |

所有 API 基地址：`https://ecom.langaj.work/api`

## N8N 回调

```
POST https://ecom.langaj.work/api/callback/job
```

请求体：

```json
{
  "job_no": "B2406120915-AAA-001",
  "status": "main_image",
  "current_step": "generating main image",
  "progress": 25,
  "result": {
    "images": ["https://..."]
  }
}
```

## 部署指南

### 前端 (Pages)

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 选择 `langaj/ecom-workflow-v1`
3. **Production branch**: `master`
4. **Build command**: 留空
5. **Root directory**: `frontend` ← 关键设置
6. Pages 项目 → **Settings** → **Domains** → 绑定 `ecom.langaj.cn`

### 后端 (Worker)

1. 在另一个 Cloudflare 账号创建 Worker
2. 在线编辑器粘贴 `worker/index.js` 全部代码
3. **Settings** → **Variables** 添加绑定：
   - D1 Database: 变量名 `DB` → 创建数据库 `ecom-workflow-db`
   - R2 Bucket: 变量名 `R2` → 创建存储桶 `ecom-workflow-storage`
   - Environment Variable: `R2_PUBLIC_URL` = R2 公开域名（可先留空）
4. 建表：Worker **Console** 标签或 Dashboard D1 控制台执行 `database/schema.sql`
5. **Triggers** → **Custom Domain** → `ecom.langaj.work`

## 注意事项

- 数据库表名统一使用 `ecom_` 前缀（`ecom_batch`、`ecom_job`），与其他项目共享 D1 时避免冲突
- Worker 代码零依赖，直接粘贴即可运行
- 前端是纯静态页面，API 地址写死在 `api.js` 中

## 禁止使用

React / Vue / NextJS / Nuxt / Vite / Tailwind / TypeScript / Hono
用户系统 / 权限系统 / 多租户设计

## 许可证

Internal - 公司内部使用