# Compara modelos de Ollama con la evaluación pedagógica y la prueba de contexto (5 veces).
# Uso: powershell -ExecutionPolicy Bypass -File scripts\compare_models.ps1 qwen2.5:1.5b qwen3:1.7b
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Models)
$root = Split-Path -Parent $PSScriptRoot; Set-Location $root
$env:PYTHONIOENCODING = "utf-8"
foreach ($m in $Models) {
    $env:OLLAMA_MODEL = $m
    if ($m -like "qwen3*") { $env:OLLAMA_THINK = "false" } else { Remove-Item Env:OLLAMA_THINK -ErrorAction SilentlyContinue }
    Write-Host "`n################ $m ################"
    $sw = [Diagnostics.Stopwatch]::StartNew()
    & .\.venv\Scripts\python.exe scripts\eval_tutor.py 2>$null | Select-String -Pattern "^\[|->|Errors detected|correction=\{" | ForEach-Object { $_.Line }
    Write-Host ("eval time: {0:N0} s" -f $sw.Elapsed.TotalSeconds)
    $pass = 0; $name = 0
    for ($i = 1; $i -le 5; $i++) {
        $o = & .\.venv\Scripts\python.exe -m pytest tests\test_conversation.py -s -q -p no:cacheprovider -W ignore::DeprecationWarning --log-level=WARNING 2>&1
        $last = ($o | Select-String "^THOMMY" | Select-Object -Last 1).Line
        if ($last -match "rocky") { $name++ }
        if ($o -match "1 passed") { $pass++; Write-Host "ctx ${i}: PASS | $last" } else { Write-Host "ctx ${i}: FAIL | $last" }
    }
    Write-Host "RESULT $m -> context full: $pass/5, name: $name/5"
}
