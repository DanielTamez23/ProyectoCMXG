@echo off
title Auto Carga Excel -> Station Flow
color 0B

echo ========================================
echo   AUTO CARGA DE EXCEL A STATION FLOW
echo ========================================
echo.

echo Ingresa la carpeta donde se guardan tus .xlsx
echo Ejemplo: C:\Users\TuUsuario\Desktop\ExcelCorporativo
set /p WATCH_FOLDER=Carpeta Excel: 

if "%WATCH_FOLDER%"=="" (
  echo Debes indicar una carpeta.
  pause
  exit /b 1
)

echo.
echo API Key (opcional):
echo - Si configuraste BACKEND_UPLOAD_API_KEY en el backend, pegala aqui.
echo - Si no configuraste key, solo presiona ENTER.
set /p API_KEY=API Key: 

echo.
echo Iniciando watcher...
powershell -ExecutionPolicy Bypass -File automation\watch_excel_and_upload.ps1 -WatchFolder "%WATCH_FOLDER%" -ApiUrl "http://localhost:8000/upload" -ApiKey "%API_KEY%" -PollSeconds 5

pause
