@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   RRSS Studio - arranque limpio
echo ============================================
echo.

echo [1/5] Cerrando servidores Node/Next anteriores...
taskkill /F /IM node.exe >nul 2>&1
rem Por si algo sigue escuchando en el puerto 3000:
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 >nul

echo [2/5] Limpiando cache de compilacion (.next)...
if exist ".next" rmdir /s /q ".next"

echo [3/5] Iniciando servidor en una ventana nueva...
start "RRSS Studio Server" cmd /k "npm run dev"

echo [4/5] Esperando a que el servidor este listo (puerto 3000)...
:wait
timeout /t 1 >nul
netstat -ano | findstr :3000 | findstr LISTENING >nul
if errorlevel 1 goto wait

echo [5/5] Servidor listo. Abriendo el navegador...
timeout /t 2 >nul
start http://localhost:3000

echo.
echo Listo. El servidor corre en la ventana "RRSS Studio Server".
echo Cierra esa ventana (o Ctrl+C en ella) para parar la app.
timeout /t 3 >nul
endlocal
