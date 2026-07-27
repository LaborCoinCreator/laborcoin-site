$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
python (Join-Path $PSScriptRoot "validate-site.py")
if (Test-Path (Join-Path $Root ".git")) {
  git -C $Root diff --check
  git -C $Root status --short
}
