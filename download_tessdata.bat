@echo off
setlocal

set "TESSDATA_DIR=backend\Two Services\book-service\tessdata"
set "FILE_URL=https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata"
set "DEST_FILE=%TESSDATA_DIR%\eng.traineddata"

echo =======================================================
echo Book Vault - OCR Language Data Setup
echo =======================================================

if not exist "%TESSDATA_DIR%" (
    echo Creating tessdata directory at %TESSDATA_DIR%...
    mkdir "%TESSDATA_DIR%"
)

if exist "%DEST_FILE%" (
    echo [OK] eng.traineddata already exists in %TESSDATA_DIR%.
    echo You are ready to run the Spring Boot service!
    goto :EOF
)

echo.
echo Downloading eng.traineddata (approx 23MB) from official Tesseract GitHub...
echo This may take a minute depending on your connection.
echo.

powershell -Command "Invoke-WebRequest -Uri '%FILE_URL%' -OutFile '%DEST_FILE%'"

if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Successfully downloaded eng.traineddata to %DEST_FILE%
) else (
    echo [ERROR] Failed to download eng.traineddata.
    echo Please check your internet connection or download it manually from:
    echo %FILE_URL%
)

echo.
pause
