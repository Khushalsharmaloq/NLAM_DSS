# Read-only check: run in PowerShell from the extracted project root.
$ErrorActionPreference = 'Continue'
Write-Host 'NLAM DSS — Windows prerequisite check' -ForegroundColor Cyan
Write-Host ('Project folder: ' + (Get-Location).Path)
Write-Host ('PowerShell: ' + $PSVersionTable.PSVersion.ToString())

function Check-Command([string]$Name, [string]$VersionArgs) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) { Write-Host "$Name : NOT FOUND" -ForegroundColor Yellow; return $false }
    try {
        $argsList = $VersionArgs.Split(' ', [StringSplitOptions]::RemoveEmptyEntries)
        $result = & $Name @argsList 2>&1 | Select-Object -First 2
        Write-Host ("$Name : " + (($result | Out-String).Trim())) -ForegroundColor Green
    } catch { Write-Host "$Name : found, version check failed: $($_.Exception.Message)" -ForegroundColor Yellow }
    return $true
}

$nodeFound = Check-Command 'node.exe' '--version'
$npmFound = Check-Command 'npm.cmd' '--version'
$dockerFound = Check-Command 'docker.exe' '--version'
if ($dockerFound) {
    Write-Host 'Docker Compose:'
    & docker.exe compose version 2>&1
    Write-Host 'Docker engine:'
    & docker.exe info --format '{{.ServerVersion}}' 2>&1
}
$wslFound = Get-Command 'wsl.exe' -ErrorAction SilentlyContinue
if ($wslFound) {
    Write-Host 'WSL status:'
    & wsl.exe --status 2>&1
} else { Write-Host 'WSL : NOT FOUND' -ForegroundColor Yellow }

try {
    $system = Get-CimInstance Win32_ComputerSystem
    $os = Get-CimInstance Win32_OperatingSystem
    Write-Host ('Windows: ' + $os.Caption + ' ' + $os.Version)
    Write-Host ('Installed RAM: ' + [math]::Round($system.TotalPhysicalMemory / 1GB, 1) + ' GB')
} catch { Write-Host 'Windows system details unavailable.' }
Write-Host ('Free space here: ' + [math]::Round((Get-PSDrive -Name (Get-Location).Drive.Name).Free / 1GB, 1) + ' GB')
Write-Host ('compose.yaml present: ' + (Test-Path .\compose.yaml))
Write-Host ('frontend lockfile present: ' + (Test-Path .\frontend\package-lock.json))
Write-Host 'Listening ports 8001 / 5173:'
if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
    Get-NetTCPConnection -LocalPort 8001,5173 -State Listen -ErrorAction SilentlyContinue |
        Select-Object LocalAddress,LocalPort,OwningProcess | Format-Table -AutoSize
}
Write-Host 'Check complete. Share this output to plan only the missing prerequisites.' -ForegroundColor Cyan
