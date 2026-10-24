$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
node scripts/check.mjs
if ($LASTEXITCODE -ne 0) { throw 'Checks failed' }
node --test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
New-Item -ItemType Directory -Force -Path dist | Out-Null
$version = (Get-Content manifest.json -Raw | ConvertFrom-Json).version
Compress-Archive -Path manifest.json,core.js,content.js,popup.js,popup.html,popup.css,icons,docs,README.md,PRIVACY.md,LICENSE -DestinationPath "dist/discord-clean-csv-exporter-$version.zip" -Force
Write-Output "Created dist/discord-clean-csv-exporter-$version.zip"
