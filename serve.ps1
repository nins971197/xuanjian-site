$py = "C:\Users\26409\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if (-not (Test-Path $py)) { $py = "python" }
Write-Host "玄鉴志 · http://127.0.0.1:8765/"
& $py -m http.server 8765 --directory $PSScriptRoot
