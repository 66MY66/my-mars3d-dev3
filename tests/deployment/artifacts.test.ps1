$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$jarPath = Join-Path $repoRoot 'deploy\jeecg\jeecg-system-start-3.5.3.jar'
$sqlPath = Join-Path $repoRoot 'deploy\mysql\init\00-jeecgboot-mysql-5.7.sql'
$sumsPath = Join-Path $repoRoot 'deploy\jeecg\SHA256SUMS'
$expectedJarHash = '2C903050660F5AAAFB05A03286CC2EF000D6991F3C107887F846D2884DAF928F'

if (-not (Test-Path -LiteralPath $jarPath)) { throw "Missing Jeecg JAR: $jarPath" }
if (-not (Test-Path -LiteralPath $sqlPath)) { throw "Missing official Jeecg schema: $sqlPath" }
if (-not (Test-Path -LiteralPath $sumsPath)) { throw "Missing checksum manifest: $sumsPath" }

$actualJarHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $jarPath).Hash
if ($actualJarHash -ne $expectedJarHash) {
  throw "Jeecg JAR checksum mismatch: expected $expectedJarHash, got $actualJarHash"
}

$sql = Get-Content -Raw -LiteralPath $sqlPath
foreach ($requiredTable in @('sys_user', 'sys_permission', 'sys_role', 'sys_role_permission')) {
  if ($sql -notmatch "(?i)CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?``?$requiredTable``?") {
    throw "Official schema is missing required table: $requiredTable"
  }
}

$sums = Get-Content -Raw -LiteralPath $sumsPath
if ($sums -notmatch [regex]::Escape($expectedJarHash.ToLowerInvariant())) {
  throw 'SHA256SUMS does not record the approved JAR checksum'
}
if ($sums -notmatch 'github\.com/jeecgboot/JeecgBoot.+v3\.5\.3') {
  throw 'SHA256SUMS does not record the official v3.5.3 schema source URL'
}

Write-Output 'Artifact provenance checks passed.'
