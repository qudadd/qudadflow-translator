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
    foreach ($file in Get-ChildItem -LiteralPath $Directory -File -Recurse) {
      $entryName = $file.FullName.Substring($Directory.Length + 1).Replace('\', '/')
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entryName, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
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

$files = @(
  'manifest.json', 'popup.html', 'popup.css', 'popup.js',
  'options.html', 'options.css', 'options.js', 'privacy.html',
  'src\background.js', 'src\content.js', 'src\document-format.mjs', 'src\docx-worker.js',
  'src\profile-store.js', 'src\my-memory.js',
  'reader.html', 'reader.css', 'reader.js', 'THIRD_PARTY_NOTICES.md',
  '_locales\en\messages.json', '_locales\zh_CN\messages.json',
  'assets\icon16.png', 'assets\icon32.png', 'assets\icon48.png', 'assets\icon128.png'
)
$files += Get-ChildItem -LiteralPath (Join-Path $root 'vendor') -File -Recurse | ForEach-Object { $_.FullName.Substring($root.Length + 1) }
try {
  $runtimeStage = Join-Path $staging 'runtime'
  $sourceStage = Join-Path $staging 'source'
  New-Item -ItemType Directory -Path $runtimeStage, $sourceStage | Out-Null
  foreach ($relative in $files) {
    $source = Join-Path $root $relative
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing runtime file: $relative" }
    $destination = Join-Path $runtimeStage $relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination
  }
  foreach ($relative in @('manifest.json','popup.html','popup.css','popup.js','options.html','options.css','options.js','privacy.html','reader.html','reader.css','reader.js','THIRD_PARTY_NOTICES.md','vendor','src','assets','_locales','branding','docs','tools','README.md','README.zh-CN.md','.gitignore','package.ps1')) {
    Copy-Item -LiteralPath (Join-Path $root $relative) -Destination $sourceStage -Recurse
  }
  $zipPath = Join-Path $outputRoot ("qudadflow-translator-v{0}.zip" -f $manifest.version)
  $sourceZipPath = Join-Path $outputRoot ("qudadflow-translator-source-v{0}.zip" -f $manifest.version)
  Write-ZipPackage -Directory $runtimeStage -Destination $zipPath
  Write-ZipPackage -Directory $sourceStage -Destination $sourceZipPath
  Write-Output "Runtime package: $zipPath"
  Write-Output "Source package: $sourceZipPath"
} finally {
  $resolvedStaging = [IO.Path]::GetFullPath($staging)
  if ($resolvedStaging.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedStaging)) {
    Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
  }
}
