[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$BundleZip,
    [Parameter(Mandatory=$true)][string]$InstallerExe,
    [Parameter(Mandatory=$true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$bundle = [IO.Path]::GetFullPath($BundleZip)
$installer = [IO.Path]::GetFullPath($InstallerExe)
$output = [IO.Path]::GetFullPath($OutputDirectory)
if (-not (Test-Path -LiteralPath $bundle -PathType Leaf) -or -not (Test-Path -LiteralPath $installer -PathType Leaf)) { throw 'Installer test assets are missing.' }
if ((Test-Path -LiteralPath $output) -and @(Get-ChildItem -LiteralPath $output -Force).Count -gt 0) { throw 'Choose a new empty installer test directory.' }
New-Item -ItemType Directory -Path $output -Force | Out-Null
$compiler = Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework compiler is unavailable.' }

function Get-HostRegistration {
    @('Google\Chrome','Microsoft\Edge') | ForEach-Object {
        $key = 'HKCU:\Software\' + $_ + '\NativeMessagingHosts\com.qudadflow.chatgpt'
        if (Test-Path -LiteralPath $key) { [string](Get-Item -LiteralPath $key).GetValue('') } else { '' }
    }
}
function Invoke-SelfTest([string]$program, [int]$expectedExit) {
    $process = Start-Process -FilePath $program -ArgumentList '--self-test' -WindowStyle Hidden -Wait -PassThru
    if ($process.ExitCode -ne $expectedExit) { throw "Unexpected installer self-test exit code: $($process.ExitCode) (expected $expectedExit)" }
}
function New-InstallerFromBundle([string]$zipFile, [string]$program) {
    & $compiler /nologo /target:winexe /codepage:65001 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /reference:System.Web.Extensions.dll "/resource:$zipFile,QudadFlowBridgeBundle" "/out:$program" (Join-Path $repo 'native-host\Installer.cs')
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $program)) { throw 'Could not compile the installer test case.' }
}

Add-Type -AssemblyName System.IO.Compression
$before = @(Get-HostRegistration)
Invoke-SelfTest $installer 0
$results = @([ordered]@{ name='Valid bundle extracts and verifies without installing'; passed=$true })

$tamperedZip = Join-Path $output 'tampered-bundle.zip'
Copy-Item -LiteralPath $bundle -Destination $tamperedZip
$archive = [IO.Compression.ZipFile]::Open($tamperedZip,[IO.Compression.ZipArchiveMode]::Update)
try {
    $entry = $archive.GetEntry('Install-Bridge.ps1')
    if (-not $entry) { throw 'Missing installer script in test bundle.' }
    $entry.Delete()
    $replacement = $archive.CreateEntry('Install-Bridge.ps1')
    $writer = [IO.StreamWriter]::new($replacement.Open(),[Text.UTF8Encoding]::new($false))
    try { $writer.Write('tampered') } finally { $writer.Dispose() }
} finally { $archive.Dispose() }
$tamperedExe = Join-Path $output 'tampered-installer.exe'
New-InstallerFromBundle $tamperedZip $tamperedExe
Invoke-SelfTest $tamperedExe 1
$results += [ordered]@{ name='Modified installer script is rejected by SHA256'; passed=$true }

$traversalZip = Join-Path $output 'traversal-bundle.zip'
Copy-Item -LiteralPath $bundle -Destination $traversalZip
$escapeName = 'QudadFlowTraversal-' + [Guid]::NewGuid().ToString('N') + '.txt'
$outsidePath = Join-Path ([IO.Path]::GetFullPath($env:TEMP)) $escapeName
if (Test-Path -LiteralPath $outsidePath) { throw 'Unexpected traversal test path collision.' }
$archive = [IO.Compression.ZipFile]::Open($traversalZip,[IO.Compression.ZipArchiveMode]::Update)
try {
    $entry = $archive.CreateEntry('../' + $escapeName)
    $writer = [IO.StreamWriter]::new($entry.Open(),[Text.UTF8Encoding]::new($false))
    try { $writer.Write('blocked') } finally { $writer.Dispose() }
} finally { $archive.Dispose() }
$traversalExe = Join-Path $output 'traversal-installer.exe'
New-InstallerFromBundle $traversalZip $traversalExe
Invoke-SelfTest $traversalExe 1
if (Test-Path -LiteralPath $outsidePath) { throw 'Path traversal wrote outside the extraction directory.' }
$results += [ordered]@{ name='Traversal entry is rejected without writing outside extraction'; passed=$true }

$after = @(Get-HostRegistration)
if (@(Compare-Object $before $after).Count -gt 0) { throw 'Self-tests changed a browser native-host registration.' }
$results += [ordered]@{ name='Self-tests leave browser host registrations untouched'; passed=$true }
$report = [ordered]@{ version=(Get-Content -LiteralPath (Join-Path $repo 'manifest.json') -Raw | ConvertFrom-Json).version; scope='Isolated self-tests; does not run the real Windows install UI'; passed=$results.Count; failed=0; results=$results }
[IO.File]::WriteAllText((Join-Path $output 'bridge-installer-check.json'),($report | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
$report | ConvertTo-Json -Compress -Depth 5
