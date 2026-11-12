$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$dockerfilePath = Join-Path $repoRoot 'deploy\jeecg\Dockerfile'
$configPath = Join-Path $repoRoot 'deploy\jeecg\application-docker.yml'
if (-not (Test-Path -LiteralPath $dockerfilePath)) { throw 'Missing Jeecg Dockerfile' }
if (-not (Test-Path -LiteralPath $configPath)) { throw 'Missing application-docker.yml' }

$dockerfile = Get-Content -Raw -LiteralPath $dockerfilePath
$config = Get-Content -Raw -LiteralPath $configPath

if ($dockerfile -notmatch '(?im)^FROM\s+eclipse-temurin:8-jre-jammy\s*$') { throw 'Jeecg runtime is not pinned to Java 8 JRE Jammy' }
if ($dockerfile -notmatch 'spring\.profiles\.active=docker') { throw 'Jeecg container does not activate the docker profile' }
if ($dockerfile -notmatch 'application-docker\.yml') { throw 'Jeecg container does not install external Docker configuration' }

foreach ($variable in @('JEECG_DB_HOST','JEECG_DB_NAME','JEECG_DB_USER','JEECG_DB_PASSWORD','JEECG_REDIS_HOST','JEECG_REDIS_PASSWORD')) {
  if ($config -notmatch [regex]::Escape('${' + $variable + '}')) { throw "Missing environment override: $variable" }
}

foreach ($prefix in @('satelliteDataPool','satelliteMetadata','satelliteDataCatalog','satelliteDataQuery','satelliteDataShare')) {
  if ($config -notmatch [regex]::Escape("/ai2/$prefix/**")) { throw "Anonymous access is missing for $prefix" }
}
if ($config -match '/ai2/\*\*') { throw 'Anonymous access is broader than the five approved satellite controllers' }
if ($config -notmatch '(?m)^\s*check-enabled:\s*false\s*$') { throw 'Elasticsearch startup check is not disabled' }
if ($config -notmatch '(?m)^\s*context-path:\s*/jeecg-boot\s*$') { throw 'Jeecg context path is incorrect' }

Write-Output 'Jeecg runtime configuration checks passed.'
