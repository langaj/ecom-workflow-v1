param(
    [string]$GitHubToken = "",
    [string]$CloudflareToken = ""
)

# Ecom Workflow V1 - 一键部署脚本
# 用法:
#   1. 直接运行: .\deploy.ps1
#   2. 或带 Token: .\deploy.ps1 -GitHubToken "ghp_xxx" -CloudflareToken "cf_xxx"

$ErrorActionPreference = "Stop"
$PROJECT_DIR = "D:\DockerApps\Ecom_Workflow_System_V1"
$REPO_NAME = "ecom-workflow-v1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Ecom Workflow V1 - 一键部署" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PROJECT_DIR

# ─── 第1步：GitHub ───────────────────────────────────────────────────────────
Write-Host "[1/5] GitHub 仓库创建与代码推送" -ForegroundColor Yellow

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    winget install --id GitHub.cli -e --accept-source-agreements 2>$null
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        Write-Host "  gh 未安装，尝试通过 npm 安装..." -ForegroundColor DarkYellow
        npm install -g @githubnext/github-cli 2>$null
    }
}

if ($GitHubToken) {
    $env:GH_TOKEN = $GitHubToken
}

# 检查 gh 是否已登录
gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    if ($GitHubToken) {
        Write-Host "  使用 Token 登录 GitHub..." -ForegroundColor Gray
        echo $GitHubToken | gh auth login --with-token
    } else {
        Write-Host "  请在弹出的浏览器窗口中登录 GitHub..." -ForegroundColor Gray
        gh auth login --web -h github.com
    }
}

# 创建 GitHub 仓库并推送
gh repo view $REPO_NAME 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  创建仓库 $REPO_NAME ..." -ForegroundColor Gray
    gh repo create $REPO_NAME --public --source=. --remote=origin --push
} else {
    Write-Host "  仓库已存在，推送代码..." -ForegroundColor Gray
    git remote add origin "https://github.com/$(gh api user --jq .login)/$REPO_NAME.git" 2>$null
    git push -u origin master
}
Write-Host "  ✅ GitHub 部署完成" -ForegroundColor Green
Write-Host ""

# ─── 第2步：Cloudflare 登录 ──────────────────────────────────────────────────
Write-Host "[2/5] Cloudflare 登录" -ForegroundColor Yellow

if ($CloudflareToken) {
    $env:CLOUDFLARE_API_TOKEN = $CloudflareToken
}

wrangler whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    if ($CloudflareToken) {
        Write-Host "  使用 Token 配置 Cloudflare..." -ForegroundColor Gray
        wrangler config --api-token $CloudflareToken
    } else {
        Write-Host "  请在弹出的浏览器中登录 Cloudflare..." -ForegroundColor Gray
        wrangler login
    }
}
Write-Host "  ✅ Cloudflare 登录完成" -ForegroundColor Green
Write-Host ""

# ─── 第3步：创建 D1 + R2 ─────────────────────────────────────────────────────
Write-Host "[3/5] 创建 D1 数据库 & R2 存储桶" -ForegroundColor Yellow

# 创建 D1
$d1Result = wrangler d1 create ecom-workflow-db 2>&1
if ($LASTEXITCODE -eq 0 -and $d1Result -match 'database_id:\s*([a-f0-9-]+)') {
    $dbId = $matches[1]
    Write-Host "  D1 数据库 ID: $dbId" -ForegroundColor Gray
} else {
    Write-Host "  D1 数据库可能已存在，尝试查找..." -ForegroundColor DarkYellow
    $dbId = (wrangler d1 list --json | ConvertFrom-Json | Where-Object name -eq "ecom-workflow-db").uuid
}

if ($dbId) {
    # 更新 wrangler.toml 中的 database_id
    $toml = Get-Content "wrangler.toml" -Raw
    $toml = $toml -replace 'database_id = ""', "database_id = `"$dbId`""
    Set-Content "wrangler.toml" -Value $toml
    Write-Host "  ✅ wrangler.toml 已更新 database_id" -ForegroundColor Green
}

# 执行数据库初始化
Write-Host "  初始化数据库表..." -ForegroundColor Gray
wrangler d1 execute ecom-workflow-db --file=database/schema.sql 2>$null
Write-Host "  ✅ 数据库表初始化完成" -ForegroundColor Green

# 创建 R2 存储桶
wrangler r2 bucket create ecom-workflow-storage 2>$null
Write-Host "  ✅ R2 存储桶就绪" -ForegroundColor Green
Write-Host ""

# ─── 第4步：部署 Worker ──────────────────────────────────────────────────────
Write-Host "[4/5] 部署 Worker" -ForegroundColor Yellow

$workerResult = wrangler deploy 2>&1
if ($workerResult -match 'https://([^\s]+)') {
    $workerUrl = $matches[0]
    Write-Host "  Worker 部署地址: $workerUrl" -ForegroundColor Gray
}
Write-Host "  ✅ Worker 部署完成" -ForegroundColor Green
Write-Host ""

# ─── 第5步：部署 Pages ──────────────────────────────────────────────────────
Write-Host "[5/5] 部署 Pages（前端）" -ForegroundColor Yellow

$pagesResult = wrangler pages deploy frontend --project-name=$REPO_NAME 2>&1
if ($pagesResult -match 'https://([^\s]+\.pages\.dev)') {
    $pagesUrl = $matches[0]
    Write-Host "  Pages 部署地址: $pagesUrl" -ForegroundColor Gray
}
Write-Host "  ✅ Pages 部署完成" -ForegroundColor Green
Write-Host ""

# ─── 完成 ────────────────────────────────────────────────────────────────────
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🎉 部署完成!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  前端地址: $pagesUrl" -ForegroundColor White
Write-Host "  Worker API: $workerUrl" -ForegroundColor White
Write-Host ""
Write-Host "  N8N 回调地址:" -ForegroundColor White
Write-Host "  POST $workerUrl/api/callback/job" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  R2 公开访问:" -ForegroundColor White
Write-Host "  wrangler r2 bucket create ecom-workflow-storage --public" -ForegroundColor DarkGray
Write-Host "  然后在 wrangler.toml 中设置 R2_PUBLIC_URL" -ForegroundColor DarkGray
Write-Host ""
Write-Host "提示: 如果 Pages 的 /api/* 路由没有自动指向 Worker，" -ForegroundColor DarkYellow
Write-Host "请在 Cloudflare Dashboard -> Workers & Pages 中手动添加路由。" -ForegroundColor DarkYellow
