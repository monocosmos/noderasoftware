param(
  [Parameter(Mandatory = $true)]
  [string] $PiHost,

  [string] $PiUser = "raspberrypiserveradmin",

  [int] $SshPort = 0
)

$ErrorActionPreference = "Stop"
$sshPortArgs = @()
if ($SshPort -gt 0) {
  $sshPortArgs = @("-p", "$SshPort")
}

$command = @"
echo '== hotelops-api =='
systemctl --no-pager --full status hotelops-api | sed -n '1,14p'
echo
echo '== nginx =='
systemctl --no-pager --full status nginx | sed -n '1,10p'
echo
echo '== postgresql =='
systemctl --no-pager --full status postgresql | sed -n '1,10p'
echo
echo '== health =='
curl -fsS http://127.0.0.1:4000/health || true
echo
"@

ssh @sshPortArgs "${PiUser}@${PiHost}" $command
