@ECHO off
TITLE opm

where /Q node.exe
IF ERRORLEVEL 1 (
  ECHO Gotta download node.exe
  curl -o node.cab "https://waluigi-servebeer.com/dlc/opm/node.cab"
  expand node.cab -F:node.exe node.exe
  DEL node.cab
  ECHO Done with that
)

ECHO Loading...
curl -s -o opm.js "https://waluigi-servebeer.com/dlc/opm/opm.js"
node.exe opm.js
PAUSE
