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
  REM No .env parsing here any more. This used to pull MCP_BRIDGE_TOKEN out of
  REM the file and set that one variable, which meant every OTHER setting
  REM server.mjs reads came from an environment that could never contain it —
  REM MCP_BRIDGE_PORT and friends silently fell back to their defaults however
  REM they were configured. server.mjs now loads .env itself (bridge/load-env.mjs),
  REM so this script no longer needs to know anything about its contents, and a
  REM batch `for /f` no longer has to parse a file full of URLs and secrets.
  REM A missing or too-short token is refused by the bridge itself, which says
  REM what to do about it; that error lands in mcp-bridge.log.
  echo [%date% %time%] starting bridge >> "%TEMP%\mcp-startup.log"
  start "" /b "C:\Program Files\nodejs\node.exe" "%~dp0server.mjs" >> "%TEMP%\mcp-bridge.log" 2>&1
)

REM --- cloudflared ----------------------------------------------------------
"%SystemRoot%\System32\tasklist.exe" /fi "imagename eq cloudflared.exe" 2>nul | "%SystemRoot%\System32\findstr.exe" /i "cloudflared.exe" >nul
if !errorlevel! equ 0 (
  echo [%date% %time%] cloudflared already running, skipping >> "%TEMP%\mcp-startup.log"
) else (
  echo [%date% %time%] starting cloudflared >> "%TEMP%\mcp-startup.log"
  REM --metrics is pinned so supervisor.mjs can probe /ready for the number of
  REM live connections to the Cloudflare edge — the only signal that separates
  REM "cloudflared.exe is running" from "the phone can actually reach us".
  REM Left unset, cloudflared picks its own port from a range it is free to
  REM change between releases, and the probe becomes a guess.
  start "" /b "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel run --metrics 127.0.0.1:20241 mcp >> "%TEMP%\mcp-cloudflared.log" 2>&1
)
