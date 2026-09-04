@ECHO off
TITLE copium %~nx0

REM build copium
CALL __build

REM push to remote
SET what_files=build/*
CALL mexec "rsync %what_files% cool:/httpd/dlc/copium/"

ECHO DONE
REM timeout /t 2 > nul
