@echo off
title Alberto App - Backend + Frontend
color 0A

echo ========================================
echo   INICIANDO APLICACION ALBERTO
echo ========================================
echo.

REM Variables: Agregamos la ruta de Node.js al PATH para que 'npm' y 'node' funcionen
set "NODE_DIR=C:\Users\TamezDan\Desktop\Carrier 2026\node-v24.15.0-win-x64"
set "PATH=%NODE_DIR%;%PATH%"

REM Backend
echo [1/2] Iniciando Backend (Puerto 8000)...
start "Backend" cmd /k "cd backend && python main.py"

REM Frontend
echo [2/2] Iniciando Frontend (Puerto 3000)...
ping 127.0.0.1 -n 3 > nul
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo   AMBOS SERVICIOS INICIADOS
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo.
pause
