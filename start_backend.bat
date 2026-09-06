@echo off
title Bhoomi AI - Backend Only
cd /d "%~dp0backend"
if not exist "venv" (
    echo [INFO] Creating venv...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo [INFO] Installing dependencies...
python -m pip install -r requirements.txt
echo [INFO] Starting FastAPI Backend on http://127.0.0.1:8000 ...
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
