@ECHO off
TITLE copium %~nx0
IF NOT EXIST build (
	MD build
)

REM Windows
zig c++ -O3 copium.cpp -target x86_64-windows-gnu -o build/copium-Windows_NT-x86_64.exe -lws2_32
zig c++ -O3 copium.cpp -target aarch64-windows-gnu -o build/copium-Windows_NT-aarch64.exe -lws2_32
DEL build\*.pdb

REM Linux
zig c++ -O3 copium.cpp -target x86_64-linux-gnu -o build/copium-Linux-x86_64 -s
zig c++ -O3 copium.cpp -target aarch64-linux-gnu -o build/copium-Linux-aarch64 -s

REM MacOS
zig c++ -O3 copium.cpp -target x86_64-macos-none -o build/copium-Darwin-x86_64
zig c++ -O3 copium.cpp -target aarch64-macos-none -o build/copium-Darwin-aarch64

ECHO BUILD OK
