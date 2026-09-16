@ECHO off

CALL build
ECHO build done

CALL mexec "./push.sh"

REM timeout /t 10
