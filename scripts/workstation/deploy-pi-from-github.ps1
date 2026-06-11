param(
  [string] $PiHost = "noderapi",
  [string] $Branch = "master",
  [string] $AppDir = "/opt/noderasoftware"
)

$ErrorActionPreference = "Stop"

$remoteCommand = @"
cd '$AppDir' && sudo BRANCH='$Branch' bash scripts/pi/deploy-from-github.sh
"@

ssh $PiHost $remoteCommand
