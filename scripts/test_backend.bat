@echo off
title British Auction RFQ - Test Suite
echo ========================================================
echo    Running Automated Pytest Test Suite
echo ========================================================
echo.

cd /d "%~dp0\..\backend"

if not exist "venv\Scripts\activate.bat" (
    echo [INFO] Creating venv...
    python -m venv venv
)

call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet

echo.
echo Running pytest with asyncio support...
pytest -v

pause

