# HotelOps Enterprise Sistem Mimarisi

## 1. Ürün Kapsamı

HotelOps Enterprise büyük ölçekli oteller için tek merkezli operasyon platformudur. Sistem; İnsan Kaynakları, Teknik Servis, Housekeeping, Ön Büro, Güvenlik, SPA ve Yiyecek & İçecek operasyonlarını rol bazlı görünürlükle yönetir.

## 2. Monorepo Yapısı

```text
apps/
  web/                  Next.js + TypeScript arayüz
  api/                  Node.js + Express + Socket.io API
packages/
  domain/               Ortak domain sabitleri ve tipler
  ui/                   Design token ve ortak UI varlıkları
prisma/
  schema.prisma         PostgreSQL veri modeli
docs/
  SYSTEM_ARCHITECTURE.md
  API_ENDPOINTS.md
  WORKFLOWS.md
```

## 3. Frontend Mimarisi

`apps/web` App Router kullanan bir Next.js uygulamasıdır.

- State: rol, aktif modül, dashboard parçaları, takvim görünümü ve kullanıcı oturumu.
- UI: mobil öncelikli kart, alt menü, hamburger menü ve departman bazlı modül görünürlüğü.
- Responsive: iş listesi, arıza kartları, takvim ve yapılacak işler mobil ekrana taşmadan sığacak şekilde düzenlenir.
- RBAC: `src/lib/rbac.ts` görünür departmanları ve permission setlerini belirler.

## 4. Backend Mimarisi

`apps/api` güvenli API katmanını sağlar.

- Authentication: JWT access token ve session modeli.
- Authorization: departman kapsamlı RBAC middleware.
- Critical action guard: iş durumu ve atama güncellemesi sadece ilgili departman müdürü veya şefi tarafından yapılır.
- Rate limit: `express-rate-limit`.
- Secure headers: `helmet`.
- Realtime: Socket.io department room yapısı.
- Validation: Zod request şemaları.
- Audit: Prisma modelinde kritik aksiyonlar `AuditLog` ile izlenir.

## 5. Database Tasarımı

PostgreSQL + Prisma şeması şunları kapsar:

- Otel, departman, rol, izin, kullanıcı.
- Personel dosyası, izin, eğitim, evrak, dijital imza.
- İş emri, timeline, yorum, dosya/fotoğraf, soft delete.
- Takvim, oda durumu, varlık, hatırlatma ve yönetici talepleri.
- Bildirim, oturum, login history, IP log, audit log.

## 6. RBAC Kuralı

Departman kullanıcısı yalnızca kendi departman kapsamını görür. Genel Müdür tüm departmanları görüntüler fakat politika gereği iş emri oluşturma, durum değiştirme ve veri silme yetkisi verilmez.

Örnek kapsamlar:

- Genel Müdür: tüm departmanları okur.
- İK Müdürü: HR ve yetkilendirme ekranları.
- Teknik Müdür / Teknik Şef / Teknik Personel: Teknik Servis kapsamı.
- HK Müdürü / Kat Şefi: Housekeeping kapsamı.
- Ön Büro Müdürü: Ön Büro kapsamı; ilgili departmanlara iş/talep açabilir.
- Güvenlik Müdürü: Güvenlik kapsamı.
- SPA Yöneticisi: SPA kapsamı.
- F&B Müdürü: F&B kapsamı.
