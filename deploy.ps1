param(
    [string]$GitHubToken = "",
    [string]$CloudflareToken = ""
)

# Ecom Workflow V1 - One-click deploy script
$ErrorActionPreference = "Stop"
$PROJECT_DIR = "D:\DockerApps\Ecom_Workflow_System_V1"
$REPO_NAME = "ecom-workflow-v1"

Write-Host ("=" * 40) -ForegroundColor Cyan
Write-Host "  Ecom Workflow V1 - Deploy" -ForegroundColor Cyan
Write-Host ("=" * 40) -ForegroundColor Cyan
Write-Host ""

# --- Step 1: GitHub ---
Write-Host "[1/5] GitHub: create repo and push code" -ForegroundColor Yellow

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "  Installing gh CLI via winget..." -ForegroundColor DarkYellow
    winget install --id GitHub.cli -e --accept-source-agreements 2>$null
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        Write-Host "  Trying npm install..." -ForegroundColor DarkYellow
        npm install -g @githubnext/github-cli 2>$null
    }
}

if ($GitHubToken) {
    $env:GH_TOKEN = $GitHubToken
}

gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    if ($GitHubToken) {
        Write-Host "  Login with token..." -ForegroundColor Gray
        echo $GitHubToken | gh auth login --with-token
    } else {
        Write-Host "  Please login to GitHub in the browser..." -ForegroundColor Gray
        gh auth login --web -h github.com
    }
}

gh repo view $REPO_NAME 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Creating repo $REPO_NAME ..." -ForegroundColor Gray
    gh repo create $REPO_NAME --public --source=. --remote=origin --push
} else {
    Write-Host "  Repo exists, pushing..." -ForegroundColor Gray
    $ghUser = gh api user --jq .login
    git remote add origin "https://github.com/${ghUser}/${REPO_NAME}.git" 2>$null
    git push -u origin master
}
Write-Host "  [OK] GitHub done" -ForegroundColor Green
Write-Host ""

# --- Step 2: Cloudflare ---
Write-Host "[2/5] Cloudflare: login" -ForegroundColor Yellow

if ($CloudflareToken) {
    $env:CLOUDFLARE_API_TOKEN = $CloudflareToken
}

wrangler whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    if ($CloudflareToken) {
        Write-Host "  Config with token..." -ForegroundColor Gray
        wrangler config --api-token $CloudflareToken
    } else {
        Write-Host "  Please login to Cloudflare in the browser..." -ForegroundColor Gray
        wrangler login
    }
}
Write-Host "  [OK] Cloudflare login done" -ForegroundColor Green
Write-Host ""

# --- Step 3: D1 + R2 ---
Write-Host "[3/5] D1 database and R2 bucket" -ForegroundColor Yellow

$d1Result = wrangler d1 create ecom-workflow-db 2>&1
if ($LASTEXITCODE -eq 0 -and $d1Result -match 'database_id:\s*([a-f0-9-]+)') {
    $dbId = $matches[1]
    Write-Host "  D1 ID: $dbId" -ForegroundColor Gray
} else {
    Write-Host "  D1 exists, looking up..." -ForegroundColor DarkYellow
    $dbId = (wrangler d1 list --json | ConvertFrom-Json | Where-Object name -eq "ecom-workflow-db").uuid
}

if ($dbId) {
    $toml = Get-Content "wrangler.toml" -Raw
    $toml = $toml -replace 'database_id = ""', "database_id = `"$dbId`""
    Set-Content "wrangler.toml" -Value $toml
    Write-Host "  [OK] wrangler.toml updated" -ForegroundColor Green
}

Write-Host "  Initializing schema..." -ForegroundColor Gray
wrangler d1 execute ecom-workflow-db --file=database/schema.sql 2>$null
Write-Host "  [OK] Schema done" -ForegroundColor Green

wrangler r2 bucket create ecom-workflow-storage 2>$null
Write-Host "  [OK] R2 bucket ready" -ForegroundColor Green
Write-Host ""

# --- Step 4: Worker ---
Write-Host "[4/5] Deploying Worker" -ForegroundColor Yellow

$workerResult = wrangler deploy 2>&1
if ($workerResult -match 'https://([^\s]+)') {
    $workerUrl = $matches[0]
    Write-Host "  Worker: $workerUrl" -ForegroundColor Gray
}
Write-Host "  [OK] Worker deployed" -ForegroundColor Green
Write-Host ""

# --- Step 5: Pages ---
Write-Host "[5/5] Deploying Pages (Frontend)" -ForegroundColor Yellow

$pagesResult = wrangler pages deploy frontend --project-name=$REPO_NAME 2>&1
if ($pagesResult -match 'https://([^\s]+\.pages\.dev)') {
    $pagesUrl = $matches[0]
    Write-Host "  Pages: $pagesUrl" -ForegroundColor Gray
}
Write-Host "  [OK] Pages deployed" -ForegroundColor Green
Write-Host ""

# --- Done ---
Write-Host ("=" * 40) -ForegroundColor Cyan
Write-Host "  All done!" -ForegroundColor Cyan
Write-Host ("=" * 40) -ForegroundColor Cyan
Write-Host ""
Write-Host "  Frontend: $pagesUrl" -ForegroundColor White
Write-Host "  API:      $workerUrl" -ForegroundColor White
Write-Host ""
Write-Host "  N8N callback:" -ForegroundColor White
Write-Host "  POST $workerUrl/api/callback/job" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
Write-Host "  1. Make R2 bucket public:" -ForegroundColor DarkGray
Write-Host "     wrangler r2 bucket create ecom-workflow-storage --public" -ForegroundColor DarkGray
Write-Host "  2. Set R2_PUBLIC_URL in wrangler.toml" -ForegroundColor DarkGray
Write-Host "  3. If /api/* routing fails, add route in CF Dashboard" -ForegroundColor DarkGray