@echo off
title Fix node_modules (run after closing Cursor)
echo.
echo Close Cursor first, then press any key to continue...
pause >nul
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-from-short-path.ps1"
echo.
pause
