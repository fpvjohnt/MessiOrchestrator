@echo off
REM Launcher for the orchestrator HTTP bridge. Reads MCP_BRIDGE_TOKEN out of
REM .env (which is gitignored) and starts the bridge. Registered as a per-user
REM scheduled task that fires at logon, so the phone keeps working after a
REM reboot without anyone starting a terminal by hand.
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
