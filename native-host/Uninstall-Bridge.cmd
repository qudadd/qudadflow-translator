@echo off
setlocal
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Uninstall-Bridge.ps1"
set "qf_exit=%ERRORLEVEL%"
if not "%qf_exit%"=="0" echo QudadFlow bridge removal failed. See the message above.
pause
exit /b %qf_exit%
