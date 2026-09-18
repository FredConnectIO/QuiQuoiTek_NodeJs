@echo off
setlocal

set "PLAYLIST=C:\PARTAGE\Music\Playlists\santana.m3u"
set "DEST=C:\PARTAGE\Music\Playlists\mp3"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$playlist = $env:PLAYLIST; $dest = $env:DEST; if (-not (Test-Path -LiteralPath $playlist)) { Write-Error 'Playlist introuvable: ' + $playlist; exit 1 }; New-Item -ItemType Directory -Path $dest -Force | Out-Null; $i = 1; $lines = Get-Content -LiteralPath $playlist; foreach ($raw in $lines) { $line = $raw.Trim(); if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) { continue }; if (-not $line.StartsWith('file:///')) { continue }; try { $src = ([Uri]$line).LocalPath } catch { Write-Warning ('Ligne ignoree (URI invalide): ' + $line); continue }; if (-not (Test-Path -LiteralPath $src)) { Write-Warning ('Fichier introuvable: ' + $src); continue }; $name = [System.IO.Path]::GetFileName($src); $newPrefix = ('{0:D3}' -f $i); $newName = [System.Text.RegularExpressions.Regex]::Replace($name, '^[0-9]{2,3}', $newPrefix); if ($newName -eq $name) { $newName = $newPrefix + ' ' + $name }; $dstFile = Join-Path $dest $newName; Copy-Item -LiteralPath $src -Destination $dstFile -Force; Write-Host ('Copie: ' + $src + ' -> ' + $newName); $i++ }"

endlocal
