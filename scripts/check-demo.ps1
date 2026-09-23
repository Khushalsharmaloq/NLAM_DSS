$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$apiBase = "http://127.0.0.1:8001"
$frontendUrl = "http://127.0.0.1:5173/"

function Test-Http {
    param(
        [string]$Name,
        [string]$Url
    )

    try {
        $response = Invoke-WebRequest `
            -Uri $Url `
            -UseBasicParsing `
            -TimeoutSec 10 `
            -ErrorAction Stop

        if ([int]$response.StatusCode -ne 200) {
            throw "HTTP $($response.StatusCode)"
        }

        Write-Host "PASS: $Name" -ForegroundColor Green
    }
    catch {
        throw "$Name is unavailable at $Url. $($_.Exception.Message)"
    }
}

Write-Host "`n=== NLAM DSS DEMO READINESS ===" -ForegroundColor Cyan

Write-Host "`n1. Docker services" -ForegroundColor Cyan

docker compose ps

if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose could not inspect the project."
}

Write-Host "`n2. API and database health" -ForegroundColor Cyan

$health = Invoke-RestMethod `
    -Uri "$apiBase/health" `
    -Method Get `
    -TimeoutSec 10

if ($health.status -ne "healthy" -or
    $health.database -ne "connected") {
    throw "API or database health check failed."
}

Write-Host "PASS: API healthy and database connected" `
    -ForegroundColor Green

Write-Host "`n3. Frontend availability" -ForegroundColor Cyan

Test-Http `
    -Name "Vite frontend" `
    -Url $frontendUrl

Write-Host "`n4. Frontend production build" -ForegroundColor Cyan

Push-Location (Join-Path $projectRoot "frontend")

try {
    npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "Frontend production build failed."
    }
}
finally {
    Pop-Location
}

Write-Host "PASS: Frontend production build" -ForegroundColor Green

Write-Host "`n5. Protected MIS endpoint" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest `
        -Uri "$apiBase/api/v1/mis/overview" `
        -UseBasicParsing `
        -TimeoutSec 10 `
        -ErrorAction Stop

    throw "MIS endpoint unexpectedly accepted an unauthenticated request."
}
catch {
    if ($null -eq $_.Exception.Response) {
        throw
    }

    $status = [int]$_.Exception.Response.StatusCode

    if ($status -ne 401) {
        throw "Expected HTTP 401 from protected MIS; received $status."
    }
}

Write-Host "PASS: MIS requires authentication" -ForegroundColor Green

Write-Host "`n=== DEMO READINESS CHECK PASSED ===" -ForegroundColor Green
Write-Host "Frontend: $frontendUrl"
Write-Host "API documentation: $apiBase/docs"
Write-Host ""
Write-Host "Sign in and verify Project 3 before presenting." `
    -ForegroundColor Yellow