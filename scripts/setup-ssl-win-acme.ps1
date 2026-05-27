param(
  [string]$Domain = "noderasoftware.com",
  [string[]]$AltNames = @("www.noderasoftware.com"),
  [string]$Email = "admin@noderasoftware.com",
  [int]$SiteId = 1,
  [string]$WebRoot = "C:\inetpub\wwwroot",
  [switch]$Staging
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "This script must be run as Administrator."
  }
}

Assert-Administrator

$projectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$wacs = Join-Path $projectRoot "tools\win-acme\wacs.exe"
$logFile = Join-Path $projectRoot "ssl-setup.log"
$hosts = @($Domain) + $AltNames | Select-Object -Unique

"SSL setup started at $(Get-Date -Format o)" | Set-Content -Path $logFile

if (-not (Test-Path -LiteralPath $wacs)) {
  throw "win-acme not found at $wacs"
}

if (-not (Test-Path -LiteralPath $WebRoot)) {
  throw "Web root not found: $WebRoot"
}

Write-Step "Loading IIS module"
Import-Module WebAdministration

$site = Get-Website | Where-Object { $_.Id -eq $SiteId } | Select-Object -First 1
if (-not $site) {
  $expectedRoot = [IO.Path]::GetFullPath($WebRoot).TrimEnd("\")
  $site = Get-Website | Where-Object {
    $_.PhysicalPath -and ([IO.Path]::GetFullPath($_.PhysicalPath).TrimEnd("\") -eq $expectedRoot)
  } | Select-Object -First 1
}
if (-not $site) {
  throw "Could not find an IIS site for SiteId=$SiteId or WebRoot=$WebRoot"
}

Write-Host "IIS site: $($site.Name) / id=$($site.Id) / path=$($site.PhysicalPath)"
"IIS site: $($site.Name) / id=$($site.Id) / path=$($site.PhysicalPath)" | Add-Content -Path $logFile

Write-Step "Opening Windows Firewall ports 80 and 443"
foreach ($rule in @(
  @{ Name = "HotelOps HTTP 80"; Port = 80 },
  @{ Name = "HotelOps HTTPS 443"; Port = 443 }
)) {
  if (-not (Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $rule.Port | Out-Null
  }
}

Write-Step "Ensuring HTTP host bindings"
foreach ($hostName in $hosts) {
  $httpBinding = Get-WebBinding -Name $site.Name -Protocol "http" -Port 80 -HostHeader $hostName -ErrorAction SilentlyContinue
  if (-not $httpBinding) {
    New-WebBinding -Name $site.Name -Protocol "http" -Port 80 -HostHeader $hostName | Out-Null
  }
}

Write-Step "Creating local ACME challenge test file"
$challengeDir = Join-Path $WebRoot ".well-known\acme-challenge"
New-Item -ItemType Directory -Force -Path $challengeDir | Out-Null
$challengeConfig = Join-Path $challengeDir "web.config"
$challengeConfigContent = @'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <staticContent>
      <remove fileExtension="." />
      <mimeMap fileExtension="." mimeType="text/plain" />
    </staticContent>
    <handlers>
      <clear />
      <add name="StaticFile" path="*" verb="GET,HEAD" modules="StaticFileModule" resourceType="Either" requireAccess="Read" />
    </handlers>
  </system.webServer>
</configuration>
'@
Set-Content -LiteralPath $challengeConfig -Value $challengeConfigContent -Encoding UTF8
$testName = "hotelops-ssl-test"
$testValue = "hotelops-ssl-ok-$(Get-Date -Format yyyyMMddHHmmss)"
$testPath = Join-Path $challengeDir $testName
Set-Content -LiteralPath $testPath -Value $testValue -Encoding ascii

foreach ($hostName in $hosts) {
  $response = Invoke-WebRequest `
    -UseBasicParsing `
    -Uri "http://127.0.0.1/.well-known/acme-challenge/$testName" `
    -Headers @{ Host = $hostName }
  if (($response.Content.Trim()) -ne $testValue) {
    throw "Local HTTP challenge test failed for $hostName"
  }
  Write-Host "Local challenge OK: http://$hostName/.well-known/acme-challenge/$testName"
}

Write-Host ""
Write-Host "IMPORTANT:" -ForegroundColor Yellow
Write-Host "For Let's Encrypt to succeed, your modem/router must forward public TCP 80 and 443 to this server."
Write-Host "This computer's local IP appears to be:"
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
  Select-Object IPAddress,InterfaceAlias |
  Format-Table -AutoSize

Write-Step "Requesting Let's Encrypt certificate with win-acme"
$wacsArgs = @(
  "--source", "manual",
  "--host", ($hosts -join ","),
  "--commonname", $Domain,
  "--validation", "filesystem",
  "--webroot", $WebRoot,
  "--manualtargetisiis",
  "--store", "certificatestore",
  "--certificatestore", "WebHosting",
  "--installation", "iis",
  "--installationsiteid", "$($site.Id)",
  "--sslport", "443",
  "--accepttos",
  "--emailaddress", $Email,
  "--setuptaskscheduler",
  "--verbose"
)

if ($Staging) {
  $wacsArgs += "--test"
  $wacsArgs += "--closeonfinish"
}

"& `"$wacs`" $($wacsArgs -join ' ')" | Add-Content -Path $logFile
& $wacs @wacsArgs 2>&1 | Tee-Object -FilePath $logFile -Append
if ($LASTEXITCODE -ne 0) {
  throw "win-acme failed. Check $logFile. Most common cause: public port 80 is not forwarded to this server."
}

Write-Step "Ensuring HTTPS bindings use the newest certificate"
$certs = @()
foreach ($storePath in @("Cert:\LocalMachine\WebHosting", "Cert:\LocalMachine\My")) {
  if (Test-Path $storePath) {
    $certs += Get-ChildItem $storePath | Where-Object {
      $_.Subject -like "*CN=$Domain*" -or ($_.DnsNameList | Where-Object { $_.Unicode -in $hosts })
    }
  }
}

$cert = $certs | Sort-Object NotAfter -Descending | Select-Object -First 1
if (-not $cert) {
  throw "Certificate was not found in LocalMachine WebHosting/My stores."
}

$storeName = if ($cert.PSParentPath -match "WebHosting") { "WebHosting" } else { "My" }
$thumbprint = $cert.GetCertHashString()
Write-Host "Certificate: $($cert.Subject)"
Write-Host "Thumbprint : $thumbprint"
Write-Host "Expires    : $($cert.NotAfter)"

foreach ($hostName in $hosts) {
  $httpsBinding = Get-WebBinding -Name $site.Name -Protocol "https" -Port 443 -HostHeader $hostName -ErrorAction SilentlyContinue
  if (-not $httpsBinding) {
    New-WebBinding -Name $site.Name -Protocol "https" -Port 443 -HostHeader $hostName -SslFlags 1 | Out-Null
  }
  $httpsBinding = Get-WebBinding -Name $site.Name -Protocol "https" -Port 443 -HostHeader $hostName
  $httpsBinding.AddSslCertificate($thumbprint, $storeName)
}

Write-Step "Restarting IIS"
iisreset

Write-Step "Local HTTPS verification"
foreach ($hostName in $hosts) {
  curl.exe -I -k --resolve "$hostName`:443:127.0.0.1" "https://$hostName/" | Tee-Object -FilePath $logFile -Append
}

Write-Step "Done"
Write-Host "SSL setup completed. Log: $logFile" -ForegroundColor Green
