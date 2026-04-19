@echo off
title StockThai
echo.
echo  ===================================
echo   StockThai - Thai Stock Analyzer
echo  ===================================
echo.

:: Check if Docker is installed
where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [Docker พบแล้ว] กำลังเริ่มต้น...
    docker compose up --build
    goto end
)

:: Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [Node.js พบแล้ว] กำลังติดตั้ง dependencies...
    npm install
    echo.
    echo กำลังเปิดแอพ... เปิดเบราว์เซอร์ที่ http://localhost:3000
    start http://localhost:3000
    node server.js
    goto end
)

:: Neither found
echo.
echo [ข้อผิดพลาด] ไม่พบ Node.js หรือ Docker บนเครื่องนี้
echo.
echo กรุณาติดตั้งอย่างใดอย่างหนึ่ง:
echo  - Node.js: https://nodejs.org  (แนะนำ)
echo  - Docker Desktop: https://www.docker.com/products/docker-desktop
echo.
pause

:end
