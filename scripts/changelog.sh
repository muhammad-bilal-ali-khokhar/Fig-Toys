#!/usr/bin/env bash
# Generate CHANGELOG.md from git tags + commit history, and (optionally) a
# release-notes file for a specific version being released.
#
# Usage:
#   ./scripts/changelog.sh            # regenerate current state ("Unreleased")
#   ./scripts/changelog.sh 0.1.2      # add a section for the version being released
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHANGELOG="$ROOT/CHANGELOG.md"
NEW_VERSION="${1:-}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repository" >&2
  exit 1
fi

if [ -n "$NEW_VERSION" ] && ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Version must be semver, e.g. 0.1.2" >&2
  exit 1
fi

# Tags sorted newest-first by semver.
TAGS=()
while IFS= read -r t; do
  TAGS+=("$t")
done < <(git tag --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' || true)

commits_for() {
  git log --format='%s' "$1" \
    | grep -vE '^v[0-9]+\.[0-9]+\.[0-9]+' \
    | grep -v '^Merge branch' \
    | grep -v '^Merge pull request' \
    || true
}

render_entries() {
  local range="$1" lines
  lines="$(commits_for "$range")"
  if [ -n "$lines" ]; then
    printf '%s\n' "$lines" | sed 's/^/- /'
  else
    echo "- No notable changes."
  fi
}

HEADER="# Changelog

All notable changes are documented here. Released sections are curated by hand
for clarity; \`scripts/changelog.sh\` prepends the newest version's section on
each release without overwriting earlier notes.

"

# Render the section for the version being released. Only the newest section is
# generated automatically; previously released sections are preserved verbatim
# so hand-written notes survive future releases.
render_new_section() {
  local version="$1" base="$2" range
  range="${base:+"$base..HEAD"}"
  [ -z "$range" ] && range="HEAD"

  echo "## v$version"
  echo
  echo "- Released on: $(date +%Y-%m-%d)"
  echo
  # Group commits by conventional-commit type for readable release notes.
  local lines
  lines="$(commits_for "$range")"
  if [ -n "$lines" ]; then
    printf '%s\n' "$lines" | sed 's/^/- /'
  else
    echo "- No notable changes."
  fi
  echo
}

{
  printf '%s' "$HEADER"

  if [ -n "$NEW_VERSION" ]; then
    base="${TAGS[0]:-}"
    render_new_section "$NEW_VERSION" "$base"
  fi

  # Preserve all existing version sections (already-released notes stay as-is):
  # drop the header up to the first version heading, then trim the leading blank.
  if [ -f "$CHANGELOG" ]; then
    sed '1,/^## /d' "$CHANGELOG" | sed '1{/^$/d;}'
  fi
} > "$CHANGELOG.tmp" && mv "$CHANGELOG.tmp" "$CHANGELOG"

echo "Wrote $CHANGELOG"

if [ -n "$NEW_VERSION" ]; then
  awk -v v="## v$NEW_VERSION" 'index($0, v)==1{p=1;next} /^## v[0-9]/{if(p)exit} p' "$CHANGELOG" > "$ROOT/.release-notes.md"
  echo "Wrote $ROOT/.release-notes.md"
fi