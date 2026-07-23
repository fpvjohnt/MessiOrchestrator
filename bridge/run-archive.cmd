@echo off
REM One archive pass, with its output kept. Registered as a daily Scheduled
REM Task by install-archive-task.cmd.
REM
REM This exists as its own script rather than being inlined into the task's
REM command line because a task that runs a bare node invocation discards
REM everything it printed. archive-cases.mjs reports the store size, what it
REM moved, and which cases can never be archived — a maintenance job whose
REM output nobody can read is indistinguishable from one that never ran.
setlocal
cd /d "%~dp0.."
if not exist "logs" mkdir "logs"
set "LOG=logs\archive.log"
echo [%date% %time%] --- archive run starting --- >> "%LOG%"
"C:\Program Files\nodejs\node.exe" archive-cases.mjs >> "%LOG%" 2>&1
echo [%date% %time%] --- archive run finished (exit %errorlevel%) --- >> "%LOG%"
