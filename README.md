# Nodera Software - HotelOps Enterprise Platform

Nodera Software HotelOps, otel operasyonlarını tek merkezden yönetmek için geliştirilen web, API, masaüstü ve mobil istemci bileşenlerinden oluşan bir monorepo projesidir. Sistem; departman bazlı iş emirleri, iş yönetimi, takvim planlama, personel ve yetki yönetimi, yönetici talepleri, hatırlatmalar, raporlar, audit kayıtları ve canlı bildirim akışlarını tek bir operasyon panelinde toplar.

Bu depo artık projenin ana kaynak noktasıdır. Raspberry Pi canlı sunucudur; fakat canlıya gönderilen her kalıcı düzenleme önce GitHub üzerinde kayıt altına alınmalıdır.

## İçindekiler

- [Projenin Amacı](#projenin-amacı)
- [Güncel Çalışma Kuralı](#güncel-çalışma-kuralı)
- [Canlı Ortam](#canlı-ortam)
- [Ana Özellikler](#ana-özellikler)
- [Monorepo Yapısı](#monorepo-yapısı)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Uygulama Bileşenleri](#uygulama-bileşenleri)
- [Rol ve Yetki Modeli](#rol-ve-yetki-modeli)
- [Veri Modeli](#veri-modeli)
- [API Özeti](#api-özeti)
- [Yerel Geliştirme](#yerel-geliştirme)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Komutlar](#komutlar)
- [Test ve Doğrulama](#test-ve-doğrulama)
- [Raspberry Pi Canlı Yayın Akışı](#raspberry-pi-canlı-yayın-akışı)
- [GitHub İş Akışı](#github-iş-akışı)
- [Masaüstü ve Mobil Uygulamalar](#masaüstü-ve-mobil-uygulamalar)
- [Güvenlik İlkeleri](#güvenlik-ilkeleri)
- [Operasyonel Kontrol Listeleri](#operasyonel-kontrol-listeleri)
- [Dokümantasyon Haritası](#dokümantasyon-haritası)
- [Sorun Giderme](#sorun-giderme)
- [Katkı Kuralları](#katkı-kuralları)

## Projenin Amacı

HotelOps, otel içindeki departmanların günlük operasyonlarını izlenebilir, rol bazlı, denetlenebilir ve hızlı aksiyon alınabilir hale getirmek için tasarlanmıştır. Hedef, tek bir panel üzerinden hem yönetim seviyesinde genel görünürlük sağlamak hem de departman kullanıcılarının yalnızca kendi görev alanlarına odaklanmasını sağlamaktır.

Sistem aşağıdaki operasyon ihtiyaçlarını karşılar:

- Teknik servis iş ve bakım kayıtlarının takibi.
- Housekeeping oda, kat ve VIP kontrol planlarının yönetimi.
- Ön bürodan diğer departmanlara iş veya talep açılması.
- Güvenlik, SPA ve F&B departmanlarının kendi iş listelerini takip etmesi.
- İnsan kaynakları tarafında kullanıcı, rol, departman ve personel yönetimi.
- Yönetici talepleri, hatırlatmalar ve günlük raporların merkezi akışı.
- Kritik işlemlerde audit log, timeline ve soft delete yaklaşımı.
- Canlı sunucu üzerinde Raspberry Pi, Nginx, Node.js API ve PostgreSQL ile gerçek yayın.

## Güncel Çalışma Kuralı

Bu proje için güncel karar:

```text
GitHub = kaynak kod ve değişiklik geçmişi
Yerel bilgisayar = geliştirme ve test ortamı
Raspberry Pi = gerçek canlı sunucu
```

Bu nedenle canlıya giden her kalıcı düzenleme aşağıdaki sırayla ilerlemelidir:

```text
1. GitHub'daki güncel master alınır.
2. Yerelde ayrı bir branch açılır.
3. Değişiklik yerelde yapılır.
4. Yerel test ve build çalıştırılır.
5. Değişiklik commit edilir.
6. GitHub'a push edilir.
7. Gerekirse pull request ile izlenir.
8. Son onaydan sonra Raspberry Pi'ye deploy edilir.
9. Canlı sağlık kontrolü yapılır.
```

Raspberry Pi üzerinde elle yapılan hızlı dosya değişiklikleri kalıcı kaynak kabul edilmez. Kalıcı olması gereken her iş GitHub deposuna işlenmelidir.

> Not: Bu depoda GitHub kullanılmadan Pi'yi kaynak kabul eden eski operasyon dokümanları da bulunabilir. Güncel çalışma kararı README'deki bu akıştır: kaynak GitHub, canlı hedef Raspberry Pi.

## Canlı Ortam

Canlı sistem Raspberry Pi üzerinde çalışır.

| Bileşen | Değer |
| --- | --- |
| Canlı web adresi | `https://noderasoftware.com/hotel/` |
| API health kontrolü | `https://noderasoftware.com/api/health` |
| Sunucu | Raspberry Pi |
| Web sunucusu | Nginx |
| API servisi | `hotelops-api` systemd servisi |
| API iç portu | `127.0.0.1:4000` |
| Veritabanı | PostgreSQL |
| Sunucu proje dizini | `/opt/noderasoftware` |
| Statik web çıktısı | `/opt/noderasoftware/apps/web/out` |

Canlı ortamın hedef mimarisi:

```text
Kullanıcı
  -> https://noderasoftware.com/hotel/
  -> Nginx
  -> Next.js static export dosyaları

Kullanıcı / Web / Mobil / Desktop
  -> https://noderasoftware.com/api/*
  -> Nginx reverse proxy
  -> Node.js Express API
  -> PostgreSQL

Realtime olaylar
  -> Socket.io
  -> Departman room yapısı
```

## Ana Özellikler

HotelOps aşağıdaki ürün yüzeylerini içerir:

- Rol bazlı giriş ve oturum yönetimi.
- Departman kapsamlı dashboard.
- İş emri, planlı görev ve takvim işi oluşturma.
- İş emri detay sayfası, timeline, yorum, dosya/fotoğraf akışı.
- Öncelik, durum, atama, oda, konum ve son tarih takibi.
- Departman takvimi ve operasyon yoğunluğu görünümü.
- Yönetici talepleri.
- Hatırlatmalar.
- Bildirim merkezi.
- Günlük ve genel rapor ekranları.
- Personel, kullanıcı ve departman yönetimi.
- Rol bazlı modül ve özellik erişimi.
- API tarafında JWT, session, rate limit, secure headers ve RBAC guardları.
- PostgreSQL + Prisma veri modeli.
- Socket.io ile departman bazlı realtime event altyapısı.
- WebView tabanlı Windows desktop kabuğu.
- Android WebView istemcisi, kamera/fotoğraf seçici ve bildirim köprüsü.
- Raspberry Pi için hızlı deploy, servis kurulumu ve doğrulama scriptleri.

## Monorepo Yapısı

```text
.
├─ apps/
│  ├─ web/                  Next.js web arayüzü
│  ├─ api/                  Express + Socket.io API servisi
│  ├─ desktop/              Electron desktop kabuğu
│  └─ android/              Android WebView istemcisi
├─ packages/
│  ├─ domain/               Ortak domain tipleri ve sabitleri
│  └─ ui/                   Ortak UI paket alanı
├─ prisma/
│  └─ schema.prisma         PostgreSQL veri modeli
├─ scripts/
│  ├─ workstation/          Windows geliştirme ve Pi yayın komutları
│  ├─ pi/                   Raspberry Pi kurulum ve deploy komutları
│  └─ *.ps1                 Windows servis, IIS, SSL ve yardımcı scriptler
├─ docs/                    Mimari, API, workflow ve deploy dokümanları
├─ .github/workflows/       GitHub Actions iş akışları
├─ package.json             Monorepo workspace tanımı
├─ package-lock.json        Kilitli npm bağımlılıkları
└─ README.md                Ana proje dokümanı
```

## Teknoloji Yığını

| Katman | Teknoloji |
| --- | --- |
| Web | Next.js 15, React 18, TypeScript |
| UI | CSS, Tailwind altyapısı, Lucide Icons, Recharts |
| State | React state, Zustand altyapısı |
| API | Node.js, Express, TypeScript |
| Realtime | Socket.io |
| Auth | JWT, server-side session kontrolü |
| Güvenlik | Helmet, CORS, express-rate-limit, RBAC guardları |
| Validasyon | Zod |
| ORM | Prisma |
| Veritabanı | PostgreSQL |
| Desktop | Electron |
| Android | Kotlin, Android WebView |
| Sunucu | Raspberry Pi OS, Nginx, systemd |
| Paket yöneticisi | npm workspaces |
| CI | GitHub Actions |

## Uygulama Bileşenleri

### Web Uygulaması

Web uygulaması `apps/web` altında bulunur. Next.js App Router kullanır ve statik export üretecek şekilde yapılandırılmıştır.

Önemli noktalar:

- Ana canlı yol: `/hotel/`
- Login yolu: `/hotel/login`
- Dashboard yolu: `/hotel/dashboard`
- Next.js config: `output: "export"`
- Build çıktısı: `apps/web/out`
- Ana sistem bileşeni: `apps/web/src/components/hotel-ops-system.tsx`
- Ana klasik stil dosyası: `apps/web/src/app/classic.css`
- Eski otel yollarını `/hotel` altına yönlendiren uyumluluk katmanı bulunur.

### API Uygulaması

API uygulaması `apps/api` altında bulunur. Express tabanlıdır ve PostgreSQL'e Prisma ile bağlanır.

Önemli noktalar:

- Varsayılan port: `4000`
- Health endpoint: `/health`
- Auth endpointleri: `/auth/login`, `/auth/logout`, `/auth/me`
- Bootstrap endpoint: `/bootstrap`
- JWT token ve session modeli birlikte kullanılır.
- Kullanıcı aktifliği, session süresi ve rol/permission kontrolleri API tarafında yapılır.
- Socket.io ile departman odalarına event gönderme altyapısı vardır.

### Desktop Uygulaması

Desktop uygulaması `apps/desktop` altında bulunur. Canlı HotelOps web adresini masaüstü uygulama kabuğu içinde açar.

Önemli noktalar:

- Hedef adres: `https://noderasoftware.com/hotel/`
- Ayrı API istemcisi çalıştırmaz.
- Node entegrasyonu kapalıdır.
- Windows pencere kontrolleri için özel regression guardrail dokümanı vardır.
- Çıktılar `apps/desktop/release` altına yazılır.

### Android Uygulaması

Android uygulaması `apps/android` altında bulunur. Canlı HotelOps web adresini Android WebView içinde açar.

Önemli noktalar:

- Hedef adres: `https://noderasoftware.com/hotel/`
- WebView üzerinde JavaScript ve DOM storage açıktır.
- Kamera ve fotoğraf seçici akışları desteklenir.
- Android tarafında sınırlı bir JavaScript bridge vardır.
- Push bildirimi için native hazırlık sınıfları bulunur.
- Uygulama kimliği: `com.example.nodera`

## Rol ve Yetki Modeli

Sistemde yetki modeli iki seviyede ele alınır:

1. Kullanıcının rolü neye izin veriyor?
2. Kullanıcının departman kapsamı hangi kayıtları görmesine izin veriyor?

Genel kural:

```text
Departman kullanıcısı yalnızca kendi departman kapsamını görür.
Genel Müdür tüm departmanları okuyabilir.
Kritik yazma işlemleri rol, departman ve permission kontrolünden geçer.
```

Örnek roller:

| Rol | Genel Kapsam |
| --- | --- |
| `generalManager` | Tüm departman görünürlüğü, yönetim raporları |
| `hrManager` | İnsan kaynakları, kullanıcı ve departman yönetimi |
| `technicalManager` | Teknik servis işleri ve takvimi |
| `technicalChief` | Teknik servis atama ve operasyon takibi |
| `hkManager` | Housekeeping yönetimi |
| `floorChief` | Kat ve oda operasyonları |
| `frontOfficeManager` | Ön büro talepleri ve ilgili departmanlara iş açma |
| `securityManager` | Güvenlik operasyonları |
| `spaManager` | SPA operasyonları |
| `fnbManager` | Yiyecek ve içecek operasyonları |
| `staff` | Kendi departmanı ve atanmış görevler |

Yetki kontrollerinin ana dosyaları:

- `apps/api/src/security.ts`
- `apps/web/src/lib/rbac.ts`

API tarafındaki RBAC kuralları kullanıcı arayüzünden bağımsızdır. UI'da bir buton gizlense bile API ayrıca permission ve scope kontrolü yapmalıdır.

## Veri Modeli

Prisma şeması `prisma/schema.prisma` dosyasındadır. Model aşağıdaki alanları kapsar:

- Otel ve departman yapısı.
- Roller ve permission setleri.
- Kullanıcılar, sessionlar ve login history kayıtları.
- Personel dosyası, eğitim, evrak, izin ve dijital imza alanları.
- İş emirleri, timeline, yorumlar ve ekler.
- Takvim etkinlikleri ve planlı işler.
- Oda geçmişi ve operasyon kayıtları.
- Yönetici talepleri.
- Hatırlatmalar.
- Bildirimler.
- Audit log kayıtları.
- Soft delete alanları.

Veritabanı yaklaşımı:

- PostgreSQL ana veritabanıdır.
- Prisma Client API katmanında kullanılır.
- Kritik silme işlemleri fiziksel silme yerine soft delete ile ele alınır.
- Kritik update işlemlerinde eski/yeni değerler audit log'a yazılmalıdır.

## API Özeti

Ana endpoint grupları:

| Grup | Endpoint Örnekleri |
| --- | --- |
| Health | `GET /health` |
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Bootstrap | `GET /bootstrap` |
| Kullanıcılar | `GET /users`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id` |
| Departmanlar | `GET /departments`, `POST /departments`, `DELETE /departments/:departmentId` |
| İş emirleri | `GET /work-orders`, `POST /work-orders`, `GET /work-orders/:code`, `PATCH /work-orders/:code` |
| İş emri detayları | `POST /work-orders/:code/comments`, `POST /work-orders/:code/attachments` |
| Takvim | `GET /calendar-events`, `POST /calendar-events`, `POST /calendar/work-orders` |
| Yönetici talepleri | `GET /management-requests`, `POST /management-requests`, `PATCH /management-requests/:id/status` |
| Hatırlatmalar | `GET /reminders`, `POST /reminders`, `PATCH /reminders/:id/complete` |
| Raporlar | `GET /reports/overview`, `GET /reports/daily` |
| Bildirimler | `GET /notifications`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read` |
| Audit | `GET /audit-logs` |

Detaylı endpoint tasarımı için:

- `docs/API_ENDPOINTS.md`

## Yerel Geliştirme

### Gereksinimler

- Windows geliştirme makinesi.
- Node.js 22 veya uyumlu güncel Node sürümü.
- npm.
- Git.
- PostgreSQL.
- PowerShell.
- Raspberry Pi deploy için SSH erişimi.

### Depoyu Alma

```powershell
git clone https://github.com/monocosmos/noderasoftware.git
cd noderasoftware
```

Mevcut çalışma klasöründe güncel kaynak alınacaksa:

```powershell
git fetch origin
git switch master
git pull --ff-only origin master
```

### Bağımlılık Kurulumu

```powershell
npm.cmd ci
```

Geliştirme sırasında `npm install` da kullanılabilir; fakat temiz kurulum ve CI benzeri tekrar üretilebilir ortam için `npm ci` tercih edilir.

### Ortam Dosyası

`.env.example` dosyasından `.env` oluşturun:

```powershell
Copy-Item .env.example .env
```

Gerekli değerleri yerel PostgreSQL ortamınıza göre düzenleyin.

### Veritabanı Hazırlığı

Prisma Client üretimi:

```powershell
npm.cmd run prisma:generate
```

Yerel geliştirme migration akışı:

```powershell
npm.cmd run prisma:migrate
```

Seed komutu API workspace içindedir:

```powershell
npm.cmd run seed --workspace @hotel-ops/api
```

Seed kullanıcılarının varsayılan şifresi `SEED_DEFAULT_PASSWORD` ortam değişkeniyle verilmelidir. Bu değer verilmezse seed scripti rastgele bir şifre üretir.

### Yerel Servisleri Başlatma

Hazır script:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\workstation\start-local-dev.ps1
```

Manuel komutlar:

```powershell
npm.cmd run api:dev
npm.cmd run dev
```

Yerel adresler:

```text
Web: http://127.0.0.1:3000/hotel/login
API: http://127.0.0.1:4000/health
```

## Ortam Değişkenleri

Örnek `.env`:

```env
DATABASE_URL="postgresql://hotelops:hotelops@localhost:5432/hotelops"
JWT_SECRET="change-me"
WEB_ORIGIN="http://127.0.0.1:3000"
PORT=4000
```

Önemli değişkenler:

| Değişken | Açıklama |
| --- | --- |
| `DATABASE_URL` | PostgreSQL bağlantı adresi |
| `JWT_SECRET` | JWT imzalama anahtarı |
| `WEB_ORIGIN` | CORS için izinli web origin listesi |
| `PORT` | API portu |
| `HOST` | API bind host değeri; varsayılan `0.0.0.0` |
| `SEED_DEFAULT_PASSWORD` | Seed kullanıcıları için başlangıç şifresi |

Güvenlik notu:

- `.env` dosyası repoya commit edilmez.
- Gerçek şifreler, tokenlar ve canlı veritabanı bilgileri GitHub'a yazılmaz.
- `.env.example` sadece örnek değerleri içerir.

## Komutlar

Kök `package.json` komutları:

| Komut | Açıklama |
| --- | --- |
| `npm.cmd run dev` | Web uygulamasını başlatır |
| `npm.cmd run build` | Web build/export alır |
| `npm.cmd run lint` | Web lint kontrolü |
| `npm.cmd run typecheck` | Web TypeScript kontrolü |
| `npm.cmd run api:dev` | API geliştirme modunu başlatır |
| `npm.cmd run desktop:start` | Desktop uygulamasını başlatır |
| `npm.cmd run desktop:pack` | Desktop paket üretimi |
| `npm.cmd run desktop:dist` | Desktop dağıtım çıktısı |
| `npm.cmd run desktop:test-window-controls` | Desktop pencere kontrol testi |
| `npm.cmd run prisma:generate` | Prisma Client üretir |
| `npm.cmd run prisma:migrate` | Prisma migration çalıştırır |

Web workspace komutları:

```powershell
npm.cmd run dev --workspace @hotel-ops/web
npm.cmd run build --workspace @hotel-ops/web
npm.cmd run lint --workspace @hotel-ops/web
npm.cmd run typecheck --workspace @hotel-ops/web
```

API workspace komutları:

```powershell
npm.cmd run dev --workspace @hotel-ops/api
npm.cmd run build --workspace @hotel-ops/api
npm.cmd run start --workspace @hotel-ops/api
npm.cmd run seed --workspace @hotel-ops/api
```

## Test ve Doğrulama

### Standart Yerel Kontrol

Kod değişikliğinden sonra minimum kontrol:

```powershell
npm.cmd run build --workspace @hotel-ops/web
```

API değişikliği varsa:

```powershell
npm.cmd run build --workspace @hotel-ops/api
```

Daha geniş kontrol:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\workstation\build-local.ps1
```

### Typecheck Notu

Next.js generated type dosyaları eksikse bağımsız typecheck hata verebilir. Büyük web değişikliklerinden sonra önce build çalıştırmak daha güvenlidir:

```powershell
npm.cmd run build --workspace @hotel-ops/web
npm.cmd run typecheck --workspace @hotel-ops/web
```

### Manuel Kullanıcı Akışı Kontrolü

Web değişikliği sonrası kontrol edilmesi gereken temel akışlar:

- `/hotel/login` açılıyor mu?
- Login çalışıyor mu?
- Dashboard KPI ve modül kartları görünüyor mu?
- Departman rolü değiştiğinde görünür kayıtlar daralıyor mu?
- İş emri oluşturma, durum güncelleme ve atama akışı çalışıyor mu?
- Takvimden iş oluşturma çalışıyor mu?
- Yönetici talebi ve hatırlatma akışı çalışıyor mu?
- Mobil genişlikte kartlar taşmadan görünüyor mu?
- API hata mesajları kullanıcıya anlaşılır dönüyor mu?

### Desktop Değişikliği Kontrolü

Desktop dosyaları değişirse şu dokümandaki guardrail uygulanmalıdır:

- `docs/DESKTOP_REGRESSION_GUARDRAILS.md`

Zorunlu temel kontroller:

```powershell
node --check apps\desktop\src\main.cjs
node --check apps\desktop\src\preload.cjs
node --check apps\desktop\src\desktop-inject.js
npm.cmd run dist --workspace @hotel-ops/desktop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\workstation\test-desktop-window-controls.ps1
```

## Raspberry Pi Canlı Yayın Akışı

Canlı sunucu Raspberry Pi'dir. Fakat Pi'ye gönderilen düzenleme önce GitHub'a işlenmelidir.

Önerilen güvenli sıra:

```text
1. git fetch / pull
2. branch aç
3. kodu değiştir
4. yerel test/build
5. commit
6. GitHub'a push
7. PR veya commit üzerinden kayıt altına al
8. Raspberry Pi'ye deploy
9. canlı sağlık kontrolü
```

### Hızlı Yayın Komutu

Yerel build zaten alındıysa:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\workstation\publish-to-pi.ps1 -SkipBuild
```

Build dahil yayın:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\workstation\publish-to-pi.ps1
```

İndirme dosyaları da değiştiyse:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\workstation\publish-to-pi.ps1 -SkipBuild -IncludeDownloads
```

Paket/dependency değiştiyse:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\workstation\publish-to-pi.ps1 -InstallDependencies
```

Veritabanı şeması değiştiyse:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\workstation\publish-to-pi.ps1 -PushDatabaseSchema
```

### Yayın Sonrası Sağlık Kontrolleri

Pi üzerinde servis kontrolü:

```powershell
ssh noderapi "systemctl is-active hotelops-api nginx postgresql ssh; curl -fsS http://127.0.0.1:4000/health; sudo nginx -t"
```

Dışarıdan canlı kontrol:

```powershell
curl.exe -I https://noderasoftware.com/hotel/
curl.exe -I https://noderasoftware.com/api/health
```

Script sırasında görülebilecek yerel `curl` veya timestamp uyarıları tek başına kesin hata sayılmamalıdır. Asıl karar; SSH servis durumu, API health, Nginx test sonucu ve dış HTTPS kontrolüyle verilmelidir.

## GitHub İş Akışı

Bu proje iki bilgisayardan aynı GitHub hesabı ve aynı Codex hesabı ile takip edilebilir. Kaynak gerçekliği GitHub olduğu için çalışma başlangıcı her zaman GitHub'daki güncel dal olmalıdır.

### Yeni İşe Başlama

```powershell
git switch master
git pull --ff-only origin master
git switch -c feature/kisa-is-adi
```

Branch adları kısa ve amaca yönelik olmalıdır:

```text
feature/rezervasyon-ekrani
fix/login-hata-mesaji
docs/guclu-readme
ui/job-detail-tasma-duzeltmesi
deploy/pi-health-check
```

### Commit Öncesi Kontrol

```powershell
git status --short
npm.cmd run build --workspace @hotel-ops/web
```

API değişikliği varsa:

```powershell
npm.cmd run build --workspace @hotel-ops/api
```

### Commit ve Push

```powershell
git add README.md
git commit -m "docs: expand project readme"
git push -u origin docs/guclu-readme
```

### Canlıya Çıkış Kuralı

Raspberry Pi'ye deploy edilecek değişiklik GitHub'a yüklenmeden canlıya gönderilmez.

Kabul edilen akış:

```text
Yerel değişiklik -> test -> commit -> push -> Pi deploy
```

Kabul edilmeyen akış:

```text
Yerel değişiklik -> direkt Pi deploy -> sonra belki GitHub
```

## Masaüstü ve Mobil Uygulamalar

### Windows Desktop

Desktop kabuk, canlı web uygulamasını yerel masaüstü uygulaması gibi açar.

Komutlar:

```powershell
npm.cmd run desktop:start
npm.cmd run desktop:pack
npm.cmd run desktop:dist
```

Desktop release çıktısı:

```text
apps/desktop/release
```

Desktop değişikliği yayınlanacaksa:

- Desktop build alınır.
- Setup/Portable çıktıları üretilir.
- İndirme dosyaları web public downloads alanına kopyalanır.
- `publish-to-pi.ps1 -IncludeDownloads` ile canlıya gönderilir.
- Canlı dosya boyutları ve indirme linkleri kontrol edilir.

### Android

Android uygulaması canlı web arayüzünü WebView içinde açar.

Önemli davranışlar:

- Sadece güvenilir `noderasoftware.com` origin'i için kamera izni akışı desteklenir.
- Dosya/fotoğraf seçici native Android akışına bağlanır.
- Auth token belirli WebView storage anahtarlarından native bridge'e senkronize edilir.
- Canlı web yüklenemezse native bağlantı hata ekranı gösterilir.

## Güvenlik İlkeleri

Bu projede güvenlik yalnızca UI seviyesinde ele alınmaz. API tarafı her kritik aksiyonda bağımsız kontrol yapmalıdır.

Temel ilkeler:

- Gizli bilgiler `.env` içinde kalır.
- `.env` repoya commit edilmez.
- JWT secret gerçek ortamda güçlü olmalıdır.
- Kullanıcı session geçerliliği API tarafında kontrol edilir.
- Pasif kullanıcı veya süresi dolmuş session erişim alamaz.
- RBAC API middleware ile uygulanır.
- Departman scope kontrolü kayıt okuma ve yazma işlemlerinde korunur.
- Kritik update/delete işlemleri audit log mantığıyla izlenir.
- CORS yalnızca izinli originlere açılır.
- Rate limit açık tutulur.
- Nginx HTTPS sonlandırması canlı ortamda zorunludur.

## Operasyonel Kontrol Listeleri

### Web Değişikliği

- GitHub'dan güncel kaynak alındı.
- Branch açıldı.
- Değişiklik yerelde yapıldı.
- `npm.cmd run build --workspace @hotel-ops/web` geçti.
- Mobil ve desktop görünüm kontrol edildi.
- Commit atıldı.
- GitHub'a push edildi.
- Pi deploy gerekiyorsa deploy edildi.
- `https://noderasoftware.com/hotel/` kontrol edildi.

### API Değişikliği

- API build geçti.
- Endpoint auth ve RBAC kontrolü incelendi.
- Veritabanı şema etkisi değerlendirildi.
- Migration veya db push gerekip gerekmediği belirlendi.
- Health endpoint kontrol edildi.
- Pi'de `hotelops-api` servisi aktif doğrulandı.

### Veritabanı Değişikliği

- `prisma/schema.prisma` değişikliği incelendi.
- Lokal Prisma Client üretildi.
- Yerel veritabanında test edildi.
- Canlıya çıkarken `-PushDatabaseSchema` gerekip gerekmediği belirlendi.
- Gerekirse canlı veritabanı yedeği alındı.

### Desktop Değişikliği

- Desktop guardrail dokümanı uygulandı.
- Pencere minimize, maximize, close ve tray davranışı test edildi.
- Setup/Portable çıktıları güncellendi.
- İndirme dosyaları canlıya `-IncludeDownloads` ile gönderildi.

### Raspberry Pi Deploy

- Değişiklik GitHub'a push edildi.
- Yerel build geçti.
- Deploy komutu çalıştı.
- API dosya hash doğrulaması geçti.
- `hotelops-api`, `nginx`, `postgresql` aktif.
- `sudo nginx -t` başarılı.
- Dış HTTPS kontrolü başarılı.

## Dokümantasyon Haritası

| Dosya | İçerik |
| --- | --- |
| `docs/SYSTEM_ARCHITECTURE.md` | Sistem mimarisi, katmanlar, RBAC ve veri modeli özeti |
| `docs/API_ENDPOINTS.md` | Endpoint tasarımları |
| `docs/WORKFLOWS.md` | İş, talep, departman görünürlüğü ve audit akışları |
| `docs/RASPBERRY_PI_DEPLOYMENT.md` | Raspberry Pi kurulum ve deploy notları |
| `docs/DESKTOP_REGRESSION_GUARDRAILS.md` | Desktop değişiklikleri için zorunlu test kuralları |
| `docs/CODEX_PROJECT_HANDOFF.md` | Proje devir notları |
| `docs/REMOTE_WORKSTATION_WORKFLOW.md` | Uzak bilgisayar çalışma akışı |
| `docs/TWO_COMPUTER_CODEX_WORKFLOW.md` | İki bilgisayarlı eski/operasyonel akış notları |
| `apps/desktop/README.md` | Desktop kabuk notları |
| `apps/desktop/MAC_BUILD.md` | macOS build notları |

## Sorun Giderme

### PowerShell `npm.ps1` çalıştırmıyor

Windows execution policy nedeniyle `npm` komutu PowerShell script shim'e takılabilir. Bu projede komutlarda güvenli şekilde `npm.cmd` kullanılır.

```powershell
npm.cmd ci
npm.cmd run build --workspace @hotel-ops/web
```

### Web typecheck `.next/types` hatası veriyor

Önce Next.js build çalıştırın:

```powershell
npm.cmd run build --workspace @hotel-ops/web
npm.cmd run typecheck --workspace @hotel-ops/web
```

### API başlamıyor

Kontrol listesi:

- `.env` var mı?
- `DATABASE_URL` doğru mu?
- PostgreSQL çalışıyor mu?
- Prisma Client üretildi mi?
- Port `4000` başka süreç tarafından kullanılıyor mu?

Komutlar:

```powershell
npm.cmd run prisma:generate
npm.cmd run build --workspace @hotel-ops/api
npm.cmd run api:dev
```

### Login çalışmıyor

Kontrol listesi:

- API health başarılı mı?
- Seed kullanıcıları oluşturuldu mu?
- `SEED_DEFAULT_PASSWORD` biliniyor mu?
- Tarayıcı localStorage içinde eski token kalmış mı?
- API CORS `WEB_ORIGIN` değerinde local web adresi var mı?

### Pi deploy başarılı görünüyor ama site açılmıyor

Kontrol komutları:

```powershell
ssh noderapi "systemctl is-active hotelops-api nginx postgresql ssh"
ssh noderapi "curl -fsS http://127.0.0.1:4000/health"
ssh noderapi "sudo nginx -t"
curl.exe -I https://noderasoftware.com/hotel/
```

### Desktop güncellemesi görünmüyor

Eski Electron süreçleri açık kalmış olabilir.

Kontrol:

- Çalışan desktop süreçlerini kapat.
- Yeni release çıktısını kurulu klasöre kopyala.
- Uygulamayı yeniden başlat.
- Pencere kontrol testini çalıştır.

## Katkı Kuralları

Bu depo gerçek canlı sisteme bağlı olduğu için katkı disiplini önemlidir.

Kurallar:

- Ana dal doğrudan rastgele değiştirilmez.
- Her iş branch üzerinde yapılır.
- Kod değişikliği yerelde test edilmeden Pi'ye gönderilmez.
- Pi'ye gönderilecek düzenleme önce GitHub'a push edilir.
- Gizli bilgi commit edilmez.
- Büyük refactor ile küçük bug fix aynı commit içinde karıştırılmaz.
- Kullanıcıya görünen davranış değişikliği README, docs veya PR notunda açıklanır.
- RBAC etkileyen değişikliklerde API guardları ayrıca incelenir.
- Deploy sonrası canlı sağlık kontrolü yapılır.

Önerilen commit mesajı formatı:

```text
feat: add reminder recipient filter
fix: prevent job detail overflow on mobile
docs: expand raspberry pi deploy notes
chore: update desktop release guardrails
```

## Projenin Güncel Önceliği

Bu projenin operasyon önceliği; GitHub'daki kaynak kodu güvenilir tek kayıt noktası yapmak, yerelde test edilmiş değişiklikleri kontrollü şekilde Raspberry Pi canlı sunucusuna taşımak ve iki bilgisayarlı geliştirme sürecinde geçmişi kaybetmeden ilerlemektir.

Kısa özet:

```text
Kaynak: GitHub
Geliştirme: Yerel bilgisayar
Canlı: Raspberry Pi
Kural: GitHub'a yüklenmeyen değişiklik Pi'ye gönderilmez
```
