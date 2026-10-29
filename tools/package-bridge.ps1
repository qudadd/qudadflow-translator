[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$NodeDistributionZip,
    [Parameter(Mandatory=$true)][string]$ExpectedNodeZipSha256,
    [Parameter(Mandatory=$true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$source = Join-Path $repo 'native-host'
$version = (Get-Content -LiteralPath (Join-Path $repo 'manifest.json') -Raw | ConvertFrom-Json).version
$nodeZip = [IO.Path]::GetFullPath($NodeDistributionZip)
$output = [IO.Path]::GetFullPath($OutputDirectory)
if (-not (Test-Path -LiteralPath $nodeZip -PathType Leaf)) { throw 'Node distribution ZIP is missing.' }
if ($ExpectedNodeZipSha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'Expected Node SHA256 is invalid.' }
$nodeHash = (Get-FileHash -LiteralPath $nodeZip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($nodeHash -ne $ExpectedNodeZipSha256.ToLowerInvariant()) { throw 'Node distribution SHA256 does not match the official checksum.' }
New-Item -ItemType Directory -Path $output -Force | Out-Null
$assetName = "qudadflow-chatgpt-bridge-win-x64-v$version.zip"
$asset = Join-Path $output $assetName
$installerName = "qudadflow-chatgpt-bridge-installer-win-x64-v$version.exe"
$installer = Join-Path $output $installerName
if ((Test-Path -LiteralPath $asset) -or (Test-Path -LiteralPath $installer)) { throw 'Bridge asset already exists; choose a new output directory.' }
$stage = [IO.Path]::GetFullPath((Join-Path $output ('.bridge-staging-' + [Guid]::NewGuid().ToString('N'))))
if (-not $stage.StartsWith($output + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid staging path.' }
New-Item -ItemType Directory -Path $stage | Out-Null
try {
    Add-Type -AssemblyName System.IO.Compression
    $distribution = [IO.Compression.ZipFile]::OpenRead($nodeZip)
    try {
        $nodeEntry = @($distribution.Entries | Where-Object { $_.FullName -match '^node-v[0-9.]+-win-x64/node\.exe$' })
        $licenseEntry = @($distribution.Entries | Where-Object { $_.FullName -match '^node-v[0-9.]+-win-x64/LICENSE$' })
        if ($nodeEntry.Count -ne 1 -or $licenseEntry.Count -ne 1) { throw 'Node distribution is missing its executable or license.' }
        foreach ($item in @(@($nodeEntry[0], 'node.exe'), @($licenseEntry[0], 'NODE_LICENSE.txt'))) {
            $destination = Join-Path $stage $item[1]
            $inputStream = $item[0].Open()
            $outputStream = [IO.File]::Create($destination)
            try { $inputStream.CopyTo($outputStream) }
            finally { $outputStream.Dispose(); $inputStream.Dispose() }
        }
    } finally { $distribution.Dispose() }
    $bundledNode = Join-Path $stage 'node.exe'
    $nodeInfo = (& $bundledNode -p "process.version+' '+process.arch").Trim()
    if ($LASTEXITCODE -ne 0 -or $nodeInfo -notmatch '^v24\.[0-9.]+ x64$') { throw 'Unexpected Node runtime or architecture.' }
    $compiler = Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
    if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework compiler is required to build the bridge launcher.' }
    $launcher = Join-Path $stage 'QudadFlowBridge.exe'
    & $compiler /nologo /target:exe /reference:System.Web.Extensions.dll /reference:System.Security.dll "/out:$launcher" (Join-Path $source 'Launcher.cs')
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $launcher)) { throw 'Bridge launcher compilation failed.' }
    $included = @('Install-Bridge.ps1','Install-Bridge.cmd','Uninstall-Bridge.ps1','Uninstall-Bridge.cmd',
        'Launcher.cs','README-BRIDGE.md','main.mjs','openai.mjs','service.mjs','credentials.mjs','credential-crypto.ps1')
    foreach ($name in $included) { Copy-Item -LiteralPath (Join-Path $source $name) -Destination (Join-Path $stage $name) -Force }
    $fileHashes = [ordered]@{}
    foreach ($file in Get-ChildItem -LiteralPath $stage -File | Sort-Object Name) {
        $fileHashes[$file.Name] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    $bundleManifest = [ordered]@{ version=$version; platform='Windows x64'; nodeVersion=$nodeInfo; nodeDistributionSha256=$nodeHash; fileSha256=$fileHashes }
    [IO.File]::WriteAllText((Join-Path $stage 'bridge-manifest.json'),($bundleManifest | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
    $archiveStream = [IO.File]::Open($asset,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
    $archive = [IO.Compression.ZipArchive]::new($archiveStream,[IO.Compression.ZipArchiveMode]::Create,$false)
    try {
        foreach ($file in Get-ChildItem -LiteralPath $stage -File | Sort-Object Name) {
            $entry = $archive.CreateEntry($file.Name,[IO.Compression.CompressionLevel]::Optimal)
            $entry.LastWriteTime = [DateTimeOffset]::Parse('1980-01-01T00:00:00Z')
            $inputStream = [IO.File]::OpenRead($file.FullName)
            $outputStream = $entry.Open()
            try { $inputStream.CopyTo($outputStream) }
            finally { $outputStream.Dispose(); $inputStream.Dispose() }
        }
    } finally { $archive.Dispose() }
    $verified = [IO.Compression.ZipFile]::OpenRead($asset)
    try {
        $stagedFiles = @(Get-ChildItem -LiteralPath $stage -File | Sort-Object Name)
        if ($verified.Entries.Count -ne $stagedFiles.Count) { throw 'Bridge ZIP file count differs from staging.' }
        foreach ($file in $stagedFiles) {
            $entry = $verified.GetEntry($file.Name)
            if (-not $entry -or $entry.Length -ne $file.Length) { throw "Bridge ZIP entry mismatch: $($file.Name)" }
            $stream = $entry.Open()
            try { $entryHash = [Convert]::ToHexString(([Security.Cryptography.SHA256]::Create()).ComputeHash($stream)).ToLowerInvariant() }
            finally { $stream.Dispose() }
            if ($entryHash -ne (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()) { throw "Bridge ZIP checksum mismatch: $($file.Name)" }
        }
    } finally { $verified.Dispose() }
    & $compiler /nologo /target:winexe /codepage:65001 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /reference:System.Web.Extensions.dll "/resource:$asset,QudadFlowBridgeBundle" "/out:$installer" (Join-Path $source 'Installer.cs')
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $installer)) { throw 'Bridge installer compilation failed.' }
    $installerCheck = Start-Process -FilePath $installer -ArgumentList '--self-test' -WindowStyle Hidden -Wait -PassThru
    if ($installerCheck.ExitCode -ne 0) { throw 'Bridge installer could not verify and extract its embedded bundle.' }
    $validation = [ordered]@{ asset=$assetName; bytes=(Get-Item -LiteralPath $asset).Length; sha256=(Get-FileHash -LiteralPath $asset -Algorithm SHA256).Hash.ToLowerInvariant(); files=$stagedFiles.Count; nodeDistributionSha256=$nodeHash; nodeVersion=$nodeInfo; verified=$true; installer=$installerName; installerBytes=(Get-Item -LiteralPath $installer).Length; installerSha256=(Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant(); installerSelfTest='passed' }
    [IO.File]::WriteAllText((Join-Path $output 'bridge-validation.json'),($validation | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
    $validation | ConvertTo-Json -Compress
} finally {
    if ((Test-Path -LiteralPath $stage) -and $stage.StartsWith($output + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $stage -Recurse -Force
    }
}
