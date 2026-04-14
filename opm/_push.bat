@ECHO off
TITLE _push.bat

REM build/compress SEA
CMD /C "tsc"
node --build-sea sea-config.json
CD dist
7zr u opm.zip opm.exe
CD ..

REM push to remote
SET what_files=assets/opm-node.bat assets/services.json dist/opm.js dist/opm.zip
pscp %what_files% OCI-cool:/httpd/dlc/opm/

ECHO DONE
timeout /t 10
