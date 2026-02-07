# Run this script AFTER closing Cursor (and any other app using this project) to fix EPERM.
# Use short path so npm runs in a path without spaces.
# Run from: right-click -> Run with PowerShell, or: powershell -ExecutionPolicy Bypass -File "scripts\install-from-short-path.ps1"
$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot | Split-Path -Parent

Write-Host "Project: $projectRoot" -ForegroundColor Cyan
try {
  $fso = New-Object -ComObject Scripting.FileSystemObject
  $folder = $fso.GetFolder($projectRoot)
  $shortPath = $folder.ShortPath
} catch {
  $shortPath = $projectRoot
}
Write-Host "Short path: $shortPath" -ForegroundColor Cyan
Set-Location $shortPath

$nm = Join-Path $shortPath "node_modules"
if (Test-Path $nm) {
  Write-Host "Removing node_modules (required to fix EPERM / broken install)..." -ForegroundColor Yellow
  try {
    Remove-Item -Path $nm -Recurse -Force -ErrorAction Stop
    Write-Host "Removed." -ForegroundColor Green
  } catch {
    Write-Host "Could not remove node_modules: $_" -ForegroundColor Red
    Write-Host "Close Cursor and any terminal using this project, then run this script again." -ForegroundColor Yellow
    exit 1
  }
}

Write-Host "Running npm install..." -ForegroundColor Yellow
& npm install
if ($LASTEXITCODE -ne 0) {
  Write-Host "npm install failed. Try running this script as Administrator or from an external PowerShell." -ForegroundColor Red
  exit $LASTEXITCODE
}
Write-Host "Done. You can reopen Cursor and run: npm run dev" -ForegroundColor Green
