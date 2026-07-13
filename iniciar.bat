@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   RRSS Studio - arranque local
echo ============================================
echo.

echo [1/3] Liberando el puerto 3000 si esta ocupado...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
  echo     - matando proceso %%a
  taskkill /F /PID %%a >nul 2>&1
)

echo [2/3] Programando apertura del navegador...
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3000"

echo [3/3] Iniciando servidor de desarrollo (Ctrl+C para parar)...
echo.
call npm run dev

endlocal
