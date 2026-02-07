# Run Vite dev server from 8.3 short path so Node doesn't break on "Client works" (spaces).
$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot | Split-Path -Parent
try {
  $fso = New-Object -ComObject Scripting.FileSystemObject
  $folder = $fso.GetFolder($projectRoot)
  $shortPath = $folder.ShortPath
} catch {
  $shortPath = $projectRoot
}

# Check for Vite using project root (same folder, avoids short-path quirks).
$viteJs = Join-Path $projectRoot "node_modules\vite\bin\vite.js"
if (-not (Test-Path $viteJs)) {
  Write-Host ""
  Write-Host "Vite not found (node_modules missing or broken)." -ForegroundColor Red
  Write-Host ""
  Write-Host "EPERM fix: Close Cursor completely, then run this in a NEW PowerShell:" -ForegroundColor Yellow
  Write-Host "  Set-Location `"$projectRoot`"; powershell -ExecutionPolicy Bypass -File .\scripts\install-from-short-path.ps1" -ForegroundColor White
  Write-Host ""
  Write-Host "Then reopen Cursor and run:  npm run dev" -ForegroundColor Yellow
  Write-Host ""
  exit 1
}

# Run from short path so Node/Vite don't hit path-with-spaces bugs.
Set-Location $shortPath
& node $viteJs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
