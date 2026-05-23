@echo off
chcp 949 >/dev/null 2>&1
title 에듀노트 빌드
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   에듀노트 EXE 빌드 시작
echo ========================================
echo.

cd /d "%~dp0"

:: Node.js 확인
where node >/dev/null 2>&1
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo.
    echo  1. https://nodejs.org 접속
    echo  2. LTS 버전 다운로드 후 설치
    echo  3. 설치 완료 후 이 파일 다시 실행
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [1/3] Node.js %NODE_VER% 확인
echo.

:: 패키지 설치
if not exist "node_modules\" (
    echo [2/3] 패키지 설치 중... 약 1~2분 소요
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [오류] 패키지 설치 실패. 인터넷 연결을 확인하세요.
        pause
        exit /b 1
    )
) else (
    echo [2/3] 패키지 확인 완료
)
echo.

:: EXE 빌드
echo [3/3] EXE 빌드 중... 약 2~3분 소요
echo.
call npm run build:win
if %errorlevel% neq 0 (
    echo.
    echo [오류] 빌드 실패. 위 오류 메시지를 확인하세요.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   완료! dist 폴더에서 EXE를 확인하세요.
echo ========================================
echo.

if exist "dist\" start explorer dist

pause
endlocal
