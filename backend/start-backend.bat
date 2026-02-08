@echo off
echo ================================
echo  Life Simulation Game - Backend
echo ================================
echo.

cd /d %~dp0

echo [1/3] Checking Node.js...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found! Please install Node.js first.
    pause
    exit /b 1
)

echo.
echo [2/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)

echo.
echo [3/3] Starting server...
echo.
echo ========================================
echo   Backend Server Starting...
echo   URL: http://localhost:3001
echo ========================================
echo.

node server.js

pause
