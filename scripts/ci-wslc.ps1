param(
  [ValidateSet("all", "quick", "e2e")]
  [string]$Only = "all",
  [switch]$RebuildImage
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ImageName = "pupitre-ci:ubuntu24"

$hasImage = [bool](wslc images | Select-String -Pattern "pupitre-ci\s+ubuntu24" -Quiet)
if ($RebuildImage -or -not $hasImage) {
  wslc build -t $ImageName -f (Join-Path $PSScriptRoot "ci-wslc.Dockerfile") $RepoRoot
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$ContainerScript = @"
set -euo pipefail
export PNPM_HOME=/pnpm-store npm_config_store_dir=/pnpm-store/store
export ELECTRON_CACHE=/pnpm-store/electron ELECTRON_BUILDER_CACHE=/pnpm-store/electron-builder
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' --exclude '*/node_modules' --exclude '*/*/node_modules' \
  --exclude 'apps/desktop/out' --exclude 'apps/desktop/release' \
  --exclude 'apps/desktop/test-results' --exclude 'apps/desktop/playwright-report' \
  /src/ /work/
cd /work
pnpm install --frozen-lockfile
bash scripts/ci-verify.sh $Only
"@ -replace "`r`n", "`n"

wslc run --rm `
  --mount "type=bind,source=$RepoRoot,target=/src,readonly" `
  --mount "type=volume,source=pupitre-ci-work,target=/work" `
  --mount "type=volume,source=pupitre-ci-pnpm,target=/pnpm-store" `
  $ImageName bash -lc $ContainerScript

exit $LASTEXITCODE
