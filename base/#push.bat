@ECHO off
CALL build
ECHO build ok
CALL mexec "./push.sh"
ECHO done
