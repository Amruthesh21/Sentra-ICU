@echo off
cd /d "%~dp0"

echo === Sentra ICU device emulator ===
echo.
echo Run this on ANY Windows machine on the same network as your Sentra ICU
echo server (or the same machine) to make it act like a real bedside device.
echo.

set /p HOST="Sentra ICU server IP or hostname (e.g. 192.168.1.50, or localhost): "
if "%HOST%"=="" (
  echo A host is required.
  pause
  exit /b 1
)

echo.
echo Leave blank for the default (BPL VividVue M10 - full waveform demo).
echo Run "node device-emulator.js --list" to see every device this can emulate.
set /p DEVICE="Device to emulate: "

if "%DEVICE%"=="" (
  node device-emulator.js --host %HOST%
) else (
  node device-emulator.js --host %HOST% --device %DEVICE%
)

echo.
pause
