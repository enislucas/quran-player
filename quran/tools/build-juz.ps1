param(
  [switch]$ForceRebuild
)

$ErrorActionPreference = 'Stop'
$Invariant = [Globalization.CultureInfo]::InvariantCulture

$QuranRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$RepoRoot = Split-Path -Parent $QuranRoot
$AudioDir = Join-Path $QuranRoot 'audio'
$WorkRoot = Join-Path $RepoRoot '.work\juz-build\lossless'
$ManifestPath = Join-Path $QuranRoot 'juz-manifest.json'

# Each boundary was acoustically aligned against Mahmoud Khalil Al-Husary's
# verse-by-verse recording. File is the existing hourly transport chunk and
# seconds is the boundary within that file. The final entry is the Quran end.
$Boundaries = @(
  [pscustomobject]@{ Juz=1;  File=1;  Seconds=0.000;    First='1:1';   Last='2:141' },
  [pscustomobject]@{ Juz=2;  File=2;  Seconds=1318.924; First='2:142'; Last='2:252' },
  [pscustomobject]@{ Juz=3;  File=3;  Seconds=2919.199; First='2:253'; Last='3:92' },
  [pscustomobject]@{ Juz=4;  File=5;  Seconds=680.583;  First='3:93';  Last='4:23' },
  [pscustomobject]@{ Juz=5;  File=6;  Seconds=2217.379; First='4:24';  Last='4:147' },
  [pscustomobject]@{ Juz=6;  File=7;  Seconds=3184.341; First='4:148'; Last='5:81' },
  [pscustomobject]@{ Juz=7;  File=9;  Seconds=934.101;  First='5:82';  Last='6:110' },
  [pscustomobject]@{ Juz=8;  File=10; Seconds=2852.546; First='6:111'; Last='7:87' },
  [pscustomobject]@{ Juz=9;  File=12; Seconds=2879.702; First='7:88';  Last='8:40' },
  [pscustomobject]@{ Juz=10; File=14; Seconds=481.765;  First='8:41';  Last='9:92' },
  [pscustomobject]@{ Juz=11; File=15; Seconds=1931.051; First='9:93';  Last='11:5' },
  [pscustomobject]@{ Juz=12; File=16; Seconds=3512.334; First='11:6';  Last='12:52' },
  [pscustomobject]@{ Juz=13; File=18; Seconds=1170.272; First='12:53'; Last='14:52' },
  [pscustomobject]@{ Juz=14; File=19; Seconds=2552.170; First='15:1';  Last='16:128' },
  [pscustomobject]@{ Juz=15; File=21; Seconds=210.480;  First='17:1';  Last='18:74' },
  [pscustomobject]@{ Juz=16; File=22; Seconds=1882.236; First='18:75'; Last='20:135' },
  [pscustomobject]@{ Juz=17; File=24; Seconds=187.350;  First='21:1';  Last='22:78' },
  [pscustomobject]@{ Juz=18; File=25; Seconds=746.390;  First='23:1';  Last='25:20' },
  [pscustomobject]@{ Juz=19; File=26; Seconds=2519.642; First='25:21'; Last='27:55' },
  [pscustomobject]@{ Juz=20; File=28; Seconds=1028.990; First='27:56'; Last='29:45' },
  [pscustomobject]@{ Juz=21; File=29; Seconds=2934.999; First='29:46'; Last='33:30' },
  [pscustomobject]@{ Juz=22; File=31; Seconds=974.899;  First='33:31'; Last='36:27' },
  [pscustomobject]@{ Juz=23; File=32; Seconds=2305.432; First='36:28'; Last='39:31' },
  [pscustomobject]@{ Juz=24; File=34; Seconds=1029.737; First='39:32'; Last='41:46' },
  [pscustomobject]@{ Juz=25; File=35; Seconds=2278.846; First='41:47'; Last='45:37' },
  [pscustomobject]@{ Juz=26; File=37; Seconds=861.890;  First='46:1';  Last='51:30' },
  [pscustomobject]@{ Juz=27; File=38; Seconds=2465.472; First='51:31'; Last='57:29' },
  [pscustomobject]@{ Juz=28; File=40; Seconds=743.430;  First='58:1';  Last='66:12' },
  [pscustomobject]@{ Juz=29; File=41; Seconds=2361.650; First='67:1';  Last='77:50' },
  [pscustomobject]@{ Juz=30; File=43; Seconds=466.860;  First='78:1';  Last='114:6' },
  [pscustomobject]@{ Juz=31; File=44; Seconds=2191.261406; First=$null; Last=$null }
)

function Get-SourcePath([int]$Number) {
  return Join-Path $AudioDir ('quran-{0}.m4a' -f $Number.ToString('000'))
}

function Get-Duration([string]$Path) {
  $value = & ffprobe.exe -v error -show_entries format=duration -of csv=p=0 $Path
  if ($LASTEXITCODE -ne 0) { throw "ffprobe failed for $Path" }
  [double]$duration = 0
  if (-not [double]::TryParse($value, [Globalization.NumberStyles]::Float, $Invariant, [ref]$duration)) {
    throw "Invalid duration for $Path`: $value"
  }
  return $duration
}

function Convert-ToConcatPath([string]$Path) {
  $forward = [IO.Path]::GetFullPath($Path).Replace('\', '/')
  return $forward.Replace("'", "'\''")
}

function Get-Sha256([string]$Path) {
  for ($attempt = 1; $attempt -le 20; $attempt++) {
    try { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash }
    catch {
      if ($attempt -eq 20) { throw }
      Start-Sleep -Milliseconds 100
    }
  }
}

function New-TrimmedPiece([string]$Source, [string]$Destination, [double]$Start, [Nullable[double]]$Length) {
  $arguments = @('-hide_banner', '-loglevel', 'error', '-y')
  if ($Start -gt 0) { $arguments += @('-ss', $Start.ToString('0.######', $Invariant)) }
  $arguments += @('-i', $Source)
  if ($null -ne $Length) { $arguments += @('-t', ([double]$Length).ToString('0.######', $Invariant)) }
  $arguments += @('-map', '0:a:0', '-c', 'copy', '-avoid_negative_ts', 'make_zero', '-movflags', '+faststart', $Destination)
  & ffmpeg.exe @arguments
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed while trimming $Source" }
}

New-Item -ItemType Directory -Path $WorkRoot, $AudioDir -Force | Out-Null

$SourceDurations = @{}
for ($number = 1; $number -le 44; $number++) {
  $source = Get-SourcePath $number
  if (-not (Test-Path -LiteralPath $source)) { throw "Missing source audio: $source" }
  $SourceDurations[$number] = Get-Duration $source
}

function Get-GlobalSeconds($Boundary) {
  [double]$total = $Boundary.Seconds
  for ($n = 1; $n -lt $Boundary.File; $n++) { $total += $SourceDurations[$n] }
  return $total
}

$manifestJuz = @()
for ($index = 0; $index -lt 30; $index++) {
  $start = $Boundaries[$index]
  $end = $Boundaries[$index + 1]
  $number = $start.Juz.ToString('000')
  $output = Join-Path $AudioDir "juz-$number.m4a"
  $pieceDir = Join-Path $WorkRoot "juz-$number"
  New-Item -ItemType Directory -Path $pieceDir -Force | Out-Null

  if ($ForceRebuild -or -not (Test-Path -LiteralPath $output) -or (Get-Item -LiteralPath $output).Length -eq 0) {
    Write-Host "Building Juz $($start.Juz) of 30..."
    $pieces = @()
    if ($start.File -eq $end.File) {
      $piece = Join-Path $pieceDir 'only.m4a'
      New-TrimmedPiece (Get-SourcePath $start.File) $piece $start.Seconds ($end.Seconds - $start.Seconds)
      $pieces += $piece
    } else {
      if ($start.Seconds -le 0.0005) {
        $pieces += Get-SourcePath $start.File
      } else {
        $piece = Join-Path $pieceDir 'first.m4a'
        New-TrimmedPiece (Get-SourcePath $start.File) $piece $start.Seconds $null
        $pieces += $piece
      }
      for ($fileNumber = $start.File + 1; $fileNumber -lt $end.File; $fileNumber++) {
        $pieces += Get-SourcePath $fileNumber
      }
      if ($end.Seconds -ge $SourceDurations[$end.File] - 0.05) {
        $pieces += Get-SourcePath $end.File
      } elseif ($end.Seconds -gt 0.0005) {
        $piece = Join-Path $pieceDir 'last.m4a'
        New-TrimmedPiece (Get-SourcePath $end.File) $piece 0 $end.Seconds
        $pieces += $piece
      }
    }

    $listPath = Join-Path $pieceDir 'concat.txt'
    $listLines = @($pieces | ForEach-Object { "file '$(Convert-ToConcatPath $_)'" })
    [IO.File]::WriteAllLines($listPath, $listLines, (New-Object Text.UTF8Encoding($false)))
    & ffmpeg.exe -hide_banner -loglevel error -y -f concat -safe 0 -i $listPath `
      -map 0:a:0 -c copy -movflags +faststart -metadata "title=Juz $($start.Juz)" $output
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed while joining Juz $($start.Juz)" }
  }

  $actualDuration = Get-Duration $output
  $expectedDuration = (Get-GlobalSeconds $end) - (Get-GlobalSeconds $start)
  if ([math]::Abs($actualDuration - $expectedDuration) -gt 1.0) {
    throw "Juz $($start.Juz) duration differs by more than one second: actual=$actualDuration expected=$expectedDuration"
  }
  $outputInfo = Get-Item -LiteralPath $output
  if ($outputInfo.Length -ge 100MB) { throw "Juz $($start.Juz) exceeds GitHub's 100 MB file limit" }

  $manifestJuz += [ordered]@{
    juz = $start.Juz
    firstVerse = $start.First
    lastVerse = $start.Last
    encodedDurationSeconds = [math]::Round($actualDuration, 3)
    bytes = $outputInfo.Length
    sha256 = Get-Sha256 $output
    file = "audio/juz-$number.m4a"
  }
}

$manifest = [ordered]@{
  generatedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  reciter = 'Mahmoud Khalil Al-Husary'
  source = 'Existing 44-file Quran recording, losslessly cut at acoustically verified canonical Juz boundaries'
  sourceFiles = 'audio/quran-001.m4a through audio/quran-044.m4a'
  encoding = 'mono AAC, 32 kHz, approximately 40 kbps (stream copy; no re-encoding)'
  totalBytes = [int64](($manifestJuz | ForEach-Object { [int64]$_['bytes'] } | Measure-Object -Sum).Sum)
  juz = $manifestJuz
}
$manifestJson = $manifest | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText($ManifestPath, $manifestJson + [Environment]::NewLine,
  (New-Object Text.UTF8Encoding($false)))

Write-Host "Built 30 lossless Juz files and wrote $ManifestPath"
