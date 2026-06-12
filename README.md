# Ecom Workflow System V1

电商 AI 套图生产系统 — 内部使用的商品套图自动化生产平台。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Cloudflare Pages (HTML + CSS + JavaScript) |
| 后端 | Cloudflare Worker (单文件) |
| 数据库 | Cloudflare D1 (SQLite) |
| 文件存储 | Cloudflare R2 |
| 工作流 | N8N |
| 代码仓库 | GitHub |

## 项目结构

```
project/
├── frontend/               # Cloudflare Pages 静态站点
│   ├── index.html          # 仪表盘
│   ├── jobs.html           # 任务列表
│   ├── create.html         # 创建任务（核心页面）
│   ├── detail.html         # 任务详情
│   └── assets/
│       ├── css/style.css   # 全局样式
│       └── js/
│           ├── api.js      # API 客户端 + UI 工具函数
│           ├── dashboard.js
│           ├── jobs.js
│           ├── create.js
│           └── detail.js
├── worker/
│   └── index.js            # Cloudflare Worker（单文件，所有 API）
├── database/
│   └── schema.sql          # D1 数据库 Schema
├── docs/                   # 文档目录
├── wrangler.toml           # Cloudflare 部署配置
└── README.md
```

## 快速开始

### 1. 初始化 D1 数据库

```bash
wrangler d1 create ecom-workflow-db
wrangler d1 execute ecom-workflow-db --file=database/schema.sql
```

### 2. 创建 R2 存储桶

```bash
wrangler r2 bucket create ecom-workflow-storage
```

### 3. 配置环境变量

在 `wrangler.toml` 中设置 `R2_PUBLIC_URL` 为你的 R2 公开访问域名。

### 4. 本地开发

```bash
wrangler dev
```

### 5. 部署

```bash
wrangler pages deploy frontend --project-name=ecom-workflow-v1
wrangler deploy
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

## 任务创建流程

1. 填写基础信息（任务名称、平台、市场、语言、需求）
2. 填写商品信息（名称、品牌、品类、受众、价格区间）
3. 上传产品参考图（支持多图、拖拽）
4. 上传补充素材（Logo、包装图等）
5. 配置变体（颜色、材质、款式等）
6. 配置规格（容量、尺寸、数量等）
7. 自动生成 SKU 组合
8. 配置生成参数（主图数量、详情图数量等）
9. 提交任务

## N8N 回调

N8N 工作流完成某步骤后，通过 `POST /api/callback/job` 回调 Worker 更新任务状态。

回调请求体：

```json
{
  "job_no": "B2406120915-AAA-001",
  "status": "main_image",
  "current_step": "generating main image",
  "progress": 25,
  "result": {
    "images": ["https://...", "https://..."]
  }
}
```

## 开发原则

- 简单、直接、可维护、可部署
- 禁止过度设计
- 优先业务落地
- 优先快速上线
- 优先稳定运行

## 禁止使用

React / Vue / NextJS / Nuxt / Vite / Tailwind / TypeScript / Hono
用户系统 / 权限系统 / 多租户设计

## 许可证

Internal - 公司内部使用
