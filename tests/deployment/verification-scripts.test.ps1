$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$verifyScript = Join-Path $root 'scripts/verify-data-management.ps1'
$mockServer = Join-Path $PSScriptRoot 'fixtures/mock-data-management-server.mjs'

if (-not (Test-Path $verifyScript)) {
  throw "Missing verification script: $verifyScript"
}

$port = 39127
$process = Start-Process -FilePath 'node' -ArgumentList @("`"$mockServer`"", $port) -PassThru -WindowStyle Hidden
try {
  $ready = $false
  foreach ($attempt in 1..20) {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$port/api/data-management/ai2/satelliteDataPool/list" -TimeoutSec 1 | Out-Null
      $ready = $true
      break
    }
    catch {
      Start-Sleep -Milliseconds 100
    }
  }
  if (-not $ready) {
    throw 'Mock data-management server did not start'
  }
  $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $verifyScript -BaseUrl "http://127.0.0.1:$port" 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Verification script failed: $($output -join [Environment]::NewLine)"
  }
  $expected = @('satelliteDataPool', 'satelliteMetadata', 'satelliteDataCatalog', 'satelliteDataQuery', 'satelliteDataShare')
  foreach ($resource in $expected) {
    if (($output -join "`n") -notmatch [regex]::Escape($resource)) {
      throw "Verification output did not include $resource"
    }
  }
}
finally {
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
}

Write-Host 'Verification script behavior passed.'
