param(
  [ValidatePattern("^[A-Za-z0-9._@-]+$")]
  [string] $PiHost = "noderapi",

  [ValidatePattern("^[A-Za-z0-9._/-]+$")]
  [string] $Branch = "master",

  [ValidatePattern("^/[A-Za-z0-9._/-]+$")]
  [string] $AppDir = "/opt/noderasoftware"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($AppDir -in @("/", "/opt", "/home", "/usr", "/var", "/etc", "/tmp")) {
  throw "Guvenlik icin APP_DIR cok genis bir sistem dizini olamaz: $AppDir"
}

$ssh = Get-Command ssh -ErrorAction SilentlyContinue
if (-not $ssh) {
  throw "ssh bulunamadi. Windows OpenSSH Client kurulu ve PATH icinde olmali."
}

function Quote-BashValue {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Value
  )

  return "'" + ($Value -replace "'", "'\''") + "'"
}

function Invoke-CheckedSsh {
  param(
    [Parameter(Mandatory = $true)]
    [string] $HostName,

    [Parameter(Mandatory = $true)]
    [string] $Command
  )

  & $ssh.Source $HostName $Command
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "SSH deploy komutu basarisiz oldu ($exitCode): $HostName"
  }
}

$quotedAppDir = Quote-BashValue -Value $AppDir
$quotedBranch = Quote-BashValue -Value $Branch
$remoteCommand = "cd $quotedAppDir && sudo BRANCH=$quotedBranch bash scripts/pi/deploy-from-github.sh"

Invoke-CheckedSsh -HostName $PiHost -Command $remoteCommand
