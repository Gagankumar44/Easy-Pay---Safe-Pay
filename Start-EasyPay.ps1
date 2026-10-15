$ErrorActionPreference = 'Stop'
$projectPath = $PSScriptRoot
$apiPath = Join-Path $projectPath 'backend'
$webPath = Join-Path $projectPath 'frontend'
$logPath = Join-Path $apiPath 'data'
$pythonPath = Join-Path $apiPath '.venv\Scripts\python.exe'
$nextPath = Join-Path $webPath 'node_modules\next\dist\bin\next'

if (!(Test-Path -LiteralPath $pythonPath) -or !(Test-Path -LiteralPath $nextPath)) {
    throw 'Install the backend and frontend dependencies using README.md first.'
}
New-Item -ItemType Directory -Path $logPath -Force | Out-Null

if (!(Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $pythonPath -ArgumentList @('-m','uvicorn','main:app','--host','127.0.0.1','--port','8001') -WorkingDirectory $apiPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logPath 'stable-stdout.log') -RedirectStandardError (Join-Path $logPath 'stable-stderr.log')
}
if (!(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)) {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    Start-Process -FilePath $nodePath -ArgumentList @(('"' + $nextPath + '"'),'dev','--port','3000') -WorkingDirectory $webPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logPath 'frontend-stdout.log') -RedirectStandardError (Join-Path $logPath 'frontend-stderr.log')
}

$available = $false
$startupTimer = [Diagnostics.Stopwatch]::StartNew()
while ($startupTimer.Elapsed.TotalSeconds -lt 30) {
    try {
        $apiHealth = Invoke-RestMethod 'http://127.0.0.1:8001/health' -TimeoutSec 2
        $proxyHealth = Invoke-RestMethod 'http://localhost:3000/backend/health' -TimeoutSec 2
        if ($apiHealth.status -eq 'healthy' -and $proxyHealth.service -eq $apiHealth.service -and $apiHealth.service -like 'Easy Pay*') {
            $available = $true
            break
        }
    } catch { }
    Start-Sleep -Milliseconds 500
}
if (!$available) { throw "The app did not become ready. Check the logs in $logPath and whether ports 3000 or 8001 belong to another app." }
Write-Output 'Easy Pay is ready: http://localhost:3000'
Write-Output 'Both services run in the background. Logs are in backend/data.'
