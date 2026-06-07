# memlink installer (Windows PowerShell)
# https://github.com/rblez/memlink
#
# irm https://raw.githubusercontent.com/rblez/memlink/main/install.ps1 | iex
#
# Opt-out of anonymous install reports: $env:MEMLINK_NO_REPORT = "1"

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

$Repo       = 'rblez/memlink'
$BinName    = 'memlink.exe'
$ReportUrl  = $env:MEMLINK_REPORT_URL
if (-not $ReportUrl) { $ReportUrl = 'https://api.memlink.cloud/v1/install/report' }
$InstallDir = $env:MEMLINK_INSTALL_DIR
if (-not $InstallDir) { $InstallDir = Join-Path $env:LOCALAPPDATA 'memlink' }

$InstallId = [guid]::NewGuid().ToString()
$Version   = ''
$Arch      = ''
$StartTime = [int][double]::Parse((Get-Date -UFormat %s))

# ─── Helpers ────────────────────────────────────────────────────────────────

function Write-Cyan  { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Green { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Red   { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Dim   { param($msg) Write-Host $msg -ForegroundColor DarkGray }

# ─── Reporting (best-effort, never fails install) ──────────────────────────

function Send-Report {
  param(
    [string]$Event,
    [int]$ExitCode = 0,
    [int]$Line = 0,
    [string]$Message = ''
  )

  if ($env:MEMLINK_NO_REPORT) { return }

  $duration = ([int][double]::Parse((Get-Date -UFormat %s))) - $StartTime
  $payload = @{
    install_id = $InstallId
    repo       = $Repo
    os         = 'windows'
    arch       = $Arch
    version    = $Version
    event      = $Event
    exit_code  = $ExitCode
    line       = $Line
    message    = $Message
    duration_ms = $duration * 1000
    shell      = 'powershell'
  } | ConvertTo-Json -Compress

  try {
    Invoke-RestMethod -Uri $ReportUrl `
      -Method Post `
      -ContentType 'application/json' `
      -UserAgent 'memlink-install/1.1.3' `
      -Body $payload `
      -TimeoutSec 5 | Out-Null
  } catch {
    # swallow — reporting must never fail install
  }
}

# ─── Failure trap ───────────────────────────────────────────────────────────

trap {
  $exitCode = $LASTEXITCODE
  if (-not $exitCode) { $exitCode = 1 }
  Send-Report -Event 'failure' -ExitCode $exitCode -Line $_.InvocationInfo.ScriptLineNumber -Message $_.Exception.Message
  Write-Red "Install failed. You can report this issue at:"
  Write-Red "  https://github.com/$Repo/issues"
}

# ─── Detect arch ────────────────────────────────────────────────────────────

if ([Environment]::Is64BitOperatingSystem) {
  $Arch = 'amd64'
} else {
  Write-Red "32-bit Windows is not supported."
  Send-Report -Event 'failure' -Message 'unsupported-arch'
  exit 1
}

Send-Report -Event 'start'

# ─── Detect latest version ─────────────────────────────────────────────────

try {
  $release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest" -TimeoutSec 15
} catch {
  Write-Red "Could not fetch latest release from GitHub."
  Write-Red "Check your internet connection or download manually:"
  Write-Red "  https://github.com/$Repo/releases"
  Send-Report -Event 'failure' -Message 'fetch-latest-failed'
  exit 1
}

$Version = $release.tag_name -replace '^v', ''
if (-not $Version) {
  Write-Red "Could not parse latest version."
  Send-Report -Event 'failure' -Message 'parse-version-failed'
  exit 1
}

# ─── Find asset ─────────────────────────────────────────────────────────────

$assetName = "memlink-windows-$Arch.zip"
$asset = $release.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1
if (-not $asset) {
  Write-Red "No $assetName asset in release $Version."
  Send-Report -Event 'failure' -Message 'asset-not-found'
  exit 1
}

# ─── Install ────────────────────────────────────────────────────────────────

Write-Cyan "Installing memlink v$Version ($Arch) -> $InstallDir"
Write-Cyan ""
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

$zipPath = Join-Path $env:TEMP "memlink-$Version-$Arch.zip"
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath -UseBasicParsing
Expand-Archive -Path $zipPath -DestinationPath $InstallDir -Force
Remove-Item $zipPath -Force

$binPath = Join-Path $InstallDir $BinName
if (-not (Test-Path $binPath)) {
  Write-Red "Install failed: $binPath not found."
  Send-Report -Event 'failure' -Message 'bin-not-found'
  exit 1
}

# Smoke test
try {
  & $binPath --version | Out-Null
} catch {
  Write-Red "Installed binary failed self-test: $_"
  Send-Report -Event 'failure' -Message 'self-test-failed'
  exit 1
}

# ─── Add to user PATH ───────────────────────────────────────────────────────

$currentPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($currentPath -notlike "*$InstallDir*") {
  [Environment]::SetEnvironmentVariable('Path', "$currentPath;$InstallDir", 'User')
  $env:Path = "$env:Path;$InstallDir"
  Write-Green "  Added $InstallDir to user PATH."
}

Write-Cyan ""
Write-Green "memlink v$Version installed."
Write-Cyan ""
Write-Dim "Try it:"
Write-Dim "  memlink --version"
Write-Dim "  memlink serve --daemon"
Write-Dim ""
Write-Dim "Note: Windows has no native user daemon. To run 24/7 use one of:"
Write-Dim "  - NSSM:  nssm install Memlink `"$InstallDir\memlink.exe`" `"serve --daemon`""
Write-Dim "  - pm2:   pm2 start memlink -- serve --daemon"
Write-Dim "  - Task Scheduler: create a task with trigger AtStartup"
Write-Cyan ""

Send-Report -Event 'success'
