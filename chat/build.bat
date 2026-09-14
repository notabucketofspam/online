@ECHO off

CALL vite build -l warn
CALL tsc --project tsconfig.build.json
