@echo off
REM Keeps the phone's path to the orchestrator alive.
REM
REM start-all.cmd only runs once, at logon — so anything that killed the bridge
REM or cloudflared mid-day (crash, network drop, OOM) left the phone dead until
REM the next reboot. This loops start-all.cmd forever; because that script skips
REM whatever is already running, each pass is a no-op when things are healthy
REM and a restart when they are not.
REM
REM Launched hidden at logon by supervise.vbs.
setlocal
set "LOG=%TEMP%\mcp-supervisor.log"
echo [%date% %time%] supervisor started (pid check every 30s) >> "%LOG%"

:loop
call "%~dp0start-all.cmd"
REM timeout fails without a console; ping -n is the portable sleep on Windows.
ping -n 31 127.0.0.1 >nul 2>&1
goto loop
