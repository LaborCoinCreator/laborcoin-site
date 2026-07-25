$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
python (Join-Path $PSScriptRoot "validate-site.py")
