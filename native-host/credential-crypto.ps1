param([ValidateSet('protect','unprotect')][string]$Mode)
$ErrorActionPreference = 'Stop'
try {
    Add-Type -AssemblyName System.Security
    $qfInput = [Console]::In.ReadToEnd().Trim()
    if ($qfInput.Length -gt 2097152) { throw 'Input too large' }
    $qfBytes = [Convert]::FromBase64String($qfInput)
    $qfEntropy = [Text.Encoding]::UTF8.GetBytes('QudadFlow.ChatGPT.Credentials.v1')
    if ($Mode -eq 'protect') {
        $qfResult = [Security.Cryptography.ProtectedData]::Protect($qfBytes,$qfEntropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    } else {
        $qfResult = [Security.Cryptography.ProtectedData]::Unprotect($qfBytes,$qfEntropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    }
    [Console]::Out.Write([Convert]::ToBase64String($qfResult))
} catch { [Console]::Error.Write('Credential protection failed'); exit 1 }
