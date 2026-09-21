$ErrorActionPreference = "Stop"
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " AgentSentinel Production Startup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Verify Python
Write-Host "Verifying Python..." -ForegroundColor Yellow
if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) {
    Write-Error "Python is not installed or not in PATH."
    exit 1
}

# 2. Verify Ollama & Model
Write-Host "Verifying Ollama..." -ForegroundColor Yellow
$ollamaHost = $env:OLLAMA_HOST
if ([string]::IsNullOrWhiteSpace($ollamaHost)) {
    $ollamaHost = "http://127.0.0.1:11434"
}
try {
    $response = Invoke-RestMethod -Uri "$ollamaHost/" -Method Get -ErrorAction Stop
    if ($response -match "Ollama is running") {
        Write-Host "Ollama is running at $ollamaHost" -ForegroundColor Green
    }
} catch {
    Write-Error "Ollama is not reachable at $ollamaHost. Ensure Ollama is running."
    exit 1
}

$ollamaModel = $env:OLLAMA_MODEL
if ([string]::IsNullOrWhiteSpace($ollamaModel)) {
    $ollamaModel = "qwen3:4b"
}
Write-Host "Verifying model $ollamaModel..." -ForegroundColor Yellow
try {
    $tags = Invoke-RestMethod -Uri "$ollamaHost/api/tags" -Method Get
    $modelExists = $tags.models | Where-Object { $_.name -eq $ollamaModel -or $_.name -eq "$ollamaModel:latest" }
    if (-not $modelExists) {
        Write-Error "Ollama model '$ollamaModel' is not installed. Run: ollama run $ollamaModel"
        exit 1
    }
    Write-Host "Model $ollamaModel is installed." -ForegroundColor Green
} catch {
    Write-Error "Failed to verify models with Ollama API."
    exit 1
}

# 3. Python Virtual Environment & Dependencies
$venvDir = ".venv"
if (-not (Test-Path $venvDir)) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv $venvDir
}
Write-Host "Activating venv and installing dependencies..." -ForegroundColor Yellow
$pythonExe = Join-Path $venvDir "Scripts\python.exe"
& $pythonExe -m pip install --upgrade pip --quiet
& $pythonExe -m pip install -r requirements.txt --quiet

# 4. Database Migrations
Write-Host "Running Database Migrations..." -ForegroundColor Yellow
$env:PYTHONPATH = "."
& $pythonExe -m alembic upgrade head

# 5. Build Frontend
Write-Host "Building React Frontend..." -ForegroundColor Yellow
Push-Location "ui"
try {
    if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
        Write-Error "Node.js (npm) is not installed."
        exit 1
    }
    npm install
    npm run build
} finally {
    Pop-Location
}

# 6. Start Services
Write-Host "Starting Backend (Port 8000)..." -ForegroundColor Yellow
Start-Process -NoNewWindow -FilePath $pythonExe -ArgumentList "-m uvicorn src.agentsentinel.api.main:app --host 127.0.0.1 --port 8000"

Write-Host "Starting Frontend Production Server (Port 4173)..." -ForegroundColor Yellow
Start-Process -NoNewWindow -FilePath "npm.cmd" -ArgumentList "run preview -- --host 127.0.0.1" -WorkingDirectory "ui"

Start-Sleep -Seconds 3
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "AgentSentinel is Running!" -ForegroundColor Green
Write-Host "Frontend UI: http://127.0.0.1:4173/" -ForegroundColor White
Write-Host "Backend API: http://127.0.0.1:8000/" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Cyan

while ($true) { Start-Sleep -Seconds 3600 }
