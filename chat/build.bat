@ECHO off

REM RD /S /Q "dist"
SETLOCAL EnableDelayedExpansion
SET "__modnames=react react-dom/client livekit-client"
FOR %%G IN (%__modnames%) DO (  
  CALL rolldown "%%G" --minify false --cleanDir false --format esm --log-level warn --file "dist/%%G.js">nul
)
  REM CALL esbuild "%%G" --format=esm --log-level=warning --outfile="dist/%%G.js"
ENDLOCAL

CALL vite build -l warn
REM CALL tsc --project tsconfig.build.json
