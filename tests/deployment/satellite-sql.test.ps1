$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$sqlPath = Join-Path $repoRoot 'deploy\mysql\init\10-satellite-data-management.sql'
if (-not (Test-Path -LiteralPath $sqlPath)) { throw "Missing satellite schema: $sqlPath" }

$sql = Get-Content -Raw -LiteralPath $sqlPath
$tables = @(
  'satellite_data_pool',
  'satellite_metadata',
  'satellite_data_catalog',
  'satellite_data_query',
  'satellite_data_share'
)

foreach ($table in $tables) {
  if ($sql -notmatch "(?i)CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+``$table``") {
    throw "Missing idempotent DDL for $table"
  }
}

foreach ($column in @('pool_name', 'total_capacity', 'used_capacity', 'satellites', 'storage_path')) {
  if ($sql -notmatch "(?i)``$column``") { throw "Pool schema is missing $column" }
}
foreach ($column in @('satellite', 'sensor', 'observation_time', 'cloud_cover', 'scene_id', 'projection_crs')) {
  if ($sql -notmatch "(?i)``$column``") { throw "Metadata schema is missing $column" }
}

if ($sql -notmatch "(?i)INSERT\s+INTO\s+``satellite_data_pool``.+ON\s+DUPLICATE\s+KEY\s+UPDATE") {
  throw 'Pool seed data is not idempotent'
}
if ($sql -notmatch "(?i)INSERT\s+INTO\s+``satellite_metadata``.+ON\s+DUPLICATE\s+KEY\s+UPDATE") {
  throw 'Metadata seed data is not idempotent'
}

Write-Output 'Satellite schema checks passed.'
