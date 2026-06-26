param(
  [string] $CertificatePath = $env:HOTELOPS_WINDOWS_CERT_PATH,
  [string] $CertificatePassword = $env:HOTELOPS_WINDOWS_CERT_PASSWORD,
  [string] $TimestampServer = "http://timestamp.digicert.com",
  [string[]] $Files = @(
    "apps\desktop\release\HotelOps-Setup-V1-x64.exe",
    "apps\desktop\release\HotelOps-Portable-V1-x64.exe",
    "apps\web\public\downloads\HotelOps-Setup-V1-x64.exe",
    "apps\web\public\downloads\HotelOps-Portable-V1-x64.exe",
    "apps\web\out\downloads\HotelOps-Setup-V1-x64.exe",
    "apps\web\out\downloads\HotelOps-Portable-V1-x64.exe"
  )
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Resolve-SignTool {
  $fromPath = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($fromPath) { return $fromPath.Source }

  $kitRoots = @(
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin",
    "${env:ProgramFiles}\Windows Kits\10\bin"
  )

  foreach ($kitRoot in $kitRoots) {
    if (-not (Test-Path -LiteralPath $kitRoot)) { continue }
    $candidate = Get-ChildItem -LiteralPath $kitRoot -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match "\\x64\\signtool\.exe$" } |
      Sort-Object FullName -Descending |
      Select-Object -First 1
    if ($candidate) { return $candidate.FullName }
  }

  throw "signtool.exe bulunamadi. Windows SDK yuklenmeli veya signtool PATH'e eklenmeli."
}

if (-not $CertificatePath) {
  throw "Code signing sertifikasi yok. HOTELOPS_WINDOWS_CERT_PATH veya -CertificatePath ile PFX dosyasini belirtin."
}

if (-not (Test-Path -LiteralPath $CertificatePath)) {
  throw "Code signing sertifikasi bulunamadi: $CertificatePath"
}

if (-not $CertificatePassword) {
  throw "Code signing sertifika parolasi yok. HOTELOPS_WINDOWS_CERT_PASSWORD veya -CertificatePassword belirtin."
}

$signtool = Resolve-SignTool

foreach ($file in $Files) {
  $path = if ([System.IO.Path]::IsPathRooted($file)) { $file } else { Join-Path $root $file }
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Imzalanacak dosya bulunamadi: $path"
  }

  & $signtool sign /f $CertificatePath /p $CertificatePassword /fd SHA256 /td SHA256 /tr $TimestampServer /v $path
  if ($LASTEXITCODE -ne 0) {
    throw "Imzalama basarisiz oldu: $path"
  }

  $signature = Get-AuthenticodeSignature -LiteralPath $path
  if ($signature.Status -ne "Valid") {
    throw "Imza dogrulamasi basarisiz: $path ($($signature.Status): $($signature.StatusMessage))"
  }
}

Write-Host "Windows desktop release dosyalari imzalandi ve dogrulandi."
