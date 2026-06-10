@ECHO off
TITLE %~nx0

REM build opm
CMD /K "npm run build --silent&& EXIT"
ECHO build OK

REM push to remote
SET what_files=assets/opm.bat assets/services.json dist/opm.js assets/product-key.json assets/opm.sh
CALL mexec "rsync %what_files% cool:/httpd/dlc/opm/"

ECHO DONE
REM timeout /t 2 > nul
