@echo off
setlocal
set LAUNCHER=%~dp0

:: Si ya corre, solo abre el browser
netstat -an | findstr /C:":5172" | findstr /C:"LISTENING" >nul 2>&1
if not errorlevel 1 (
    start "" "http://localhost:5172/"
    exit /b 0
)

:: Arranca npm run dev en ventana minimizada (/d fija el directorio sin anidar comillas)
start "Neural Studio" /d "%LAUNCHER%" /min cmd /k "npm run dev"

:: Espera que Vite levante
timeout /t 5 /nobreak >nul

:: Abre el browser
start "" "http://localhost:5172/"
