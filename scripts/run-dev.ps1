$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}

Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Backend debe estar en: http://127.0.0.1:8888" -ForegroundColor Gray
npm run dev
