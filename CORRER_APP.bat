@echo off
title Alberto App - Backend + Frontend
color 0A

echo ========================================
echo   INICIANDO APLICACION ALBERTO
echo ========================================
echo.

REM Backend
echo [1/2] Iniciando Backend (Puerto 8000)...
start cmd /k "cd backend && python main.py"

REM Frontend
echo [2/2] Iniciando Frontend (Puerto 3000)...
timeout /t 2
start cmd /k "cd frontend && C:\Users\TamezDan\Desktop\node-v24.15.0-win-x64\npm.cmd run dev"

echo.
echo ========================================
echo   AMBOS SERVICIOS INICIADOS
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo.
pause
