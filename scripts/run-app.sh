#!/usr/bin/env bash
# Launch the Fig Mobile POS desktop app locally.
#
# The app can run two ways:
#   1. From source (electron .) — uses the production/ bundles (same code the
#      GitHub release packages).
#   2. From an already-packaged build (the actual .app/.exe the installer
#      produces) — this is the closest to what users get.
#
# Usage:
#   ./scripts/run-app.sh            # rebuild-if-needed, then run from source
#   ./scripts/run-app.sh --build    # always rebuild production bundles, run source
#   ./scripts/run-app.sh --dev      # run from source with --dev (live reload)
#   ./scripts/run-app.sh --app      # run an already-built packaged app (no rebuild)
#   ./scripts/run-app.sh --pack     # build the packaged app (--dir), then run it
#   ./scripts/run-app.sh --dist     # build the NSIS installer (.exe)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP="$ROOT/desktop"

MODE="run"
for arg in "$@"; do
  case "$arg" in
    --build) MODE="build" ;;
    --dev) MODE="dev" ;;
    --app) MODE="app" ;;
    --pack) MODE="pack" ;;
    --dist) MODE="dist" ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

# Stop any running instance so the ports (47620/58340) free up.
pkill -f "Fig Mobile POS" 2>/dev/null || true
pkill -f "$ROOT/desktop" 2>/dev/null || true
sleep 1

# Locate the packaged app. electron-builder --dir drops it in desktop/release
# (windows: win-unpacked/...exe). macOS is not a release target.
find_packaged() {
  local pkg=""
  pkg="$(ls "$DESKTOP"/release/win-unpacked/*.exe 2>/dev/null || true)"
  printf '%s\n' "$pkg" | head -1
}

run_packaged() {
  local pkg
  pkg="$(find_packaged)"
  if [ -z "$pkg" ]; then
    echo "No packaged build found. Run: ./scripts/run-app.sh --pack" >&2
    exit 1
  fi
  echo "Launching packaged app: $pkg"
  exec "$pkg"
}

if [ "$MODE" = "app" ]; then
  run_packaged
  exit 0
fi

if [ "$MODE" = "pack" ]; then
  # Ensure production bundles exist first (packaged app bundles them).
  if [ ! -f "$ROOT/production/backend/server.cjs" ] || [ ! -f "$ROOT/production/frontend/server.js" ]; then
    (cd "$ROOT/frontend" && BACKEND_URL=http://localhost:47620 npm run build)
    (cd "$ROOT/frontend" && npm run build:production)
    (cd "$ROOT/backend" && npm run build:production)
  fi
  echo "Building packaged app (--dir, no publish)..."
  (cd "$DESKTOP" && npm run pack)
  run_packaged
  exit 0
fi

if [ "$MODE" = "dist" ]; then
  if [ ! -f "$ROOT/production/backend/server.cjs" ] || [ ! -f "$ROOT/production/frontend/server.js" ]; then
    echo "Building production bundles..."
    (cd "$ROOT/frontend" && BACKEND_URL=http://localhost:47620 npm run build)
    (cd "$ROOT/frontend" && npm run build:production)
    (cd "$ROOT/backend" && npm run build:production)
  fi
  echo "Building NSIS installer..."
  (cd "$DESKTOP" && npm run dist)
  installer="$(ls "$DESKTOP"/release/Fig-POS-Setup-*.exe 2>/dev/null | head -1)"
  if [ -n "$installer" ]; then
    echo "Installer built: $installer"
  else
    echo "Installer not found in desktop/release/" >&2
  fi
  exit 0
fi

if [ "$MODE" = "dev" ]; then
  echo "Running from source with --dev (live reload)..."
  cd "$DESKTOP"
  exec ./node_modules/.bin/electron . --dev
fi

NEED_BUILD=0
if [ ! -f "$ROOT/production/backend/server.cjs" ] || [ ! -f "$ROOT/production/frontend/server.js" ]; then
  NEED_BUILD=1
fi

if [ "$MODE" = "build" ] || [ "$NEED_BUILD" = "1" ]; then
  echo "Building production bundles..."
  # BACKEND_URL is baked into the standalone server's proxy at build time. It
  # must match the port the desktop app spawns the backend on (47620), or the
  # frontend will proxy to the wrong place.
  (cd "$ROOT/frontend" && BACKEND_URL=http://localhost:47620 npm run build)
  (cd "$ROOT/frontend" && npm run build:production)
  (cd "$ROOT/backend" && npm run build:production)
fi

echo "Launching desktop app from production bundles..."
cd "$DESKTOP"
exec ./node_modules/.bin/electron .