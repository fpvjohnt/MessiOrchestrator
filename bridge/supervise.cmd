@echo off
REM Keeps the phone's path to the orchestrator alive.
REM
REM start-all.cmd only runs once, at logon — so anything that killed the bridge
REM or cloudflared mid-day (crash, network drop, OOM) left the phone dead until
REM the next reboot.
REM
REM This used to be the whole watchdog: a loop that called start-all.cmd every
REM 30s and leaned on that script's "skip whatever is already running" guards.
REM Those guards test for a listening socket and a process name, and BOTH stay
REM true for a component that has stopped doing its job — so a wedged bridge or
REM a tunnel with zero edge connections was reported healthy indefinitely, and
REM nothing told anyone either way.
REM
REM The watchdog is now supervisor.mjs, which probes for a real answer, kills
REM what it restarts, and raises alerts. This file's only remaining job is to
REM keep THAT process alive: if node exits for any reason, wait and relaunch,
REM so a crash in the watchdog doesn't quietly leave the box unwatched.
REM
REM Launched hidden at logon by supervise.vbs.
setlocal
set "LOG=%TEMP%\mcp-supervisor.log"
set "NODE=C:\Program Files\nodejs\node.exe"

:loop
echo [%date% %time%] starting supervisor.mjs >> "%LOG%"
"%NODE%" "%~dp0supervisor.mjs" >> "%LOG%" 2>&1
echo [%date% %time%] supervisor.mjs exited with %errorlevel% — relaunching in 10s >> "%LOG%"
REM timeout fails without a console; ping -n is the portable sleep on Windows.
ping -n 11 127.0.0.1 >nul 2>&1
goto loop
