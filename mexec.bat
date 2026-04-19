@ECHO off
TITLE %~nx1
SET _comm2=%1
SET _comm=%_comm2:\=/%
C:\WINDOWS\system32\cmd.exe /c "set MSYSTEM=MINGW64&& set CHERE_INVOKING=1&& set MSYS2_PATH_TYPE=inherit&& C:\msys64\usr\bin\bash.exe --login -c %_comm%"
