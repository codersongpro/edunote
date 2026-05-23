@echo off

:: electron-builder requires admin rights to extract winCodeSign (symlinks)
:: Auto-elevate if not running as administrator
net session >/dev/null 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator rights...
    powershell -Command "Start-Process '%%COMSPEC%%' -ArgumentList ('/c ""' + '%%~s0' + '""') -Verb RunAs"
    exit /b
)

chcp 949 >/dev/null 2>&1
title EduNote Build
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   EduNote EXE Build
echo ========================================
echo.

cd /d "%~dp0"

:: Check Node.js
where node >/dev/null 2>&1
if %errorlevel% neq 0 (
    echo [Error] Node.js is not installed.
    echo.
    echo  1. Visit https://nodejs.org
    echo  2. Download and install LTS version
    echo  3. Restart this script after installation
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [1/3] Node.js %NODE_VER% detected
echo.

:: Install packages
if not exist "node_modules\" (
    echo [2/3] Installing packages... (1-2 minutes)
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [Error] Package installation failed. Check your internet connection.
        pause
        exit /b 1
    )
) else (
    echo [2/3] Packages already installed
)
echo.

:: Build EXE
echo [3/3] Building EXE... (2-3 minutes)
echo.
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npm run build:win
if %errorlevel% neq 0 (
    echo.
    echo [Error] Build failed. Check the error messages above.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Done! Check the dist folder for EXE.
echo ========================================
echo.

if exist "dist\" start explorer dist

pause
endlocal
