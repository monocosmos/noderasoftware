param(
  [string] $ApiBase = "https://noderasoftware.com/api",
  [string] $PiHost = "noderapi",
  [string] $PiUser = "",
  [string] $Username = "admin",
  [string] $Password = $env:HOTELOPS_PUSH_TEST_PASSWORD
)

$ErrorActionPreference = "Stop"
$failures = New-Object System.Collections.Generic.List[string]
$target = if ($PiUser.Trim()) { "${PiUser}@${PiHost}" } else { $PiHost }

function Add-Failure {
  param([string] $Message)
  $script:failures.Add($Message) | Out-Null
  Write-Host "FAIL $Message" -ForegroundColor Red
}

function Add-Pass {
  param([string] $Message)
  Write-Host "OK   $Message" -ForegroundColor Green
}

function Invoke-Remote {
  param([string] $Command)
  ssh $target $Command
}

function Invoke-RemoteBash {
  param([string] $Script)
  $Script.Replace("`r`n", "`n").Replace("`r", "`n") | ssh $target "tr -d '\015' | bash -s"
}

Write-Host "==> Android push pipeline kontrolu" -ForegroundColor Cyan

try {
  $health = Invoke-Remote "curl -fsS http://127.0.0.1:4000/health"
  if ($health -match '"ok":true' -and $health -match '"db":"up"') {
    Add-Pass "Pi API health ve database ayakta"
  } else {
    Add-Failure "Pi API health beklenen sonucu vermedi: $health"
  }
} catch {
  Add-Failure "Pi API health okunamadi: $($_.Exception.Message)"
}

try {
  $services = Invoke-Remote "systemctl is-active hotelops-api nginx postgresql"
  $inactive = @($services | Where-Object { $_ -ne "active" })
  if ($inactive.Count -eq 0) {
    Add-Pass "hotelops-api, nginx ve postgresql aktif"
  } else {
    Add-Failure "Servislerden en az biri aktif degil: $($services -join ', ')"
  }
} catch {
  Add-Failure "Servis durumlari okunamadi: $($_.Exception.Message)"
}

try {
  $remoteMarkers = Invoke-RemoteBash @'
set -Eeuo pipefail
cd /opt/noderasoftware
grep -q 'app.post("/push-devices"' apps/api/src/server.ts
grep -q 'firebase-admin' apps/api/package.json
grep -q 'sendPushNotifications' apps/api/src/server.ts
echo ok
'@
  if ($remoteMarkers -contains "ok") {
    Add-Pass "Canli API kaynak kodunda push endpoint ve Firebase Admin hatti var"
  } else {
    Add-Failure "Canli API kaynak kodu push endpoint/Firebase marker kontrolunden gecmedi"
  }
} catch {
  Add-Failure "Canli API push marker kontrolu calismadi: $($_.Exception.Message)"
}

try {
  $firebaseCheck = Invoke-RemoteBash @'
set -Eeuo pipefail
cd /opt/noderasoftware
sudo -u hotelops node --input-type=module <<'NODE'
import { existsSync, readFileSync } from "node:fs";
import admin from "firebase-admin";
const candidates = [
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  "/opt/noderasoftware/secrets/firebase-service-account.json",
  "/opt/noderasoftware-private/firebase/noderafirebase-firebase-adminsdk-fbsvc-d7fd3b1a37.json"
].filter(Boolean);
const servicePath = candidates.find((candidate) => existsSync(candidate));
if (!servicePath) {
  console.log("missing-service-account");
  process.exit(2);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(servicePath, "utf8"))) });
try {
  await admin.messaging().send({
    token: "codex_fake_token_for_admin_connectivity_test",
    notification: { title: "HotelOps", body: "Connectivity test" }
  }, true);
  console.log("firebase-admin-ready");
} catch (error) {
  const code = String(error?.code || error?.message || error);
  if (code === "messaging/invalid-argument") {
    console.log("firebase-admin-ready");
  } else {
    console.log("firebase-admin-error=" + code);
    process.exit(3);
  }
}
NODE
'@
  if ($firebaseCheck -contains "firebase-admin-ready") {
    Add-Pass "Firebase Admin servis hesabi okunuyor ve messaging hatti yukleniyor"
  } else {
    Add-Failure "Firebase Admin kontrolu beklenen sonucu vermedi: $($firebaseCheck -join ' ')"
  }
} catch {
  Add-Failure "Firebase Admin kontrolu calismadi: $($_.Exception.Message)"
}

if ($Password.Trim()) {
  $fakeToken = "codex-fcm-test-" + [guid]::NewGuid().ToString("N") + "012345678901234567890123456789"
  try {
    $loginBody = @{ username = $Username; password = $Password } | ConvertTo-Json -Compress
    $login = Invoke-RestMethod -Method Post -Uri "$ApiBase/auth/login" -ContentType "application/json" -Body $loginBody
    $token = [string] $login.token
    if (-not $token) {
      Add-Failure "Canli API login token dondurmedi"
    } else {
      $registerBody = @{
        platform = "ANDROID"
        fcmToken = $fakeToken
        deviceId = "codex-live-endpoint-test"
        appVersion = "1.0.0"
        appBuild = 0
      } | ConvertTo-Json -Compress
      $register = Invoke-RestMethod -Method Post -Uri "$ApiBase/push-devices" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $registerBody
      if ($register.ok) {
        Add-Pass "Canli /api/push-devices endpoint token kaydi kabul ediyor"
      } else {
        Add-Failure "Canli /api/push-devices ok=false dondurdu"
      }
    }
  } catch {
    Add-Failure "Canli push token kayit testi basarisiz: $($_.Exception.Message)"
  } finally {
    $cleanupScript = @"
set -Eeuo pipefail
cd /opt/noderasoftware
export HOTELOPS_TEST_FCM_TOKEN='$fakeToken'
sudo -u hotelops -E node --input-type=module <<'NODE'
import { prisma } from "./apps/api/dist/prisma.js";
const token = process.env.HOTELOPS_TEST_FCM_TOKEN || "";
const deleted = await prisma.pushDevice.deleteMany({ where: { fcmToken: token } });
console.log("deleted-test-devices=" + deleted.count);
await prisma.`$disconnect();
NODE
"@
    try {
      Invoke-RemoteBash $cleanupScript | Out-Host
    } catch {
      Add-Failure "Test push token temizligi basarisiz: $($_.Exception.Message)"
    }
  }
} else {
  Write-Host "SKIP Canli token kayit testi icin -Password veya HOTELOPS_PUSH_TEST_PASSWORD gerekli" -ForegroundColor Yellow
}

try {
  $activeDevices = Invoke-RemoteBash @'
set -Eeuo pipefail
cd /opt/noderasoftware
sudo -u hotelops node --input-type=module <<'NODE'
import { prisma } from "./apps/api/dist/prisma.js";
const devices = await prisma.pushDevice.findMany({
  where: { disabledAt: null, platform: "ANDROID" },
  select: {
    user: { select: { username: true, department: { select: { name: true } } } },
    appVersion: true,
    lastSeenAt: true
  },
  orderBy: { lastSeenAt: "desc" }
});
console.log(JSON.stringify(devices));
await prisma.$disconnect();
NODE
'@
  $jsonLine = ($activeDevices | Where-Object { $_ -match '^\[' } | Select-Object -First 1)
  $devices = if ($jsonLine) { $jsonLine | ConvertFrom-Json } else { @() }
  if (@($devices).Count -gt 0) {
    Add-Pass "Aktif Android push cihazi var: $(@($devices).Count)"
    $devices | ForEach-Object {
      Write-Host "     $($_.user.username) / $($_.user.department.name) / $($_.appVersion) / $($_.lastSeenAt)"
    }
  } else {
    Add-Failure "Aktif Android push cihazi yok. Kapali uygulama bildirimi hicbir hesaba dusmez."
  }
} catch {
  Add-Failure "Aktif Android push cihazlari okunamadi: $($_.Exception.Message)"
}

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Host "Android push pipeline testi BASARISIZ: $($failures.Count) hata" -ForegroundColor Red
  $failures | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
  exit 1
}

Write-Host ""
Write-Host "Android push pipeline testi basarili." -ForegroundColor Green
