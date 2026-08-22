# release-local.ps1 — One-click Windows release (like GitHub Action but local).
#
# Does what .github/workflows/release.yml does, but on your Windows PC:
#   version bump → changelog → commit+tag+push → build frontend/backend →
#   package installer (.exe) → GitHub Release → R2 publish (latest.json).
# No artifact quota, no 6-12h wait.
#
# Usage:
#   .\scripts\release-local.ps1                # auto-bump patch (0.1.90 → 0.1.91)
#   .\scripts\release-local.ps1 -Version 0.1.91
#   .\scripts\release-local.ps1 -Version 0.1.91 -SkipBuild   # reuse existing desktop/release
#   .\scripts\release-local.ps1 -SkipTests     # faster build
#
# Prereqs: Node 22, Git, gh CLI (auth), R2 env in .r2.env or env vars.
param(
  [string]$Version = "",
  [switch]$SkipBuild,
  [switch]$SkipTests
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step([string]$msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Need([string]$cmd, [string]$hint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$cmd not found. $hint" }
}

Need "node" "Install Node 22"
Need "git"  "Install Git"
Need "gh"   "Install GitHub CLI and run gh auth login"
if (-not $SkipBuild) { Need "npx" "npm missing" }

# Load R2 env from .r2.env if present (same keys as GitHub Secrets)
$envFile = Join-Path $Root ".r2.env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $k,$v = $_.Split('=',2); $k=$k.Trim(); $v=$v.Trim()
    if ($k -and -not (Test-Path env:$k)) { Set-Item -Path env:$k -Value $v }
  }
}

# 1. Version
Step "Version"
if (-not $Version) {
  $cur = (Get-Content "$Root\desktop\package.json" | ConvertFrom-Json).version
  $parts = $cur.Split('.'); $parts[2] = [int]$parts[2] + 1; $Version = $parts -join '.'
  Write-Host "Auto-bump $cur → $Version" -ForegroundColor Yellow
}
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw "Version must be semver like 0.1.91" }
Write-Host "Releasing v$Version"

# bash helpers exist — use them (Git Bash on Windows)
$bash = Get-Command bash -ErrorAction SilentlyContinue
if ($bash) {
  Step "Bump version + changelog (scripts/version.sh & changelog.sh)"
  bash ./scripts/version.sh $Version
  bash ./scripts/changelog.sh $Version
} else {
  # Pure PowerShell fallback
  foreach ($f in @("backend/package.json","frontend/package.json","desktop/package.json")) {
    $p = Get-Content $f | ConvertFrom-Json; $p.version = $Version
    $p | ConvertTo-Json -Depth 10 | Set-Content $f -Encoding UTF8
    Write-Host "Set $Version in $f"
  }
  # changelog.sh is bash-only; warn if bash missing
  Write-Host "bash not found — skipping changelog.sh (run it manually)" -ForegroundColor Yellow
}

# Build curated release notes + cut docs/RELEASE_NOTES.md (same as release.yml)
Step "Cut release notes"
$notesPath = "$Root\docs\RELEASE_NOTES.md"
$lines = Get-Content $notesPath
$i = -1; for ($k=0; $k -lt $lines.Count; $k++) { if ($lines[$k].Trim() -eq "## Unreleased") { $i=$k; break } }
if ($i -eq -1) { throw "No ## Unreleased in docs/RELEASE_NOTES.md" }
$j = -1; for ($k=$i+1; $k -lt $lines.Count; $k++) { if ($lines[$k] -match '^## ') { $j=$k; break } }
if ($j -eq -1) { $j = $lines.Count }
$body = ($lines[($i+1)..($j-1)] -join "`n").Trim()
$rest = if ($j -lt $lines.Count) { ($lines[$j..($lines.Count-1)] -join "`n").Trim() } else { "" }
# .release-notes.md = just the body (GitHub Release body)
Set-Content -Path "$Root\.release-notes.md" -Value $body -Encoding UTF8
Write-Host "Wrote .release-notes.md ($($body.Length) chars)"
# docs/RELEASE_NOTES.md = Unreleased + new version + rest
$newContent = "## Unreleased`n`n## v$Version`n`n$body`n`n$rest`n"
Set-Content -Path $notesPath -Value $newContent -Encoding UTF8
Write-Host "Cut ## Unreleased → ## v$Version"

# 2. Commit + tag + push (like release.yml:86)
Step "Commit + tag + push"
git add backend/package.json frontend/package.json desktop/package.json CHANGELOG.md .release-notes.md docs/RELEASE_NOTES.md
# also stage any other tracked changes the user wants in this release (optional)
$status = git status --porcelain
if (-not $status) { Write-Host "No changes to commit (version already bumped?)" -ForegroundColor Yellow }
else { git commit -m "v$Version" }
git tag "v$Version" -f
git push origin main --tags
Write-Host "Pushed main + v$Version" -ForegroundColor Green

# 3. Build (like build-test.ps1 -Dist)
if (-not $SkipBuild) {
  Step "Build (frontend + backend + installer)"
  # reuse build-test.ps1 logic without re-asking
  if (-not $SkipTests) {
    Write-Host "Running tests & typecheck..."
    Push-Location "$Root\backend"; npm ci; npx prisma generate; npm test; Pop-Location
    Push-Location "$Root\frontend"; npm ci; npx tsc --noEmit; npm test; Pop-Location
  } else {
    Push-Location "$Root\backend"; npm ci; npx prisma generate; Pop-Location
    Push-Location "$Root\frontend"; npm ci; Pop-Location
  }
  Push-Location "$Root\desktop"; npm ci; Pop-Location

  Push-Location "$Root\frontend"
  $env:BACKEND_URL = "http://localhost:47620"
  npm run build
  npm run build:production
  Pop-Location

  Push-Location "$Root\desktop"; npm run rebuild; Pop-Location
  Push-Location "$Root\backend"; npm run build:production; Pop-Location
  Push-Location "$Root\desktop"
  npm run dist:win
  # no-install zip
  $ver = (Get-Content "package.json" | ConvertFrom-Json).version
  if (Test-Path "release/win-unpacked") {
    $zip = "release/Fig.Mobile.POS-$ver-no-install.zip"
    if (Get-Command tar -ErrorAction SilentlyContinue) { tar -a -c -f $zip -C release/win-unpacked . }
    else { Compress-Archive -Path release/win-unpacked/* -DestinationPath $zip -Force }
    Write-Host "Zipped $zip"
  }
  Pop-Location
  Get-ChildItem "$Root\desktop\release\*.exe" | ForEach-Object { Write-Host "  $($_.FullName) ($([math]::Round($_.Length/1MB,1)) MB)" -ForegroundColor Green }
} else {
  Write-Host "SkipBuild — reusing existing desktop/release" -ForegroundColor Yellow
}

# 4. GitHub Release (like softprops/action-gh-release)
Step "GitHub Release"
$exe = Get-ChildItem "$Root\desktop\release\*.exe" -Exclude *.blockmap | Select-Object -First 1
if (-not $exe) { throw "No .exe in desktop/release — build failed" }
$files = @($exe.FullName)
$yml = Join-Path "$Root\desktop\release\latest.yml"; if (Test-Path $yml) { $files += $yml }
$bm = Get-ChildItem "$Root\desktop\release\*.exe.blockmap" | Select-Object -First 1; if ($bm) { $files += $bm.FullName }
# delete existing release if re-running same version
gh release view "v$Version" 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { Write-Host "Deleting existing release v$Version..."; gh release delete "v$Version" --yes }
gh release create "v$Version" --title "v$Version" --notes-file "$Root\.release-notes.md" $files
Write-Host "Created https://github.com/arsalanwahab/Fig-POS/releases/tag/v$Version" -ForegroundColor Green

# 5. R2 publish (like release.yml Publish to R2)
Step "Publish to R2 (download.myko.pk)"
$required = @("R2_ACCOUNT_ID","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET","R2_PUBLIC_URL")
$missing = $required | Where-Object { -not (Test-Path env:$_) -or -not (Get-Item env:$_).Value }
if ($missing) {
  Write-Host "Missing R2 env: $($missing -join ', ') — set them in .r2.env or env vars, then run:" -ForegroundColor Yellow
  Write-Host "  `$env:R2_VERSION='$Version'; `$env:R2_SOURCE_DIR='desktop/release'; `$env:R2_CONTENT_DIR='production'; node scripts/publish-to-r2.mjs" -ForegroundColor Yellow
} else {
  $env:R2_VERSION = $Version
  $env:R2_SOURCE_DIR = "desktop/release"
  $env:R2_CONTENT_DIR = "production"
  node scripts/publish-to-r2.mjs
}

Write-Host "`nDone. Check:" -ForegroundColor Green
Write-Host "  https://download.myko.pk/latest.json"
Write-Host "  https://download.myko.pk/versions.json"
Write-Host "  https://fig.myko.pk/ (Pages auto-deploys on push)"
