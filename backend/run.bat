@echo off
REM Fill Tool - Backend startup script (activates venv automatically)
cd /d "%~dp0"
call venv\Scripts\activate.bat
python app.py
pause
