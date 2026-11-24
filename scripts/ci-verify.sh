#!/usr/bin/env bash
set -euo pipefail

only="${1:-all}"

if [[ "$only" == "e2e" ]]; then
  pnpm run build
  xvfb-run -a pnpm run test:e2e
  exit 0
fi

pnpm run lint
pnpm run typecheck
pnpm run knip
pnpm run test:coverage
pnpm run build
pnpm run check:bundle

if [[ "$only" == "quick" ]]; then
  exit 0
fi

(
  cd apps/desktop
  pnpm exec electron-builder --linux dir
  fuses="$(FORCE_COLOR=0 pnpm run check:fuses)"
  echo "$fuses"
  grep -q "RunAsNode is Disabled" <<< "$fuses"
  grep -q "OnlyLoadAppFromAsar is Enabled" <<< "$fuses"
)

xvfb-run -a pnpm run test:e2e
pnpm run build:web
