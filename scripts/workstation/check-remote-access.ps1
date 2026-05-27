param(
  [string] $HostName = "noderasoftware.com",
  [int] $Port = 2222
)

$ErrorActionPreference = "Stop"

Write-Host "==> TCP port kontrolu: $HostName`:$Port" -ForegroundColor Cyan
$tcp = Test-NetConnection $HostName -Port $Port
$tcp | Select-Object ComputerName, RemoteAddress, RemotePort, TcpTestSucceeded | Format-List

Write-Host "==> SSH profil cozumu" -ForegroundColor Cyan
ssh -G noderapi | Select-String "^(hostname|user|port|identityfile) "

Write-Host ""
if ($tcp.TcpTestSucceeded) {
  Write-Host "Dis SSH/SFTP kapisi erisilebilir gorunuyor." -ForegroundColor Green
} else {
  Write-Host "Port erisimi basarisiz. Ev agindan public IP'ye donus desteklenmiyor olabilir ya da modem port forward aktif degildir." -ForegroundColor Yellow
}
