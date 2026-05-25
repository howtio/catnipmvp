@echo off
cd /d "%~dp0"

:: Mode selection: "deepseek" (default) or "local"
if "%1"=="local" set CATNIP_RUNNER_PROVIDER=local
if "%CATNIP_RUNNER_PROVIDER%"=="" set CATNIP_RUNNER_PROVIDER=deepseek

if "%CATNIP_RUNNER_PROVIDER%"=="local" goto :local_mode

:: ============================================
:: DeepSeek API mode
:: ============================================
:deepseek_mode
if exist ".local-secrets\deepseek.env" (
    for /f "usebackq delims=" %%a in (".local-secrets\deepseek.env") do set %%a
)

if "%DEEPSEEK_API_KEY%"=="" (
    echo [ERROR] DEEPSEEK_API_KEY not found.
    echo.
    echo Create .local-secrets\deepseek.env with:
    echo DEEPSEEK_API_KEY=your_key_here
    echo.
    echo Or run: %0 local
    pause
    exit /b 1
)
goto :run

:: ============================================
:: Local model mode (Ollama)
:: ============================================
:local_mode
set CATNIP_RUNNER_PROVIDER=local
if "%CATNIP_LOCAL_MODEL%"=="" set CATNIP_LOCAL_MODEL=qwen2.5:1.5b
echo [LOCAL] Using model: %CATNIP_LOCAL_MODEL%
echo [LOCAL] Make sure Ollama is running (ollama serve)
goto :run

:: ============================================
:: Run the agent
:: ============================================
:run
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
