@ECHO off
TITLE _push.bat

REM build opm
CMD /C "tsc"

REM push to remote
SET what_files=assets/opm.bat assets/services.json dist/opm.js
pscp %what_files% OCI-cool:/httpd/dlc/opm/

ECHO DONE
timeout /t 10
