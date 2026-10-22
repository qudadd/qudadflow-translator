[CmdletBinding()]
param([string]$OutputDirectory = '')

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root 'manifest.json') | ConvertFrom-Json
if ($manifest.manifest_version -ne 3) { throw 'Manifest V3 is required.' }
if (-not $manifest.background.service_worker) { throw 'Missing service worker.' }
if (-not (Test-Path -LiteralPath (Join-Path $root $manifest.background.service_worker))) { throw 'Service worker file does not exist.' }

& node (Join-Path $root 'tools\validate-package.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Package validation failed.' }
$inventoryJson = & node (Join-Path $root 'tools\package-files.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Could not enumerate package files.' }
$inventory = $inventoryJson | ConvertFrom-Json
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $root '..\..\outputs' }
$outputRoot = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
$staging = Join-Path $root ('.package-staging-' + [Guid]::NewGuid().ToString('N'))
if (-not ([IO.Path]::GetFullPath($staging)).StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid staging path.' }
New-Item -ItemType Directory -Path $staging | Out-Null

function Write-ZipPackage([string]$Directory, [string]$Destination) {
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $temporaryZip = $Destination + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
  $stream = $null
  $archive = $null
  try {
    $stream = [IO.File]::Open($temporaryZip, [IO.FileMode]::CreateNew)
    $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $false)
    [string[]]$entryNames = @(Get-ChildItem -LiteralPath $Directory -File -Recurse | ForEach-Object { $_.FullName.Substring($Directory.Length + 1).Replace('\', '/') })
    [Array]::Sort($entryNames, [StringComparer]::Ordinal)
    $zipTimestamp = [DateTimeOffset]::new(2000, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
    foreach ($entryName in $entryNames) {
      $entry = $archive.CreateEntry($entryName, [IO.Compression.CompressionLevel]::Optimal)
      $entry.LastWriteTime = $zipTimestamp
      $entry.ExternalAttributes = 0
      $sourceStream = $null
      $entryStream = $null
      try {
        $sourceStream = [IO.File]::OpenRead((Join-Path $Directory $entryName))
        $entryStream = $entry.Open()
        $sourceStream.CopyTo($entryStream)
      } finally {
        if ($entryStream) { $entryStream.Dispose() }
        if ($sourceStream) { $sourceStream.Dispose() }
      }
    }
    $archive.Dispose()
    $archive = $null
    $stream.Dispose()
    $stream = $null
    Move-Item -LiteralPath $temporaryZip -Destination $Destination -Force
  } finally {
    if ($archive) { $archive.Dispose() }
    if ($stream) { $stream.Dispose() }
    if (Test-Path -LiteralPath $temporaryZip) { Remove-Item -LiteralPath $temporaryZip -Force }
  }
}

try {
  $runtimeStage = Join-Path $staging 'runtime'
  $sourceStage = Join-Path $staging 'source'
  $artifactStage = Join-Path $staging 'artifacts'
  New-Item -ItemType Directory -Path $runtimeStage, $sourceStage, $artifactStage | Out-Null
  foreach ($kind in @('runtime','source')) {
    $targetStage = if ($kind -eq 'runtime') { $runtimeStage } else { $sourceStage }
    foreach ($relative in $inventory.$kind) {
      $destination = Join-Path $targetStage $relative
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
      Copy-Item -LiteralPath (Join-Path $root $relative) -Destination $destination
    }
  }
  & node (Join-Path $root 'tools\validate-package.mjs') $runtimeStage
  if ($LASTEXITCODE -ne 0) { throw 'Staged runtime validation failed.' }
  $zipPath = Join-Path $artifactStage ("qudadflow-translator-v{0}.zip" -f $manifest.version)
  $sourceZipPath = Join-Path $artifactStage ("qudadflow-translator-source-v{0}.zip" -f $manifest.version)
  Write-ZipPackage -Directory $runtimeStage -Destination $zipPath
  Write-ZipPackage -Directory $sourceStage -Destination $sourceZipPath
  & node (Join-Path $root 'tools\audit-package.cjs') $artifactStage
  if ($LASTEXITCODE -ne 0) { throw 'Archive verification failed; existing output packages were preserved.' }
  foreach ($artifact in Get-ChildItem -LiteralPath $artifactStage -File) {
    Move-Item -LiteralPath $artifact.FullName -Destination (Join-Path $outputRoot $artifact.Name) -Force
  }
  Write-Output "Verified runtime, source, audit and SHA256 files: $outputRoot"
} finally {
  $resolvedStaging = [IO.Path]::GetFullPath($staging)
  if ($resolvedStaging.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedStaging)) {
    Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
  }
}
