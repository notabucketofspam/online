@ECHO off
TITLE %~nx0
ECHO Pushing base...
CD base
CALL mexec "./push.sh"
ECHO.
CD ..
ECHO Pushing opm...
CD opm
CALL __push.bat
timeout /t 10
