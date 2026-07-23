@echo off
REM Starts both halves of the phone's path to the orchestrator:
REM   1. the HTTP bridge  (localhost:8787)
REM   2. cloudflared      (mcp.johntapia.com -> the bridge)
REM
REM Neither survives a reboot on its own, and the tunnel is useless without the
REM bridge behind it, so they are started together. Launched at logon via a
REM shortcut in the Startup folder (no admin required, unlike a service).
REM
REM Safe to run twice - each half is skipped if already running.
REM
REM ***** NO PIPES IN THIS FILE. *****
REM supervisor.mjs spawns this script with detached:true, and a detached cmd.exe
REM has no valid stdin - so findstr in a PIPELINE never sees EOF and blocks
REM forever. That is not theoretical: it hung 15 consecutive restart attempts and
REM left the bridge down for three hours while the supervisor logged "restarting"
REM every time. findstr reading a FILE does not block, so each check below
REM redirects to a temp file first. If you add a check here, do it the same way.
setlocal enabledelayedexpansion
cd /d "%~dp0.."

REM --force-bridge / --force-tunnel / --force skip the "already running" probe.
REM supervisor.mjs already knows the answer - it probed the port and killed the
REM listener before calling this - so it passes the flag rather than making this
REM script re-derive it.
set "FORCE_BRIDGE="
set "FORCE_TUNNEL="
for %%A in (%*) do (
  if /i "%%~A"=="--force-bridge" set "FORCE_BRIDGE=1"
  if /i "%%~A"=="--force-tunnel" set "FORCE_TUNNEL=1"
  if /i "%%~A"=="--force" (
    set "FORCE_BRIDGE=1"
    set "FORCE_TUNNEL=1"
  )
)

REM --- bridge ---------------------------------------------------------------
REM Full paths for netstat/findstr/tasklist: if this ever runs with a shell that
REM puts Git Bash (or similar) ahead of System32 on PATH, the unix tools of the
REM same name get picked up and the checks silently misbehave.
set "BRIDGE_RUNNING="
if not defined FORCE_BRIDGE (
  set "NETSTAT_TMP=%TEMP%\mcp-netstat-%RANDOM%%RANDOM%.tmp"
  netstat -ano > "!NETSTAT_TMP!" 2>nul
  "%SystemRoot%\System32\findstr.exe" /r /c:"TCP.*:8787 .*LISTENING" "!NETSTAT_TMP!" >nul
  if !errorlevel! equ 0 set "BRIDGE_RUNNING=1"
  del /q "!NETSTAT_TMP!" 2>nul
)
if defined BRIDGE_RUNNING (
  echo [%date% %time%] bridge already listening on 8787, skipping >> "%TEMP%\mcp-startup.log"
) else (
  REM No .env parsing here any more. server.mjs loads .env itself
  REM (bridge/load-env.mjs), so this script no longer needs to know anything
  REM about its contents. A missing or too-short token is refused by the bridge
  REM itself, which says what to do about it; that error lands in mcp-bridge.log.
  echo [%date% %time%] starting bridge >> "%TEMP%\mcp-startup.log"
  start "" /b "C:\Program Files\nodejs\node.exe" "%~dp0server.mjs" >> "%TEMP%\mcp-bridge.log" 2>&1
)

REM --- cloudflared ----------------------------------------------------------
set "TUNNEL_RUNNING="
if not defined FORCE_TUNNEL (
  set "TASKLIST_TMP=%TEMP%\mcp-tasklist-%RANDOM%%RANDOM%.tmp"
  "%SystemRoot%\System32\tasklist.exe" /fi "imagename eq cloudflared.exe" /nh > "!TASKLIST_TMP!" 2>nul
  "%SystemRoot%\System32\findstr.exe" /i "cloudflared.exe" "!TASKLIST_TMP!" >nul
  if !errorlevel! equ 0 set "TUNNEL_RUNNING=1"
  del /q "!TASKLIST_TMP!" 2>nul
)
if defined TUNNEL_RUNNING (
  echo [%date% %time%] cloudflared already running, skipping >> "%TEMP%\mcp-startup.log"
) else (
  echo [%date% %time%] starting cloudflared >> "%TEMP%\mcp-startup.log"
  REM --metrics is pinned so supervisor.mjs can probe /ready for the number of
  REM live connections to the Cloudflare edge - the only signal that separates
  REM "cloudflared.exe is running" from "the phone can actually reach us".
  REM Left unset, cloudflared picks its own port from a range it is free to
  REM change between releases, and the probe becomes a guess.
  start "" /b "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel run --metrics 127.0.0.1:20241 mcp >> "%TEMP%\mcp-cloudflared.log" 2>&1
)
