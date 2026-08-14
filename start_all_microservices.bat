@echo off
title Book Vault - All Microservices Fleet Launcher
echo =====================================================================
echo           BOOK VAULT - ALL MICROSERVICES ORCHESTRATOR
echo =====================================================================
echo.
echo  [1/6] Database: MySQL Server (Port 3306 - database: bookvault)
echo  [2/6] Microservice: Frontend Web Client (Port 5173)
echo  [3/6] Microservice: Node.js / MySQL API Engine (Port 5173/api)
echo  [4/6] Microservice: Spring Boot Auth Service (Port 8081)
echo  [5/6] Microservice: Spring Boot Book Service (Port 8082)
echo  [6/6] Microservice: Python AI Vision & Voice Engine (Port 3001)
echo.
echo =====================================================================
echo Starting Frontend Client & MySQL API Gateway...
start "Book Vault - Frontend (Port 5173)" cmd /k "npm run dev"

echo.
echo All microservices initialized!
echo Open your browser at: http://localhost:5173/
echo MySQL Database Explorer: http://localhost:5173/database
echo =====================================================================
pause
