@echo off
setlocal
set "MODE=run"
if /i "%~1"=="--build" set "MODE=build"
if /i "%~1"=="--dev" set "MODE=dev"
if /i "%~1"=="--app" set "MODE=app"
if /i "%~1"=="--pack" set "MODE=pack"
if /i "%~1"=="--dist" set "MODE=dist"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-app.ps1" -Mode %MODE%
