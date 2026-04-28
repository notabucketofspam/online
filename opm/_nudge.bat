@ECHO off
TITLE _nudge.bat

REM you need to have 7za.exe on your path
IF NOT EXIST "bigassets/node.xz" (
  CD bigassets
  7za u node.xz node
  CD ..
)

REM push to remote
SET what_files=bigassets/node.xz
pscp %what_files% OCI-cool:/httpd/dlc/opm/

ECHO DONE
timeout /t 10
