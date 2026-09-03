@echo off
REM follow build directions in solutes/redis.md
CALL mexec.bat "~/redis/src/redis-server.exe ~/redis/redis.conf"
