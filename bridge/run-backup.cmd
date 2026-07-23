@echo off
REM One backup pass, output kept. Registered as a daily Scheduled Task by
REM install-backup-task.cmd.
REM
REM cases.json is months of irreplaceable history and, before this, had exactly
REM one copy on one drive. backup-data.mjs is careful and correct, but it was
REM manual-only — the last two runs before this task existed were days apart.
REM A backup that depends on someone remembering is not a backup.
REM
REM Set MCP_BACKUP_DIR in .env to a synced folder (OneDrive/Dropbox) so the
REM copy also survives a DRIVE failure, not just deletion/corruption. Left
REM unset it backs up to .\backups on the same drive — better than nothing, but
REM not disaster recovery.
setlocal
cd /d "%~dp0.."
if not exist "logs" mkdir "logs"
set "LOG=logs\backup.log"
echo [%date% %time%] --- backup run starting --- >> "%LOG%"
"C:\Program Files\nodejs\node.exe" backup-data.mjs >> "%LOG%" 2>&1
echo [%date% %time%] --- backup run finished (exit %errorlevel%) --- >> "%LOG%"
