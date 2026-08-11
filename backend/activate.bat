@echo off
REM Activate the Fill Tool backend virtual environment
cd /d "%~dp0"
call venv\Scripts\activate.bat
echo.
echo Virtual environment activated.
echo Python: %VIRTUAL_ENV%
echo.
echo To start the backend:  python app.py
echo To exit venv:  deactivate
cmd /k
