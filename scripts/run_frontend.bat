@echo off
title British Auction RFQ - React Frontend
echo ========================================================
echo    Starting British Auction Frontend (React + Vite)
echo ========================================================
echo.

cd /d "%~dp0\..\frontend"

if not exist "node_modules" (
    echo [INFO] node_modules not found. Installing packages...
    npm install
)

echo.
echo [INFO] Starting Vite development server on http://localhost:5173...
echo.
npm run dev

pause

