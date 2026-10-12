$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function Get-HeaderHeight {
  param([string]$Path)

  $bmp = [System.Drawing.Bitmap]::new($Path)
  try {
    $w = $bmp.Width
    $h = $bmp.Height
    $step = [Math]::Max(1, [int]($w / 300))

    $limit = [Math]::Min($h, 260)
    $mean = New-Object double[] $limit
    $std = New-Object double[] $limit

    for ($y = 0; $y -lt $limit; $y++) {
      $sum = 0.0
      $sum2 = 0.0
      $n = 0
      for ($x = 0; $x -lt $w; $x += $step) {
        $c = $bmp.GetPixel($x, $y)
        $lum = 0.2126 * $c.R + 0.7152 * $c.G + 0.0722 * $c.B
        $sum += $lum
        $sum2 += $lum * $lum
        $n++
      }
      $m = $sum / $n
      $v = ($sum2 / $n) - ($m * $m)
      if ($v -lt 0) { $v = 0 }
      $mean[$y] = $m
      $std[$y] = [Math]::Sqrt($v)
    }

    $boundary = 64
    for ($i = 5; $i -lt $limit - 10; $i++) {
      $drop = $mean[$i - 1] - $mean[$i + 6]
      $varRise = $std[$i] -gt 22
      $meanLow = $mean[$i] -lt 220
      if ($drop -gt 16 -or ($varRise -and $meanLow)) {
        $boundary = $i
        break
      }
    }

    $sampleY = [Math]::Min($h - 1, $boundary + 60)
    $y1 = [Math]::Max(0, $sampleY - 10)
    $y2 = [Math]::Min($h - 1, $sampleY + 10)
    $lumX = New-Object double[] $w
    for ($x = 0; $x -lt $w; $x++) {
      $s = 0.0
      $n = 0
      for ($y = $y1; $y -le $y2; $y++) {
        $c = $bmp.GetPixel($x, $y)
        $s += 0.2126 * $c.R + 0.7152 * $c.G + 0.0722 * $c.B
        $n++
      }
      $lumX[$x] = $s / $n
    }
    $edgeX = 0
    $edgeScore = -1.0
    for ($x = 50; $x -lt $w - 50; $x++) {
      $d = [Math]::Abs($lumX[$x + 1] - $lumX[$x - 1])
      if ($d -gt $edgeScore) {
        $edgeScore = $d
        $edgeX = $x
      }
    }

    [pscustomobject]@{
      path = $Path
      width = $w
      height = $h
      headerPx = $boundary
      scannedRows = $limit
      sidebarEdgeX = $edgeX
      sidebarEdgeScore = [Math]::Round($edgeScore, 3)
    }
  }
  finally {
    $bmp.Dispose()
  }
}

$baseDir = Get-ChildItem "D:\\work\\mars3d\\docx" -Directory | Where-Object { $_.Name -like "SYC*_assets" } | Select-Object -First 1
if (-not $baseDir) {
  throw "assets dir not found"
}

$targets = @("image-012.png", "image-013.png")
$results = $targets | ForEach-Object { Get-HeaderHeight (Join-Path $baseDir.FullName $_) }
$json = $results | ConvertTo-Json -Compress
$out = "D:\\work\\mars3d\\scripts\\measure_layout_header.out.json"
[System.IO.File]::WriteAllText($out, $json, [System.Text.Encoding]::UTF8)
$out
