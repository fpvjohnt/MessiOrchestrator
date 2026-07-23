@echo off
REM Registers the daily case-archive job with Windows Task Scheduler.
REM
REM archive-cases.mjs bounds the growth of data/cases.json, which every
REM task_asset call rewrites in full. But it only bounds anything if it runs,
REM and nothing ever ran it — the script's own header said "wire it to a
REM scheduled task" and no one did. Seventeen days of use put cases.json at
REM 1.5 MB and climbing ~90 KB/day.
REM
REM Runs as the current user at 03:30 daily. No admin rights needed: this
REM registers a per-user task, the same way the bridge is started from the
REM Startup folder rather than installed as a service.
REM
REM To remove:   schtasks /delete /tn "MCP Archive Cases" /f
REM To inspect:  schtasks /query /tn "MCP Archive Cases" /v /fo list
REM To run now:  schtasks /run /tn "MCP Archive Cases"
setlocal
set "TASK=MCP Archive Cases"

schtasks /query /tn "%TASK%" >nul 2>&1
if %errorlevel% equ 0 (
  echo Task "%TASK%" already exists - replacing it.
)

REM /f replaces an existing definition rather than failing, so re-running this
REM after editing the schedule is safe and idempotent.
schtasks /create /tn "%TASK%" /tr "\"%~dp0run-archive.cmd\"" /sc DAILY /st 03:30 /f
if %errorlevel% neq 0 (
  echo.
  echo FAILED to register the task. The archive job will NOT run on its own.
  exit /b 1
)

REM See install-backup-task.cmd for the rationale: schtasks defaults skip the job
REM silently on battery/sleep with no catch-up. Fix that via PowerShell. The
REM archive MUST catch up — if it is skipped, cases.json keeps growing unbounded
REM (~90 KB/day), which is the exact problem this task exists to prevent.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -WakeToRun -ExecutionTimeLimit (New-TimeSpan -Hours 1); Set-ScheduledTask -TaskName '%TASK%' -Settings $s | Out-Null"
if %errorlevel% neq 0 echo WARNING: task registered but battery/catch-up settings did not apply.

echo.
echo Registered. It will run daily at 03:30 (catches up on next wake if missed)
echo and append to logs\archive.log.
echo Run it once now with:  schtasks /run /tn "%TASK%"
exit /b 0
