@echo off
title World Intel Dashboard
cd /d "%~dp0"
start "" http://localhost:8791
node server.mjs
pause
