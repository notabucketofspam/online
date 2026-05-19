@ECHO off
TITLE copium %~nx0

REM build copium
CMD /K "__build.bat&& EXIT"

REM push to remote
SET what_files=build\*
pscp %what_files% OCI-cool:/httpd/dlc/copium/

ECHO DONE
timeout /t 2 > nul
