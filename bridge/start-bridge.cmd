@echo off
REM ***** DEPRECATED / NOT WIRED — DO NOT USE. *****
REM
REM This is NOT the launcher anything runs. The live path is:
REM   Startup shortcut -> supervise.vbs -> supervise.cmd -> supervisor.mjs
REM   -> start-all.cmd -> server.mjs   (see OPERATIONS.md).
REM
REM The old header here claimed it was "registered as a per-user scheduled task
REM that fires at logon" — it never was. Worse, it starts the bridge with a BARE
REM environment, parsing only MCP_BRIDGE_TOKEN via the for/f loop below, so every
REM other setting server.mjs reads would be wrong. server.mjs now loads .env
REM itself (bridge/load-env.mjs), which makes this whole file obsolete. If anyone
REM wires it, they get a mis-configured SECOND bridge racing the real one on 8787.
REM Kept only so the deprecation is explicit rather than a silently dead file.
setlocal enabledelayedexpansion
cd /d "%~dp0.."

for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0..\.env") do (
  if "%%A"=="MCP_BRIDGE_TOKEN" set "MCP_BRIDGE_TOKEN=%%B"
)

if "!MCP_BRIDGE_TOKEN!"=="" (
  echo ERROR: MCP_BRIDGE_TOKEN not found in .env — refusing to start.
  exit /b 1
)

"C:\Program Files\nodejs\node.exe" "%~dp0server.mjs" >> "%TEMP%\mcp-bridge.log" 2>&1
