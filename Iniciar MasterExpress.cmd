@echo off
setlocal
title MasterExpress Control
where node.exe >nul 2>&1 || goto sin_node
where npm.cmd >nul 2>&1 || goto sin_npm
where php.exe >nul 2>&1 || goto sin_php
pushd "%~dp0" || goto sin_carpeta
call npm.cmd run dev:local -- --abrir-navegador
set "resultado=%errorlevel%"
popd
if not "%resultado%"=="0" pause
exit /b %resultado%

:sin_node
echo No se encontro Node.js en el PATH.
goto error
:sin_npm
echo No se encontro npm.cmd en el PATH.
goto error
:sin_php
echo No se encontro PHP en el PATH.
goto error
:sin_carpeta
echo No se pudo abrir la carpeta del proyecto.
:error
pause
exit /b 1
