# Run from project root after docker compose up -d --build.
$adminSecret = Read-Host 'Choose a demo admin password (12+ characters)' -AsSecureString
$userSecret = Read-Host 'Choose a demo user password (12+ characters)' -AsSecureString
$adminPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecret)
$userPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($userSecret)
try {
    $env:DEMO_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminPtr)
    $env:DEMO_USER_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($userPtr)
    if ($env:DEMO_ADMIN_PASSWORD.Length -lt 12 -or $env:DEMO_USER_PASSWORD.Length -lt 12) {
        throw 'Both demonstration passwords must contain at least 12 characters.'
    }
    docker compose exec -e "DEMO_ADMIN_PASSWORD=$env:DEMO_ADMIN_PASSWORD" -e "DEMO_USER_PASSWORD=$env:DEMO_USER_PASSWORD" api python -m app.seed_demo
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminPtr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($userPtr)
    Remove-Item Env:\DEMO_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\DEMO_USER_PASSWORD -ErrorAction SilentlyContinue
}
