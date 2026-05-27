$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$node = "C:\Program Files\nodejs\node.exe"
$server = Join-Path $projectRoot "apps\api\dist\server.js"
$stdout = Join-Path $projectRoot "api-server.log"
$stderr = Join-Path $projectRoot "api-server.err"

[Environment]::SetEnvironmentVariable("PATH", $null, "Process")
[Environment]::SetEnvironmentVariable("Path", "C:\Windows\System32;C:\Program Files\nodejs", "Process")
$env:NODE_ENV = "production"

Set-Location -LiteralPath $projectRoot
Add-Content -Path $stdout -Value "Starting HotelOps API at $(Get-Date -Format o)"
& $node $server 1>> $stdout 2>> $stderr
Add-Content -Path $stderr -Value "HotelOps API exited at $(Get-Date -Format o) with code $LASTEXITCODE"
