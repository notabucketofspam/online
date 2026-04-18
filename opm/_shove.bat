@ECHO off
TITLE _shove.bat

REM make the cabinet if we don't have it
IF NOT EXIST "bigassets/node.cab" (
  CD bigassets
  makecab node.exe node.cab
  CD ..
)

REM push to remote
SET what_files=bigassets/node.cab
pscp %what_files% OCI-cool:/httpd/dlc/opm/

ECHO DONE
timeout /t 10
