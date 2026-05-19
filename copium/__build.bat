@ECHO off
TITLE copium build

REM Windows
REM SET os_machine=x86_64 aarch64
REM FOR /F %%G in ("%os_machine%") DO (
  REM zig c++ -O3 copium.cpp -target %%G-windows-msvc -o build/copium-windows-%%G.exe
REM )
zig c++ -O3 copium.cpp -target x86_64-windows-gnu -o build/copium-windows-x86_64.exe -lws2_32
REM zig c++ -O3 copium.cpp -target %%G-windows-msvc -o build/copium-windows-%%G.exe

REM Linux
REM SET os_machine=x86_64 aarch64
REM FOR /F %%G in ("%os_machine%") DO (
  REM zig c++ -O3 copium.cpp -target %%G-linux-musl -o build/copium-linux-%%G -s
REM )
zig c++ -O3 copium.cpp -target x86_64-linux-musl -o build/copium-linux-x86_64 -s
zig c++ -O3 copium.cpp -target aarch64-linux-musl -o build/copium-linux-aarch64 -s

REM MacOS
REM SET os_machine=x86_64 aarch64
REM FOR /F %%G in ("%os_machine%") DO (
  REM zig c++ -O3 copium.cpp -target %%G-macos-none -o build/copium-darwin-%%G
REM )
zig c++ -O3 copium.cpp -target x86_64-macos-none -o build/copium-darwin-x86_64
zig c++ -O3 copium.cpp -target aarch64-macos-none -o build/copium-darwin-aarch64

REM timeout /t 10
pause>nul
