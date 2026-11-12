$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$composePath = Join-Path $repoRoot 'docker-compose.yml'
$nginxPath = Join-Path $repoRoot 'nginx.conf'
$envPath = Join-Path $repoRoot '.env.example'

$compose = Get-Content -Raw -LiteralPath $composePath
$nginx = Get-Content -Raw -LiteralPath $nginxPath
if (-not (Test-Path -LiteralPath $envPath)) { throw 'Missing .env.example' }
$envExample = Get-Content -Raw -LiteralPath $envPath

foreach ($service in @('gateway','mars3d-frontend','jeecg-backend','mysql','redis')) {
  if ($compose -notmatch "(?m)^\s{2}$([regex]::Escape($service)):\s*$") { throw "Compose service is missing: $service" }
}
foreach ($image in @('nginx:1.27.5-alpine','mysql:5.7.44','redis:6.2.14-alpine')) {
  if ($compose -notmatch [regex]::Escape($image)) { throw "Image is not pinned: $image" }
}
if ($compose -match '(?m)^\s*-\s*["'']?(3306|6379):') { throw 'MySQL or Redis is exposed on the host' }
foreach ($volume in @('mysql-data','redis-data','jeecg-data')) {
  if ($compose -notmatch "(?m)^\s{2}${volume}:\s*$") { throw "Persistent volume is missing: $volume" }
}
foreach ($variable in @('MYSQL_ROOT_PASSWORD','JEECG_DB_PASSWORD','REDIS_PASSWORD')) {
  if ($compose -notmatch [regex]::Escape('${' + $variable + ':?')) { throw "Compose does not require $variable" }
  if ($envExample -notmatch "(?m)^$variable=") { throw ".env.example is missing $variable" }
}
if ($nginx -notmatch '(?s)location\s+\^~\s+/api/data-management/.+proxy_pass\s+http://jeecg-backend:9100/jeecg-boot/;') {
  throw 'Nginx data-management route does not preserve the Jeecg context path'
}

Write-Output 'Compose and gateway checks passed.'
