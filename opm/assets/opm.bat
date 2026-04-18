@ECHO off
TITLE opm

IF NOT EXIST "node.exe" (
  ECHO Gotta download node.exe
  curl -o node.cab "https://waluigi-servebeer.com/dlc/opm/node.cab"
  expand node.cab -F:node.exe node.exe
  DEL node.cab
  ECHO Done with that
)

ECHO Loading...
curl -s -o opm.js "https://waluigi-servebeer.com/dlc/opm/opm.js"
CLS

.\node opm.js
PAUSE
