@echo off
title British Auction RFQ - FastAPI Backend
echo ========================================================
echo    Starting British Auction Backend (FastAPI + Python)
echo ========================================================
echo.

cd /d "%~dp0\..\backend"

if not exist "venv\Scripts\activate.bat" (
    echo [INFO] Virtual environment not found. Creating venv...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment. Ensure Python is installed.
        pause
        exit /b 1
    )
)

echo [INFO] Activating virtual environment...
call venv\Scripts\activate.bat

if not exist ".env" (
    echo [INFO] .env not found. Copying from .env.example...
    copy .env.example .env
)

echo [INFO] Verifying Python dependencies...
pip install -r requirements.txt --quiet

echo.
echo [INFO] Starting FastAPI server on http://localhost:5000...
echo [INFO] Swagger API Docs available at http://localhost:5000/docs
echo.
uvicorn app.main:app --reload --host 0.0.0.0 --port 5000

pause

