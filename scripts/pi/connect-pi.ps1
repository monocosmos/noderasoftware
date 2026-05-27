param(
  [Parameter(Mandatory = $true)]
  [string] $PiHost,

  [string] $PiUser = "raspberrypiserveradmin",

  [int] $SshPort = 0,

  [string] $Command = ""
)

$ErrorActionPreference = "Stop"
$sshPortArgs = @()
if ($SshPort -gt 0) {
  $sshPortArgs = @("-p", "$SshPort")
}

if ($Command.Trim()) {
  ssh @sshPortArgs "${PiUser}@${PiHost}" $Command
} else {
  ssh @sshPortArgs "${PiUser}@${PiHost}"
}
