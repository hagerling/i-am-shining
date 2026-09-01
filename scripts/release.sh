#!/usr/bin/env bash
#
# release.sh — cut a new version of i-am-shining.
#
#   ./scripts/release.sh patch|minor|major   (or an explicit X.Y.Z)
#
# Does, in order:
#   1. bump the version in package.json (semver, no prerelease suffixes)
#   2. roll CHANGELOG.md's [Unreleased] -> [X.Y.Z] - YYYY-MM-DD and
#      prepend a fresh, empty [Unreleased]
#   3. typecheck + build
#   4. commit and tag vX.Y.Z
#
# It does NOT push and it does NOT deploy. Pushing and deploying are
# separate, deliberate steps.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m==>\033[0m %s\n' "$*"; }

BUMP="${1:-patch}"
DO_TAG=1
DO_BUILD=1
for arg in "${@:2}"; do
  case "$arg" in
    --no-tag)   DO_TAG=0 ;;
    --no-build) DO_BUILD=0 ;;
    *) die "unknown option: $arg" ;;
  esac
done

command -v node >/dev/null || die "node is required"
[ -f package.json ]  || die "package.json not found in $ROOT"
[ -f CHANGELOG.md ]  || die "CHANGELOG.md not found — create one with a '## [Unreleased]' section first"
grep -q '^## \[Unreleased\]' CHANGELOG.md \
  || die "CHANGELOG.md has no '## [Unreleased]' section"

# Refuse to release on top of a dirty tree — the commit below would sweep up
# unrelated work.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  die "working tree has uncommitted changes; commit or set them aside first"
fi

CURRENT=$(node -p "require('$ROOT/package.json').version")

case "$BUMP" in
  major|minor|patch)
    NEXT=$(node -e '
      const [maj, min, pat] = process.argv[1].split(".").map(Number);
      const kind = process.argv[2];
      const next = kind === "major" ? [maj + 1, 0, 0]
                 : kind === "minor" ? [maj, min + 1, 0]
                 : [maj, min, pat + 1];
      process.stdout.write(next.join("."));
    ' "$CURRENT" "$BUMP")
    ;;
  [0-9]*.[0-9]*.[0-9]*)
    NEXT="$BUMP"
    ;;
  *)
    die "usage: $0 patch|minor|major|X.Y.Z [--no-tag] [--no-build]"
    ;;
esac

# No prerelease suffixes — plain X.Y.Z only.
[[ "$NEXT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "invalid version: $NEXT"

DATE=$(date +%Y-%m-%d)
TAG="v$NEXT"

git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && die "tag $TAG already exists"

info "$CURRENT -> $NEXT  ($TAG, $DATE)"

# ── 1. package.json ────────────────────────────────────────────────────────
node -e '
  const fs = require("fs");
  const p = process.argv[1];
  const src = fs.readFileSync(p, "utf8");
  const out = src.replace(
    /("version"\s*:\s*")[^"]+(")/,
    `$1${process.argv[2]}$2`
  );
  if (out === src) { console.error("could not rewrite version in " + p); process.exit(1); }
  fs.writeFileSync(p, out);
' "$ROOT/package.json" "$NEXT"

# Keep the lockfile's version fields in step, without a full reinstall.
if [ -f package-lock.json ]; then
  npm pkg get version >/dev/null 2>&1 || true
  node -e '
    const fs = require("fs");
    const p = process.argv[1];
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    j.version = process.argv[2];
    if (j.packages && j.packages[""]) j.packages[""].version = process.argv[2];
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
  ' "$ROOT/package-lock.json" "$NEXT"
fi

# ── 2. CHANGELOG.md ────────────────────────────────────────────────────────
node -e '
  const fs = require("fs");
  const [p, version, date] = process.argv.slice(1);
  const src = fs.readFileSync(p, "utf8");
  const heading = /^## \[Unreleased\][^\n]*$/m;
  if (!heading.test(src)) { console.error("no [Unreleased] heading"); process.exit(1); }
  const out = src.replace(
    heading,
    `## [Unreleased]\n\n## [${version}] — ${date}`
  );
  fs.writeFileSync(p, out);
' "$ROOT/CHANGELOG.md" "$NEXT" "$DATE"

info "CHANGELOG rolled"

# ── 3. verify ──────────────────────────────────────────────────────────────
if [ "$DO_BUILD" -eq 1 ]; then
  info "typechecking"
  npx tsc --noEmit
  info "building"
  npm run build
fi

# ── 4. commit + tag ────────────────────────────────────────────────────────
git add package.json CHANGELOG.md
[ -f package-lock.json ] && git add package-lock.json
git commit -m "release: $TAG"

if [ "$DO_TAG" -eq 1 ]; then
  git tag -a "$TAG" -m "$TAG"
  info "tagged $TAG"
fi

cat <<EOF

$TAG is committed$( [ "$DO_TAG" -eq 1 ] && printf ' and tagged' ).

Nothing has been pushed or deployed. Next, deliberately:
  git push && git push origin $TAG
  npm run build:staging && npm run deploy:staging   # staging first
  npm run build && npm run deploy                   # production, on "ship" only
EOF
