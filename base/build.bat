@ECHO off
RD /S /Q dist
CALL tsc --build
CALL tsc --project src/goobo/tsconfig.json
