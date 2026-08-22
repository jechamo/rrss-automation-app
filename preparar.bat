@echo off
setlocal
cd /d "%~dp0"
title RRSS Studio - Preparar

echo.
echo  Este instalador guia check, prepare, la sesion de Claude y start.
echo  No pide secretos ni inicia el login por ti.
echo.

set "ERR=1"
where node >nul 2>&1
if errorlevel 1 (
  echo No se encontro Node.js. Instala Node 20 o superior y vuelve a doble clic.
  goto end
)

node scripts\prepare-guide.mjs
set "ERR=%ERRORLEVEL%"

:end
echo.
pause
endlocal
exit /b %ERR%
