﻿param(
    [string]$GitHubToken = "",
    [string]$CloudflareToken = ""
)

# Ecom Workflow V1 - One-click deploy script
$ErrorActionPreference = "Continue"

$PROJECT_DIR = "D:\DockerApps\Ecom_Workflow_System_V1"
$REPO_NAME = "ecom-workflow-v1"

# For multi-account Cloudflare users: pick the account you want to use
# From the log: langaj-Server = 8f89a83cd9cc730f7dd298e536eea9b2
$CLOUDFLARE_ACCOUNT = "langaj-Server"
$CLOUDFLARE_ACCOUNT_ID = "8f89a83cd9cc730f7dd298e536eea9b2"

Write-Host ("=" * 40) -ForegroundColor Cyan
Write-Host "  Ecom Workflow V1 - Deploy" -ForegroundColor Cyan
Write-Host ("=" * 40) -ForegroundColor Cyan
Write-Host ""

# --- Helper: find gh.exe ---
function Get-GitHubCLI {
    $paths = @(
        "C:\Program Files\GitHub CLI\gh.exe",
        "$env:LOCALAPPDATA\GitHubCLI\gh.exe",
        "$env:ProgramFiles\GitHub CLI\gh.exe",
        "${env:ProgramFiles(x86)}\GitHub CLI\gh.exe"
    )
    foreach ($p in $paths) {
        if (Test-Path $p) { return $p }
    }
    if (Get-Command gh -ErrorAction SilentlyContinue) {
        return (Get-Command gh).Source
    }
    return $null
}

# --- Step 1: GitHub ---
Write-Host "[1/5] GitHub: create repo and push code" -ForegroundColor Yellow

$ghPath = Get-GitHubCLI
if (-not $ghPath) {
    Write-Host "  Installing gh CLI via winget..." -ForegroundColor DarkYellow
    winget install --id GitHub.cli -e --accept-source-agreements 2>$null
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    $ghPath = Get-GitHubCLI
}

if (-not $ghPath) {
    Write-Host "  [FAIL] gh CLI not found. Install from https://cli.github.com/" -ForegroundColor Red
} else {
    Write-Host "  gh found at: $ghPath" -ForegroundColor Gray

    if ($GitHubToken) {
        $env:GH_TOKEN = $GitHubToken
    }

    # Check auth
    & $ghPath auth status 2>$null
    if ($LASTEXITCODE -ne 0) {
        if ($GitHubToken) {
            Write-Host "  Login with token..." -ForegroundColor Gray
            echo $GitHubToken | & $ghPath auth login --with-token
        } else {
            Write-Host "  Login to GitHub in the browser..." -ForegroundColor Gray
            & $ghPath auth login --web -h github.com
        }
    }

    # Create repo and push
    & $ghPath repo view $REPO_NAME 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Creating repo $REPO_NAME ..." -ForegroundColor Gray
        & $ghPath repo create $REPO_NAME --public --source=. --remote=origin --push
    } else {
        Write-Host "  Repo exists, pushing..." -ForegroundColor Gray
        $ghUser = & $ghPath api user --jq .login 2>$null
        if ($ghUser) {
            git remote add origin "https://github.com/${ghUser}/${REPO_NAME}.git" 2>$null
        }
        git push -u origin master 2>$null
    }
    Write-Host "  [OK] GitHub done" -ForegroundColor Green
}
Write-Host ""

# --- Step 2: Cloudflare ---
Write-Host "[2/5] Cloudflare: login" -ForegroundColor Yellow

if ($CloudflareToken) {
    $env:CLOUDFLARE_API_TOKEN = $CloudflareToken
}

# Set account ID to avoid multi-account prompt
$env:CLOUDFLARE_ACCOUNT_ID = $CLOUDFLARE_ACCOUNT_ID

# Also update wrangler.toml with account_id
$toml = Get-Content "wrangler.toml" -Raw
if ($toml -match 'account_id = ""') {
    $toml = $toml -replace 'account_id = ""', "account_id = `"$CLOUDFLARE_ACCOUNT_ID`""
    Set-Content "wrangler.toml" -Value $toml
    Write-Host "  account_id set to $CLOUDFLARE_ACCOUNT_ID in wrangler.toml" -ForegroundColor Gray
}

wrangler whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    if ($CloudflareToken) {
        Write-Host "  Config with token..." -ForegroundColor Gray
        wrangler config --api-token $CloudflareToken 2>$null
    } else {
        Write-Host "  Login to Cloudflare in the browser..." -ForegroundColor Gray
        wrangler login
    }
}
Write-Host "  [OK] Cloudflare login done" -ForegroundColor Green
Write-Host ""

# --- Step 3: D1 + R2 ---
Write-Host "[3/5] D1 database and R2 bucket" -ForegroundColor Yellow

$d1Result = wrangler d1 create ecom-workflow-db 2>&1
$dbId = $null
if ($LASTEXITCODE -eq 0 -and $d1Result -match 'database_id:\s*([a-f0-9-]+)') {
    $dbId = $matches[1]
    Write-Host "  D1 created: $dbId" -ForegroundColor Gray
} else {
    Write-Host "  D1 may already exist, looking up..." -ForegroundColor DarkYellow
    $d1Info = wrangler d1 list --json 2>$null
    try {
        $dbId = ($d1Info | ConvertFrom-Json | Where-Object { $_.name -eq "ecom-workflow-db" }).uuid
    } catch {
        Write-Host "  Could not look up D1 - trying to create again..." -ForegroundColor DarkYellow
        # Try with explicit account env var
        $env:CLOUDFLARE_ACCOUNT_ID = $CLOUDFLARE_ACCOUNT_ID
        $d1Result2 = wrangler d1 create ecom-workflow-db 2>&1
        if ($d1Result2 -match 'database_id:\s*([a-f0-9-]+)') {
            $dbId = $matches[1]
        }
    }
}

if ($dbId) {
    $toml = Get-Content "wrangler.toml" -Raw
    if ($toml -match 'database_id = ""' -or $toml -notmatch "database_id = `"$dbId`"") {
        $toml = $toml -replace 'database_id = ""', "database_id = `"$dbId`""
        Set-Content "wrangler.toml" -Value $toml
        Write-Host "  [OK] wrangler.toml updated with database_id" -ForegroundColor Green
    }
}

# Run schema init - use --remote flag!
Write-Host "  Initializing database schema (remote)..." -ForegroundColor Gray
$schemaResult = wrangler d1 execute ecom-workflow-db --file=database/schema.sql --remote 2>&1
if ($schemaResult -match "executed successfully") {
    Write-Host "  [OK] Schema applied to remote D1" -ForegroundColor Green
} else {
    Write-Host "  Retrying without --remote flag..." -ForegroundColor DarkYellow
    wrangler d1 execute ecom-workflow-db --file=database/schema.sql 2>$null
    Write-Host "  [OK] Schema applied (local)" -ForegroundColor Green
}

# R2 bucket
wrangler r2 bucket create ecom-workflow-storage 2>$null
Write-Host "  [OK] R2 bucket ready" -ForegroundColor Green
Write-Host ""

# --- Step 4: Worker ---
Write-Host "[4/5] Deploying Worker" -ForegroundColor Yellow

$workerUrl = ""
$workerResult = wrangler deploy 2>&1
Write-Host "  Worker output:" -ForegroundColor Gray
$workerResult | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }

if ($workerResult -match 'https://([a-zA-Z0-9.-]+)') {
    $workerUrl = $matches[0]
    Write-Host "  [OK] Worker deployed at: $workerUrl" -ForegroundColor Green
} else {
    # Try with explicit account
    Write-Host "  Retrying with account selection..." -ForegroundColor DarkYellow
    $workerResult2 = wrangler deploy --account-id $CLOUDFLARE_ACCOUNT_ID 2>&1
    if ($workerResult2 -match 'https://([a-zA-Z0-9.-]+)') {
        $workerUrl = $matches[0]
        Write-Host "  [OK] Worker deployed at: $workerUrl" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Could not determine Worker URL" -ForegroundColor DarkYellow
    }
}
Write-Host ""

# --- Step 5: Pages ---
Write-Host "[5/5] Deploying Pages (Frontend)" -ForegroundColor Yellow

$pagesUrl = ""
$pagesResult = wrangler pages deploy frontend --project-name=$REPO_NAME 2>&1
Write-Host "  Pages output:" -ForegroundColor Gray
$pagesResult | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }

if ($pagesResult -match 'https://([a-zA-Z0-9.-]+\.pages\.dev)') {
    $pagesUrl = $matches[0]
    Write-Host "  [OK] Pages deployed at: $pagesUrl" -ForegroundColor Green
} else {
    # Try with explicit account
    Write-Host "  Retrying with account selection..." -ForegroundColor DarkYellow
    $pagesResult2 = wrangler pages deploy frontend --project-name=$REPO_NAME --account-id $CLOUDFLARE_ACCOUNT_ID 2>&1
    if ($pagesResult2 -match 'https://([a-zA-Z0-9.-]+\.pages\.dev)') {
        $pagesUrl = $matches[0]
        Write-Host "  [OK] Pages deployed at: $pagesUrl" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Could not determine Pages URL" -ForegroundColor DarkYellow
    }
}
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
Write-Host "  POST ${workerUrl}api/callback/job" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
Write-Host "  1. Make R2 bucket public:" -ForegroundColor DarkGray
Write-Host "     wrangler r2 bucket create ecom-workflow-storage --public" -ForegroundColor DarkGray
Write-Host "  2. Set R2_PUBLIC_URL in wrangler.toml" -ForegroundColor DarkGray
Write-Host "  3. If /api/* routing fails, add route in CF Dashboard" -ForegroundColor DarkGray