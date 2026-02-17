$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Src = Join-Path $Root 'src'
$Dist = Join-Path $Root 'dist'
$Tmp = Join-Path $Root '.tmp-package'
$ManifestPath = Join-Path $Src 'manifest.json'

if (!(Test-Path $ManifestPath)) {
  throw "Manifest not found at $ManifestPath"
}

$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$version = $manifest.version
$geckoId = $manifest.browser_specific_settings.gecko.id
$extensionId = if ($geckoId) { ($geckoId -split '@')[0] } else { 'extension' }
$extensionId = ($extensionId.ToLower() -replace '[^a-z0-9._-]+', '-')
$zipName = "$extensionId-v$version.zip"
$zipPath = Join-Path $Dist $zipName

if (Test-Path $Dist) { Remove-Item $Dist -Recurse -Force }
if (Test-Path $Tmp) { Remove-Item $Tmp -Recurse -Force }
New-Item -ItemType Directory -Path $Dist | Out-Null
New-Item -ItemType Directory -Path $Tmp | Out-Null

$excludePatterns = @('.git','node_modules','dist','scripts','docs','*.psd','*.ai','*.sketch','*.xcf','*.log')
Get-ChildItem -Path $Src -Recurse -File | ForEach-Object {
  $relative = $_.FullName.Substring($Src.Length + 1)
  foreach ($pattern in $excludePatterns) {
    if ($relative -like $pattern -or $relative -like "*$pattern") { return }
  }
  $dest = Join-Path $Tmp $relative
  $destDir = Split-Path -Parent $dest
  if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  Copy-Item $_.FullName $dest -Force
}

Compress-Archive -Path (Join-Path $Tmp '*') -DestinationPath $zipPath -Force

$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entries = $zip.Entries | ForEach-Object { $_.FullName }
  if ($entries -notcontains 'manifest.json') {
    throw 'Verification failed: manifest.json is not at ZIP root'
  }

  $manifestEntry = $zip.GetEntry('manifest.json')
  $reader = New-Object System.IO.StreamReader($manifestEntry.Open())
  $zipManifestRaw = $reader.ReadToEnd()
  $reader.Dispose()
  $zipManifest = $zipManifestRaw | ConvertFrom-Json

  $required = @()
  if ($zipManifest.action.default_popup) { $required += $zipManifest.action.default_popup }
  if ($zipManifest.options_ui.page) { $required += $zipManifest.options_ui.page }
  if ($zipManifest.background.service_worker) { $required += $zipManifest.background.service_worker }
  $required += $zipManifest.icons.PSObject.Properties.Value

  $missing = @()
  foreach ($path in $required) {
    if ($entries -notcontains $path) { $missing += $path }
  }

  if ($missing.Count -gt 0) {
    throw ('Verification failed: missing manifest-referenced files in ZIP: ' + ($missing -join ', '))
  }
}
finally {
  $zip.Dispose()
}

if (Test-Path $Tmp) { Remove-Item $Tmp -Recurse -Force }
Write-Host "Created $zipPath"
Write-Host 'Verification passed'
