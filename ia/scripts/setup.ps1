# Instalación completa de IA Talking Thommy en Windows (CPU, sin GPU).
# Uso (desde la carpeta del proyecto):  powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# Requisitos previos: Python 3.11+ y winget.
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "1/6 Programas del sistema (Ollama, ffmpeg)"
winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements --silent
winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements --silent

Write-Host "2/6 Entorno virtual de Python"
if (-not (Test-Path .venv)) { python -m venv .venv }
.\.venv\Scripts\python.exe -m pip install --upgrade pip -q
.\.venv\Scripts\python.exe -m pip install -r requirements.txt -q

Write-Host "3/6 whisper.cpp (binario oficial CPU x64) + modelo base.en"
New-Item -ItemType Directory -Force bin\whisper, models\whisper, models\piper, models\ollama | Out-Null
if (-not (Test-Path bin\whisper\Release\whisper-cli.exe)) {
    Invoke-WebRequest "https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip" -OutFile bin\whisper.zip
    Expand-Archive bin\whisper.zip -DestinationPath bin\whisper -Force; Remove-Item bin\whisper.zip
}
if (-not (Test-Path models\whisper\ggml-base.en.bin)) {
    Invoke-WebRequest "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin" -OutFile models\whisper\ggml-base.en.bin
}

Write-Host "4/6 Voces de Piper: kristin (Thommy, dominio público) y joe (audio de prueba del estudiante, CC0)"
$voces = @(@("en/en_US/kristin/medium", "en_US-kristin-medium"), @("en/en_US/joe/medium", "en_US-joe-medium"))
foreach ($voz in $voces) {
    $v = "https://huggingface.co/rhasspy/piper-voices/resolve/main/$($voz[0])"
    foreach ($f in "$($voz[1]).onnx", "$($voz[1]).onnx.json") {
        if (-not (Test-Path "models\piper\$f")) { Invoke-WebRequest "$v/$f" -OutFile "models\piper\$f" }
    }
}

Write-Host "5/6 Modelo de lenguaje qwen3:1.7b (Apache 2.0)"
$modelosUsuario = [Environment]::GetEnvironmentVariable('OLLAMA_MODELS', 'User')
$env:OLLAMA_MODELS = if ($modelosUsuario) { $modelosUsuario } else { Join-Path $root "models\ollama" }
$env:OLLAMA_HOST = "127.0.0.1:11434"
$ollama = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
Get-Process "ollama app", "ollama" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Process -FilePath $ollama -ArgumentList "serve" -WindowStyle Hidden; Start-Sleep 5
& $ollama pull qwen3:1.7b
# Alternativa más ligera (-0,6 GB RAM, algo menos precisa): & $ollama pull qwen2.5:1.5b

Write-Host "6/6 Archivo .env"
if (-not (Test-Path .env)) {
    $ff = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
    $content = Get-Content .env.example -Raw
    if ($ff) { $content = $content.Replace("FFMPEG_BIN=ffmpeg", "FFMPEG_BIN=$ff") }
    [IO.File]::WriteAllText((Join-Path $root ".env"), $content)
}
Write-Host "Listo. Pruebe con:  .\.venv\Scripts\python.exe scripts\check_components.py"
