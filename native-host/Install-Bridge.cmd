@echo off
setlocal
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Bridge.ps1"
set "qf_exit=%ERRORLEVEL%"
if not "%qf_exit%"=="0" echo QudadFlow bridge installation failed. See the message above.
if "%qf_exit%"=="0" echo QudadFlow bridge is ready. Return to the extension and click Recheck.
pause
exit /b %qf_exit%
