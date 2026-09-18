@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "FinTrack Server" cmd /k "py -m http.server 5500"
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    start "FinTrack Server" cmd /k "python -m http.server 5500"
  ) else (
    echo Python is not installed. Install Python 3 and try again.
    pause
    exit /b 1
  )
)
timeout /t 2 /nobreak >nul
start "FinTrack User Login" http://localhost:5500/user/user-login.html
endlocal
