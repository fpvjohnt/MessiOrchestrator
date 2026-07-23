@echo off
REM Starts both halves of the phone's path to the orchestrator:
REM   1. the HTTP bridge  (localhost:8787)
REM   2. cloudflared      (mcp.johntapia.com -> the bridge)
REM
REM Neither survives a reboot on its own, and the tunnel is useless without the
REM bridge behind it, so they are started together. Launched at logon via a
REM shortcut in the Startup folder (no admin required, unlike a service).
REM
REM Safe to run twice — each half is skipped if already running.
setlocal enabledelayedexpansion
cd /d "%~dp0.."

REM --- bridge ---------------------------------------------------------------
REM Full paths for netstat/findstr/tasklist: if this ever runs with a shell that
REM puts Git Bash (or similar) ahead of System32 on PATH, the unix tools of the
REM same name get picked up and the checks silently misbehave.
netstat -ano | "%SystemRoot%\System32\findstr.exe" /r /c:"TCP.*:8787 .*LISTENING" >nul
if !errorlevel! equ 0 (
  echo [%date% %time%] bridge already listening on 8787, skipping >> "%TEMP%\mcp-startup.log"
) else (
  for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0..\.env") do (
    if "%%A"=="MCP_BRIDGE_TOKEN" set "MCP_BRIDGE_TOKEN=%%B"
  )
  if "!MCP_BRIDGE_TOKEN!"=="" (
    echo [%date% %time%] ERROR: MCP_BRIDGE_TOKEN missing from .env >> "%TEMP%\mcp-startup.log"
    exit /b 1
  )
  echo [%date% %time%] starting bridge >> "%TEMP%\mcp-startup.log"
  start "" /b "C:\Program Files\nodejs\node.exe" "%~dp0server.mjs" >> "%TEMP%\mcp-bridge.log" 2>&1
)

REM --- cloudflared ----------------------------------------------------------
"%SystemRoot%\System32\tasklist.exe" /fi "imagename eq cloudflared.exe" 2>nul | "%SystemRoot%\System32\findstr.exe" /i "cloudflared.exe" >nul
if !errorlevel! equ 0 (
  echo [%date% %time%] cloudflared already running, skipping >> "%TEMP%\mcp-startup.log"
) else (
  echo [%date% %time%] starting cloudflared >> "%TEMP%\mcp-startup.log"
  start "" /b "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel run mcp >> "%TEMP%\mcp-cloudflared.log" 2>&1
)
