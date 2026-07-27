@echo off
setlocal
cd /d "%~dp0.."
python scripts\validate-site.py
if errorlevel 1 exit /b 1
if exist .git (
  git diff --check
  if errorlevel 1 exit /b 1
  git status --short
)
echo.
echo LaborCoin site checks completed successfully.
