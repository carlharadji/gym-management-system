param(
  [switch]$NoOpen,
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $PSScriptRoot
$WebsiteUrl = "http://127.0.0.1:5173/"

$BundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
$BundledFallback = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback"

if (Test-Path $BundledNode) {
  $env:Path = "$BundledNode;$env:Path"
}

if (Test-Path $BundledFallback) {
  $env:Path = "$BundledFallback;$env:Path"
}

$PnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue

if (-not $PnpmCommand) {
  $PnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
}

if (-not $PnpmCommand) {
  throw "pnpm was not found. Install pnpm or open the project through Codex/VS Code once so the bundled runtime is available."
}

Write-Host ""
Write-Host "Starting Local Gym Management System..." -ForegroundColor Yellow
Write-Host "Project: $ProjectDir"
Write-Host ""

Push-Location $ProjectDir
try {
  & $PnpmCommand.Source start:local

  if ($LASTEXITCODE -ne 0) {
    throw "The app did not start successfully."
  }
} finally {
  Pop-Location
}

if (-not $NoOpen) {
  Start-Process $WebsiteUrl
}

Write-Host ""
Write-Host "Website: $WebsiteUrl" -ForegroundColor Yellow
Write-Host "The website and database server are running in the background."
Write-Host ""

if (-not $NoPause) {
  Read-Host "Press Enter to close this launcher window"
}
