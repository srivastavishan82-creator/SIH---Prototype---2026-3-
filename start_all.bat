@echo off
title Bhoomi AI - Land Record Digitization System (SIH 2026)
cls
echo =====================================================================
echo       BHOOMI AI - LAND RECORD DIGITIZATION & VALIDATION SYSTEM
echo           Ministry of Rural Development (DoLR) - SIH 2026
echo =====================================================================
echo.

:: 1. Check Python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not found in PATH. Please install Python 3.10+ from python.org.
    pause
    exit /b 1
)

:: 2. Check Node
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH. Please install Node.js from nodejs.org.
    pause
    exit /b 1
)

echo [1/3] Checking Backend virtual environment & dependencies...
cd /d "%~dp0backend"
if not exist "venv" (
    echo [INFO] Creating lightweight Python virtual environment (venv)...
    python -m venv venv
)

call venv\Scripts\activate.bat
echo [INFO] Installing / verifying lean Python dependencies...
python -m pip install -q -r requirements.txt

echo [2/3] Launching FastAPI Backend on http://127.0.0.1:8000...
start "Bhoomi-AI-Backend-Server" cmd /k "cd /d ""%~dp0backend"" && call venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [3/3] Launching React+Vite Frontend on http://localhost:5173...
start "Bhoomi-AI-Frontend-Server" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

timeout /t 3 >nul
echo.
echo =====================================================================
echo  SYSTEM READY!
echo  - Frontend: http://localhost:5173
echo  - Backend API: http://127.0.0.1:8000
echo  - Swagger Docs: http://127.0.0.1:8000/docs
echo  - Primary Admin: srivastavishan82@gmail.com / admin123
echo  - Revenue Admin: admin@lrds.gov.in / admin123
echo  - Verifier/Patwari: verifier@lrds.gov.in / verify123
echo =====================================================================
echo.
echo Opening browser...
start http://localhost:5173
echo Press any key to exit this launcher window (servers remain running).
pause >nul
