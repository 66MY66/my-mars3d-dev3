param(
  [string]$BaseUrl = 'http://127.0.0.1:8888'
)

$ErrorActionPreference = 'Stop'
$resources = @(
  'satelliteDataPool',
  'satelliteMetadata',
  'satelliteDataCatalog',
  'satelliteDataQuery',
  'satelliteDataShare'
)

foreach ($resource in $resources) {
  $uri = "$($BaseUrl.TrimEnd('/'))/api/data-management/ai2/$resource/list?pageNo=1&pageSize=1"
  try {
    $response = Invoke-RestMethod -Method Get -Uri $uri -TimeoutSec 20
  }
  catch {
    Write-Error "$resource request failed: $($_.Exception.Message)"
    exit 1
  }

  if ($response.success -ne $true -or $null -eq $response.result.records) {
    Write-Error "$resource returned an unexpected Jeecg response"
    exit 1
  }

  Write-Host "OK $resource total=$($response.result.total)"
}

Write-Host 'All five data-management endpoints are reachable.'
