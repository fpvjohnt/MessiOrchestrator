@echo off
REM Registers the daily data-backup job with Windows Task Scheduler.
REM
REM Companion to install-archive-task.cmd. The ops review found there was NO
REM scheduled backup at all — cases.json (months of history, addresses, legal
REM and medical questions) had one copy on one drive. This closes that.
REM
REM Runs at 03:45 — 15 minutes AFTER the archive job, so the backup captures the
REM freshly-archived state rather than racing it.
REM
REM To remove:   schtasks /delete /tn "MCP Backup Data" /f
REM To inspect:  schtasks /query /tn "MCP Backup Data" /v /fo list
REM To run now:  schtasks /run /tn "MCP Backup Data"
setlocal
set "TASK=MCP Backup Data"

schtasks /query /tn "%TASK%" >nul 2>&1
if %errorlevel% equ 0 (
  echo Task "%TASK%" already exists - replacing it.
)

REM /f replaces an existing definition rather than failing, so re-running this
REM after editing the schedule is safe and idempotent.
schtasks /create /tn "%TASK%" /tr "\"%~dp0run-backup.cmd\"" /sc DAILY /st 03:45 /f
if %errorlevel% neq 0 (
  echo.
  echo FAILED to register the task. Backups will NOT run on their own.
  exit /b 1
)

echo.
echo Registered. It will run daily at 03:45 and append to logs\backup.log.
echo For off-drive safety, set MCP_BACKUP_DIR in .env to a OneDrive/Dropbox folder.
echo Run it once now with:  schtasks /run /tn "MCP Backup Data"
exit /b 0
