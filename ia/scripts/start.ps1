# Inicia Ollama (si no está corriendo) y la API de Talking Thommy.
# Uso (desde la carpeta del proyecto):  powershell -ExecutionPolicy Bypass -File scripts\start.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Si ya hay una carpeta de modelos configurada (variable de usuario OLLAMA_MODELS), se respeta.
$modelosUsuario = [Environment]::GetEnvironmentVariable('OLLAMA_MODELS', 'User')
$env:OLLAMA_MODELS = if ($modelosUsuario) { $modelosUsuario } else { Join-Path $root "models\ollama" }
$env:OLLAMA_HOST = "127.0.0.1:11434"   # solo local: Ollama nunca se expone a la red
$ollama = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"

function Test-Ollama { try { Invoke-RestMethod "http://127.0.0.1:11434/api/version" -TimeoutSec 2 | Out-Null; $true } catch { $false } }

if (-not (Test-Ollama)) {
    Write-Host "Iniciando Ollama (modelos en $env:OLLAMA_MODELS)..."
    Start-Process -FilePath $ollama -ArgumentList "serve" -WindowStyle Hidden
    for ($i = 0; $i -lt 30 -and -not (Test-Ollama); $i++) { Start-Sleep 1 }
    if (-not (Test-Ollama)) { throw "Ollama no respondió en http://127.0.0.1:11434" }
}
Write-Host "Ollama OK. Iniciando API en http://127.0.0.1:8000  (Swagger: /docs)"
& "$root\.venv\Scripts\python.exe" main.py
