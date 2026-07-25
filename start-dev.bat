@echo off
title Zayrel Backend - Dev Mode
echo ============================================
echo  Zayrel Backend (NestJS) - Modo Desarrollo
echo ============================================
echo.

REM --- MongoDB (Docker) ---
echo Levantando MongoDB...
docker compose -f "%~dp0docker-compose.yml" up -d 2>nul
if %errorlevel% neq 0 (
    echo AVISO: No se pudo levantar MongoDB con Docker. Asegurate de que este corriendo.
)
echo.

REM --- Env vars para el seed de dev ---
set DEV_MODE=true
set DEV_USER_EMAIL=dev@zayrel.com
set DEV_USER_PASSWORD=dev123456
set DEV_USER_FIRSTNAME=Dev
set DEV_USER_LASTNAME=Test

echo DEV_MODE activado
echo Usuario dev: %DEV_USER_EMAIL% / %DEV_USER_PASSWORD%
echo.

echo Iniciando backend en :3001...
echo.
pnpm run start:dev

pause
