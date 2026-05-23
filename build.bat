@echo off
chcp 65001 >nul 2>&1
title 에듀노트 빌드
setlocal

echo.
echo ========================================
echo   에듀노트 (EduNote) EXE 빌드 시작
echo ========================================
echo.

:: 스크립트 위치로 이동 (어디서 실행해도 동작하도록)
cd /d "%~dp0"

:: Node.js 설치 확인
where node >nul 2>&1
if errorlevel 1 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo.
    echo        https://nodejs.org 에서 LTS 버전을 설치한 후 다시 실행하세요.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v 2^>nul') do set NODE_VER=%%i
echo [1/3] Node.js %NODE_VER% 확인 완료
echo.

:: 패키지 설치 (node_modules 없을 때만)
if not exist "node_modules\" (
    echo [2/3] 패키지 설치 중... (최초 1회, 약 1~2분 소요)
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [오류] 패키지 설치에 실패했습니다.
        pause
        exit /b 1
    )
) else (
    echo [2/3] 패키지 이미 설치됨, 건너뜀
)
echo.

:: EXE 빌드
echo [3/3] EXE 빌드 중... (약 2~3분 소요)
echo.
call npm run build:win
if errorlevel 1 (
    echo.
    echo [오류] 빌드에 실패했습니다. 위의 오류 메시지를 확인하세요.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   빌드 완료!
echo   dist\ 폴더에서 EXE 파일을 확인하세요.
echo ========================================
echo.

if exist "dist\" (
    explorer dist
)

pause
endlocal
