$ErrorActionPreference = "Stop"

$webRoot = "C:\inetpub\wwwroot"
$challengeDir = Join-Path $webRoot ".well-known\acme-challenge"
New-Item -ItemType Directory -Force -Path $challengeDir | Out-Null

$configPath = Join-Path $challengeDir "web.config"
$config = @'
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
Set-Content -LiteralPath $configPath -Value $config -Encoding UTF8

$testName = "hotelops-acme-test"
$testValue = "hotelops-acme-ok-$(Get-Date -Format yyyyMMddHHmmss)"
Set-Content -LiteralPath (Join-Path $challengeDir $testName) -Value $testValue -Encoding ascii

Write-Host "Created ACME challenge config and test file."
Write-Host "Local test URL: http://127.0.0.1/.well-known/acme-challenge/$testName"
Write-Host "Expected content: $testValue"
