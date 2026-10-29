[CmdletBinding()]
param([string[]]$ExtensionIds = @('nichpjndbjbcfkcbanfcfogpkdhblghh', 'dfecnbleolbeddoflpfmailolehhnaih'))
$ErrorActionPreference = 'Stop'
foreach ($qfId in $ExtensionIds) { if ($qfId -notmatch '^[a-p]{32}$') { throw 'Invalid extension ID' } }
$qfRoot = [IO.Path]::GetFullPath((Join-Path $env:USERPROFILE '.qudadflow\Bridge'))
$qfLogicalRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'QudadFlow\Bridge'))
$qfExpected = [IO.Path]::GetFullPath((Join-Path $env:USERPROFILE '.qudadflow')) + '\'
if (-not $qfRoot.StartsWith($qfExpected,[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid install directory' }
$qfBundledNode = Join-Path $PSScriptRoot 'node.exe'
$qfNode = if (Test-Path -LiteralPath $qfBundledNode) { $qfBundledNode } else { (Get-Command node.exe -ErrorAction Stop).Source }
& $qfNode -e "const [major,minor]=process.versions.node.split('.').map(Number);if(major<22||(major===22&&minor<14))process.exit(1)"
if ($LASTEXITCODE -ne 0) { throw 'Node.js 22.14 or newer is required.' }
$qfBundledLauncher = Join-Path $PSScriptRoot 'QudadFlowBridge.exe'
if (-not (Test-Path -LiteralPath $qfBundledLauncher)) {
    $qfCompiler = Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
    if (-not (Test-Path -LiteralPath $qfCompiler)) { throw 'Windows .NET Framework compiler is required when the bridge launcher is not bundled.' }
}
New-Item -ItemType Directory -Path $qfRoot -Force | Out-Null
# Resolve Windows packaged-app path redirection before registering with browsers.
$qfRoot = (& $qfNode -e "process.stdout.write(require('fs').realpathSync(process.argv[1]))" $qfRoot).Trim()
if ($LASTEXITCODE -ne 0 -or -not [IO.Path]::IsPathRooted($qfRoot)) { throw 'Could not resolve the native installation directory.' }
if (-not @([IO.Path]::GetFullPath((Join-Path $env:USERPROFILE '.qudadflow\Bridge')), $qfLogicalRoot).Where({ $_.Equals($qfRoot,[StringComparison]::OrdinalIgnoreCase) }).Count) { throw 'Resolved installation directory is outside the expected user locations.' }
foreach ($qfFile in @('main.mjs','credentials.mjs','credential-crypto.ps1','openai.mjs','service.mjs')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $qfFile) -Destination (Join-Path $qfRoot $qfFile) -Force
}
if ([IO.Path]::GetFullPath($qfNode) -ne (Join-Path $qfRoot 'node.exe')) { Copy-Item -LiteralPath $qfNode -Destination (Join-Path $qfRoot 'node.exe') -Force }
$qfOrigins = @($ExtensionIds | Select-Object -Unique | ForEach-Object { 'chrome-extension://' + $_ + '/' })
$qfConfig = Join-Path $qfRoot 'host-config.json'
if (Test-Path -LiteralPath $qfConfig) {
    $qfPrevious = Get-Content -LiteralPath $qfConfig -Raw | ConvertFrom-Json
    $qfOrigins = @(@($qfPrevious.allowedOrigins) + $qfOrigins | Where-Object { $_ -match '^chrome-extension://[a-p]{32}/$' } | Select-Object -Unique)
}
[IO.File]::WriteAllText($qfConfig,(@{allowedOrigins=$qfOrigins;version=1}|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
$qfExe = Join-Path $qfRoot 'QudadFlowBridge.exe'
if (Test-Path -LiteralPath $qfBundledLauncher) {
    if ([IO.Path]::GetFullPath($qfBundledLauncher) -ne [IO.Path]::GetFullPath($qfExe)) { Copy-Item -LiteralPath $qfBundledLauncher -Destination $qfExe -Force }
} else {
    & $qfCompiler /nologo /target:exe /reference:System.Web.Extensions.dll /reference:System.Security.dll "/out:$qfExe" (Join-Path $PSScriptRoot 'Launcher.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Native launcher compilation failed' }
}
$qfManifest = Join-Path $qfRoot 'com.qudadflow.chatgpt.json'
[IO.File]::WriteAllText($qfManifest,(@{name='com.qudadflow.chatgpt';description='QudadFlow official ChatGPT login';path=$qfExe;type='stdio';allowed_origins=$qfOrigins}|ConvertTo-Json -Depth 4),[Text.UTF8Encoding]::new($false))
foreach ($qfBrowser in @('Google\Chrome','Microsoft\Edge')) {
    $qfRegistry = 'HKCU:\Software\' + $qfBrowser + '\NativeMessagingHosts\com.qudadflow.chatgpt'
    if (Test-Path -LiteralPath $qfRegistry) {
        $qfOldPath=(Get-Item -LiteralPath $qfRegistry).GetValue('')
        if ($qfOldPath -and $qfOldPath -ne $qfManifest -and $qfOldPath -ne (Join-Path $qfLogicalRoot 'com.qudadflow.chatgpt.json')) { throw 'A different QudadFlow bridge is already registered. Review it before replacing.' }
    }
    New-Item -Path $qfRegistry -Force | Out-Null
    Set-Item -LiteralPath $qfRegistry -Value $qfManifest
}
Write-Output "Installed local bridge: $qfRoot"
Write-Output 'OAuth credentials are protected separately with Windows DPAPI. Reload the extension, then choose Continue with ChatGPT.'
