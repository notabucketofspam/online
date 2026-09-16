@ECHO off
RD /S /Q dist
CALL tsc --build
CALL vite build -l warn
