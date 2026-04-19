@echo off
REM Windows 工作排程器呼叫此檔即可
cd /d "%~dp0"
python scraper.py >> scraper.log 2>&1
exit /b %ERRORLEVEL%
