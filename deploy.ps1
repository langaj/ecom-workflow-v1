param(
    [string]$GitHubToken = "",
    [string]$CloudflareToken = ""
)

$ErrorActionPreference = "Continue"
$REPO_NAME = "ecom-workflow-v1"
$CLOUDFLARE_ACCOUNT_ID = "8f89a83cd9cc730f7dd298e536eea9b2"

Write-Host ("=" * 40) -ForegroundColor Cyan
Write-Host "  Ecom Workflow V1 - Deploy" -ForegroundColor Cyan
Write-Host ("=" * 40) -ForegroundColor Cyan
Write-Host ""

function Find-GhExe {
    $paths = @("C:\Program Files\GitHub CLI\gh.exe", "$env:LOCALAPPDATA\GitHubCLI\gh.exe")
    foreach ($p in $paths) { if (Test-Path $p) { return $p } }
    $cmd = Get-Command gh -ErrorAction SilentlyContinue
    return $cmd.Source
}

# Step 1: GitHub
Write-Host "[1/5] GitHub: create repo and push code" -ForegroundColor Yellow
$gh = Find-GhExe
if (-not $gh) {
    Write-Host "  Installing gh CLI via winget..." -ForegroundColor DarkYellow
    winget install --id GitHub.cli -e --accept-source-agreements 2>$null
    $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
    $gh = Find-GhExe
}
if ($gh) {
    Write-Host "  gh: $gh" -ForegroundColor Gray
    if ($GitHubToken) { $env:GH_TOKEN = $GitHubToken }
    & $gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) {
        if ($GitHubToken) { echo $GitHubToken | & $gh auth login --with-token }
        else { & $gh auth login --web -h github.com }
    }
    & $gh repo view $REPO_NAME 2>$null
    if ($LASTEXITCODE -ne 0) {
        & $gh repo create $REPO_NAME --public --source=. --remote=origin --push
    } else {
        $user = & $gh api user --jq .login 2>$null
        if ($user) { git remote add origin "https://github.com/${user}/${REPO_NAME}.git" 2>$null }
        git push -u origin master 2>$null
    }
    Write-Host "  [OK] GitHub done" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Install gh from https://cli.github.com/" -ForegroundColor Red
}
Write-Host ""

# Step 2: Cloudflare
Write-Host "[2/5] Cloudflare: login" -ForegroundColor Yellow
$env:CLOUDFLARE_ACCOUNT_ID = $CLOUDFLARE_ACCOUNT_ID
if ($CloudflareToken) { $env:CLOUDFLARE_API_TOKEN = $CloudflareToken }
wrangler whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    if ($CloudflareToken) { wrangler config --api-token $CloudflareToken 2>$null }
    else { wrangler login }
}
Write-Host "  [OK] Cloudflare done" -ForegroundColor Green
Write-Host ""

# Step 3: D1 + R2
Write-Host "[3/5] D1 database and R2 bucket" -ForegroundColor Yellow
$r = wrangler d1 create ecom-workflow-db 2>&1
if ($r -match 'database_id:\s*([a-f0-9-]+)') {
    $dbId = $matches[1]
} else {
    Write-Host "  Looking up existing D1..." -ForegroundColor DarkYellow
    $j = wrangler d1 list --json 2>$null
    try { $dbId = ($j | ConvertFrom-Json | Where-Object name -eq "ecom-workflow-db").uuid } catch {}
    if (-not $dbId) {
        $env:CLOUDFLARE_ACCOUNT_ID = $CLOUDFLARE_ACCOUNT_ID
        $r2 = wrangler d1 create ecom-workflow-db 2>&1
        if ($r2 -match 'database_id:\s*([a-f0-9-]+)') { $dbId = $matches[1] }
    }
}
if ($dbId) {
    $toml = Get-Content wrangler.toml -Raw
    $toml = $toml -replace 'database_id = "CHANGE_ME"', "database_id = `"$dbId`""
    Set-Content wrangler.toml -Value $toml
    Write-Host "  [OK] wrangler.toml updated" -ForegroundColor Green
}
Write-Host "  Running schema (remote)..." -ForegroundColor Gray
wrangler d1 execute ecom-workflow-db --file=database/schema.sql --remote 2>$null
Write-Host "  [OK] Schema done" -ForegroundColor Green
wrangler r2 bucket create ecom-workflow-storage 2>$null
Write-Host "  [OK] R2 ready" -ForegroundColor Green
Write-Host ""

# Step 4: Worker
Write-Host "[4/5] Deploying Worker" -ForegroundColor Yellow
$wr = wrangler deploy 2>&1
$wr
$wrText = ($wr | Out-String)
$wu = if ($wrText -match 'https://([a-zA-Z0-9.-]+\.workers\.dev)') { $matches[0] }
if (-not $wu) {
    $wr2 = wrangler deploy --account-id $CLOUDFLARE_ACCOUNT_ID 2>&1
    $wr2
    $wrText2 = ($wr2 | Out-String)
    $wu = if ($wrText2 -match 'https://([a-zA-Z0-9.-]+\.workers\.dev)') { $matches[0] }
}
Write-Host "  [OK] Worker: $wu" -ForegroundColor Green
Write-Host ""

# Step 5: Pages
Write-Host "[5/5] Deploying Pages (Frontend)" -ForegroundColor Yellow
$pr = wrangler pages deploy frontend --project-name=$REPO_NAME 2>&1
$pr
$prText = ($pr | Out-String)
$pu = if ($prText -match 'https://([a-zA-Z0-9.-]+\.pages\.dev)') { $matches[0] }
if (-not $pu) {
    $pr2 = wrangler pages deploy frontend --project-name=$REPO_NAME --account-id $CLOUDFLARE_ACCOUNT_ID 2>&1
    $pr2
    $prText2 = ($pr2 | Out-String)
    $pu = if ($prText2 -match 'https://([a-zA-Z0-9.-]+\.pages\.dev)') { $matches[0] }
}
Write-Host "  [OK] Pages: $pu" -ForegroundColor Green
Write-Host ""

# Done
Write-Host ("=" * 40) -ForegroundColor Cyan
Write-Host "  All done!" -ForegroundColor Cyan
Write-Host ("=" * 40) -ForegroundColor Cyan
Write-Host ""
Write-Host "  Frontend: $pu" -ForegroundColor White
Write-Host "  API:      $wu" -ForegroundColor White
Write-Host ""
Write-Host "  N8N callback: POST ${wu}api/callback/job" -ForegroundColor White
Write-Host ""
Write-Host "  Next:" -ForegroundColor White
Write-Host "  1. wrangler r2 bucket create ecom-workflow-storage --public" -ForegroundColor DarkGray
Write-Host "  2. Set R2_PUBLIC_URL in wrangler.toml" -ForegroundColor DarkGray
Write-Host "  3. Add /api/* route in CF Dashboard if needed" -ForegroundColor DarkGray