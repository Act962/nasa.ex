#!/usr/bin/env bash
# Empacota templates/orbita-remotion (sem node_modules/out) no zip baixado pela skill orbita-planner (spec 0066).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUTPUT="$ROOT/public/skills/orbita-planner/orbita-remotion.zip"
rm -f "$OUTPUT"
cd "$ROOT/templates"
zip -rq "$OUTPUT" orbita-remotion -x "orbita-remotion/node_modules/*" "orbita-remotion/out/*" "orbita-remotion/pnpm-lock.yaml"
echo "Gerado: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
