@ECHO off

CALL tsc --build
CALL vite build
ECHO build done

CALL mexec "./push.sh"

timeout /t 10
