@echo off
title Launch British Auction RFQ Application
echo ========================================================
echo    Launching British Auction RFQ Full Stack App
echo ========================================================
echo.
echo [1/2] Launching Python FastAPI Backend in new window...
start "British Auction - Backend (FastAPI)" cmd /k "%~dp0run_backend.bat"

echo [2/2] Launching React Vite Frontend in new window...
start "British Auction - Frontend (React)" cmd /k "%~dp0run_frontend.bat"

echo.
echo Both servers are launching!
echo Backend:  http://localhost:5000 (Swagger: http://localhost:5000/docs)
echo Frontend: http://localhost:5173
echo.

