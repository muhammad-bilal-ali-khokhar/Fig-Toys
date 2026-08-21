# PowerShell equivalent of run-app.sh for Windows.
#
# Usage:
#   .\scripts\run-app.ps1            # rebuild-if-needed, then run from source
#   .\scripts\run-app.ps1 --build    # always rebuild production bundles, run source
#   .\scripts\run-app.ps1 --dev      # run from source with --dev (live reload)
#   .\scripts\run-app.ps1 --app      # run an already-built packaged app (no rebuild)
#   .\scripts\run-app.ps1 --pack     # build the packaged app (--dir), then run it
#   .\scripts\run-app.ps1 --dist     # build the NSIS installer (.exe)
param(
    [string]$Mode,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Flags
)

$ValidModes = @("run","build","dev","app","pack","dist")
if (-not $Mode -and $Flags -and $Flags.Count -gt 0) {
    $Mode = $Flags[0] -replace '^-+',''
}
if ([string]::IsNullOrEmpty($Mode)) {
    $Mode = "run"
}
if ($ValidModes -notcontains $Mode) {
    Write-Host "Unknown option '$Mode'. Valid options: $($ValidModes | ForEach-Object { "--$_" })" -ForegroundColor Red
    exit 1
}

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot
$Desktop = Join-Path $Root "desktop"

# Stop any running instance so ports (47620/58340) free up.
Get-Process -Name "electron","Fig POS" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

function Find-Packaged {
    $unpacked = Join-Path $Desktop "release\win-unpacked"
    if (Test-Path $unpacked) {
        $exe = Get-ChildItem -Path $unpacked -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($exe) { return $exe.FullName }
    }
    return $null
}

function Run-Packaged {
    $exe = Find-Packaged
    if (-not $exe) {
        Write-Host "No packaged build found. Run: .\scripts\run-app.ps1 --pack" -ForegroundColor Red
        exit 1
    }
    Write-Host "Launching packaged app: $exe" -ForegroundColor Cyan
    Start-Process -FilePath $exe -NoNewWindow
}

# --app: just run the packaged exe
if ($Mode -eq "app") {
    Run-Packaged
    exit 0
}

# --pack: build bundles, then package, then run
if ($Mode -eq "pack") {
    $backendExists = Test-Path (Join-Path $Root "production\backend\server.cjs")
    $frontendExists = Test-Path (Join-Path $Root "production\frontend\server.js")
    if (-not $backendExists -or -not $frontendExists) {
        Push-Location (Join-Path $Root "frontend")
        $env:BACKEND_URL = "http://localhost:47620"
        npm run build
        Remove-Item Env:\BACKEND_URL -ErrorAction SilentlyContinue
        npm run build:production
        Pop-Location
        Push-Location (Join-Path $Root "backend")
        npm run build:production
        Pop-Location
    }
    Write-Host "Building packaged app (--dir, no publish)..." -ForegroundColor Cyan
    Push-Location $Desktop
    npm run pack
    Pop-Location
    Run-Packaged
    exit 0
}

# --dist: build production bundles, then the NSIS installer
if ($Mode -eq "dist") {
    $backendExists = Test-Path (Join-Path $Root "production\backend\server.cjs")
    $frontendExists = Test-Path (Join-Path $Root "production\frontend\server.js")
    if (-not $backendExists -or -not $frontendExists) {
        Write-Host "Building production bundles..." -ForegroundColor Cyan
        Push-Location (Join-Path $Root "frontend")
        $env:BACKEND_URL = "http://localhost:47620"
        npm run build
        Remove-Item Env:\BACKEND_URL -ErrorAction SilentlyContinue
        npm run build:production
        Pop-Location
        Push-Location (Join-Path $Root "backend")
        npm run build:production
        Pop-Location
    }
    Write-Host "Building NSIS installer..." -ForegroundColor Cyan
    Push-Location $Desktop
    npm run dist
    Pop-Location
    $installer = Get-ChildItem -Path (Join-Path $Desktop "release") -Filter "Fig-POS-Setup-*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($installer) {
        Write-Host "Installer built: $($installer.FullName)" -ForegroundColor Green
    } else {
        Write-Host "Installer not found in desktop\release\" -ForegroundColor Red
    }
    exit 0
}

# --dev: run from source with --dev flag (live reload, no child spawning)
if ($Mode -eq "dev") {
    Write-Host "Running from source with --dev (live reload)..." -ForegroundColor Cyan
    Push-Location $Desktop
    $electron = Join-Path $Desktop "node_modules\.bin\electron.cmd"
    & $electron . --dev
    Pop-Location
    exit 0
}

# Default / --build: build if needed, then run from source
$backendExists = Test-Path (Join-Path $Root "production\backend\server.cjs")
$frontendExists = Test-Path (Join-Path $Root "production\frontend\server.js")
$needBuild = -not $backendExists -or -not $frontendExists

if ($Mode -eq "build" -or $needBuild) {
    Write-Host "Building production bundles..." -ForegroundColor Cyan
    Push-Location (Join-Path $Root "frontend")
    $env:BACKEND_URL = "http://localhost:47620"
    npm run build
    Remove-Item Env:\BACKEND_URL -ErrorAction SilentlyContinue
    npm run build:production
    Pop-Location
    Push-Location (Join-Path $Root "backend")
    npm run build:production
    Pop-Location
}

Write-Host "Launching desktop app from production bundles..." -ForegroundColor Cyan
Push-Location $Desktop
$electron = Join-Path $Desktop "node_modules\.bin\electron.cmd"
& $electron .
Pop-Location
