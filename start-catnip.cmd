@echo off
cd /d "%~dp0"

:: Load DeepSeek API key from local secrets
if exist ".local-secrets\deepseek.env" (
    for /f "usebackq delims=" %%a in (".local-secrets\deepseek.env") do set %%a
)

:: Check key
if "%DEEPSEEK_API_KEY%"=="" (
    echo [ERROR] DEEPSEEK_API_KEY not found.
    echo.
    echo Create .local-secrets\deepseek.env with:
    echo DEEPSEEK_API_KEY=your_key_here
    echo.
    pause
    exit /b 1
)

:: Build if dist not found
if not exist "dist\src\main.js" (
    echo [BUILD] Building TypeScript project...
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Build failed. Make sure you have run npm install.
        pause
        exit /b 1
    )
)

echo.
echo ============================================
echo   Catnip Agent - Interactive Mode
echo ============================================
echo.

node dist/src/main.js --interactive

echo.
echo ============================================
echo   Catnip Agent exited.
echo ============================================
pause
