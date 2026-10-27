param(
  [Parameter(Mandatory=$true)][string]$ArtifactDirectory,
  [Parameter(Mandatory=$true)][string]$JavaHome,
  [string]$SigningDirectory = (Join-Path $PSScriptRoot '../.tools/android-signing'),
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '../.tools/android-dist')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$java = Join-Path $JavaHome 'bin/java.exe'
$keytool = Join-Path $JavaHome 'bin/keytool.exe'
$apkSigner = Join-Path $ArtifactDirectory 'tooling/apksigner.jar'
$keystore = Join-Path $SigningDirectory 'story-circle.p12'
$passwordFile = Join-Path $SigningDirectory 'password.dpapi'
foreach ($file in @($java, $keytool, $apkSigner, $keystore, $passwordFile)) {
  if (!(Test-Path -LiteralPath $file)) { throw "Required file is missing: $file" }
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$env:STORY_CIRCLE_SIGNING_PASSWORD = [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($passwordFile), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser))
try {
  $apk = Join-Path $OutputDirectory 'story-circle-1.0.0.apk'
  & $java -jar $apkSigner sign --ks $keystore --ks-type PKCS12 --ks-pass env:STORY_CIRCLE_SIGNING_PASSWORD --key-pass env:STORY_CIRCLE_SIGNING_PASSWORD --out $apk (Join-Path $ArtifactDirectory 'story-circle-unsigned.apk')
  if ($LASTEXITCODE -ne 0) { throw 'APK signing failed' }
  & $java -jar $apkSigner verify --verbose --print-certs $apk
  if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
  $hash = Get-FileHash -LiteralPath $apk -Algorithm SHA256
  [IO.File]::WriteAllText((Join-Path $OutputDirectory 'SHA256SUMS.txt'), "$($hash.Hash.ToLower())  story-circle-1.0.0.apk`n")
  Copy-Item -LiteralPath (Join-Path $ArtifactDirectory 'commit.txt') -Destination $OutputDirectory
  Write-Output "Signed and verified: $apk"
} finally {
  Remove-Item Env:STORY_CIRCLE_SIGNING_PASSWORD
}
