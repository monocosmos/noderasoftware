$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Push-Location $projectRoot
try {
  npm.cmd run desktop:start
}
finally {
  Pop-Location
}
