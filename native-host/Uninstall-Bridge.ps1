[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$qfRoot=[IO.Path]::GetFullPath((Join-Path $env:USERPROFILE '.qudadflow\Bridge'))
$qfParent=[IO.Path]::GetFullPath((Join-Path $env:USERPROFILE '.qudadflow'))+'\'
$qfLogicalRoot=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'QudadFlow\Bridge'))
if (-not $qfRoot.StartsWith($qfParent,[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid uninstall directory' }
if(Test-Path -LiteralPath (Join-Path $qfRoot 'node.exe')) {
    $qfRoot=(& (Join-Path $qfRoot 'node.exe') -e "process.stdout.write(require('fs').realpathSync(process.argv[1]))" $qfRoot).Trim()
    if($LASTEXITCODE -ne 0 -or -not [IO.Path]::IsPathRooted($qfRoot)) { throw 'Invalid resolved uninstall directory' }
} elseif(Test-Path -LiteralPath $qfRoot) {
    foreach($qfPart in @($qfParent.TrimEnd('\'),$qfRoot)) {
        if((Get-Item -LiteralPath $qfPart -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Cannot safely uninstall through a redirected directory without the bundled Node runtime.' }
    }
}
if (-not @([IO.Path]::GetFullPath((Join-Path $env:USERPROFILE '.qudadflow\Bridge')), $qfLogicalRoot).Where({ $_.Equals($qfRoot,[StringComparison]::OrdinalIgnoreCase) }).Count) { throw 'Resolved uninstall path is outside the expected user locations.' }
foreach($qfBrowser in @('Google\Chrome','Microsoft\Edge')) {
    $qfKey='HKCU:\Software\'+$qfBrowser+'\NativeMessagingHosts\com.qudadflow.chatgpt'
    if((Test-Path -LiteralPath $qfKey) -and (Get-Item -LiteralPath $qfKey).GetValue('') -eq (Join-Path $qfRoot 'com.qudadflow.chatgpt.json')) { Remove-Item -LiteralPath $qfKey }
}
if(Test-Path -LiteralPath $qfRoot) { Remove-Item -LiteralPath $qfRoot -Recurse -Force }
Write-Output 'Bridge removed. Account records were retained. Sign out before uninstalling or revoke access in ChatGPT settings.'
