# Local Windows profile for the second NLAM installation. Run from any folder.
param(
    [ValidateRange(1, 65535)][int]$ApiPort = 8002,
    [ValidateRange(1, 65535)][int]$WebPort = 5174
)

$frontendPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'frontend'
$env:VITE_API_URL = "http://127.0.0.1:$ApiPort"

Push-Location $frontendPath
try {
    if (-not (Test-Path '.\node_modules\.bin\vite.cmd')) {
        Write-Host 'Installing the locked frontend dependencies...'
        npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'npm.cmd ci failed.' }
    }
    npm.cmd run dev -- --host 127.0.0.1 --port $WebPort --strictPort
    if ($LASTEXITCODE -ne 0) { throw 'The frontend could not start.' }
} finally {
    Pop-Location
}
