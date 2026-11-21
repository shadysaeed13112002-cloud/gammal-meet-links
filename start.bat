@echo off
cd /d "%~dp0"
echo Gammal Meet Links: http://localhost:8080  (close this window to stop)
start "" http://localhost:8080
where py >nul 2>nul && (py -m http.server 8080 --bind 127.0.0.1) || (python -m http.server 8080 --bind 127.0.0.1)
pause
