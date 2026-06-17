@ECHO off

CMD /c "npm run build --silent"
ECHO build done

CALL mexec "./push.sh"

timeout /t 10
