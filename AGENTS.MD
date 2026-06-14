# HotelOps Frontend Modül Ağacı

Bu repo içinde HotelOps web uygulamasının ana ekranı `apps/web/src/components/hotel-ops-system.tsx` dosyasından başlar. Bu dosya artık mümkün olduğunca uygulama orkestrasyonu, state yönetimi, route seçimi ve sayfa akışını tutmalıdır. Yeni yardımcı tipler, medya işlemleri ve ortak UI parçaları `apps/web/src/components/hotel-ops/` ağacına taşınmıştır.

## Ana Gövde

- `apps/web/src/components/hotel-ops-system.tsx`
  - HotelOps uygulamasının ana kabuğu.
  - Oturum, bootstrap, socket/event dinleme, route seçimi ve sayfa render akışını yönetir.
  - Büyük domain sayfaları burada kalıyorsa yalnızca geçiş aşaması sebebiyledir. Yeni iş eklenirken önce aşağıdaki dallardan uygun olanı seçin.

## Dallar

- `apps/web/src/components/hotel-ops/types.ts`
  - HotelOps domain tipleri burada yaşar.
  - İş kayıtları, kullanıcılar, bildirimler, vardiya panelleri, departman tabloları, otel kayıtları ve shell/app update tipleri bu dala aittir.
  - Yeni componentler arası paylaşılan tipler önce buraya eklenmelidir.

- `apps/web/src/components/hotel-ops/media.tsx`
  - Fotoğraf/video sıkıştırma, veri URL normalizasyonu, medya payload hazırlama, medya önizleme/lightbox ve `PhotoPicker` bu dala aittir.
  - İş, hatırlatma veya başka bir ekranda medya seçimi gerekiyorsa bu dosyadaki `PhotoPicker`, `MediaPreview`, `PhotoLightbox` ve payload helperları kullanılmalıdır.
  - Medya davranışı değiştirilecekse ana `hotel-ops-system.tsx` yerine bu dosya düzenlenmelidir.

- `apps/web/src/components/hotel-ops/branding.tsx`
  - Nodera logosu, sidebar shell meta bilgisi, uygulama indirme kartları ve zorunlu güncelleme ekranı bu dala aittir.
  - Windows/Android/Linux/Apple indirme seçenekleri veya app update kart tasarımı burada değiştirilmelidir.

- `apps/web/src/components/hotel-ops/ui-common.tsx`
  - Küçük ortak UI atomları burada yaşar.
  - `Info`, `EmptyState`, `AccessDenied` gibi domain bağımsız, tekrar kullanılan parçalar bu dala eklenmelidir.

- `apps/web/src/components/hotel-ops/jobs.tsx`
  - İş modülüne ait izole UI parçaları burada yaşar.
  - Şu anda not ekleme modalı `JobNoteComposer` burada bulunur.
  - İş listesi, iş detay, iş formu gibi büyük parçalar ilerleyen refactorlarda bu dala taşınmalıdır.

## Yeni Kod Yerleşim Kuralı

- Paylaşılan tip ekliyorsan: `hotel-ops/types.ts`.
- Medya, fotoğraf, video veya dosya payload işi ekliyorsan: `hotel-ops/media.tsx`.
- Marka, indirme veya shell update UI ekliyorsan: `hotel-ops/branding.tsx`.
- Genel küçük UI atomu ekliyorsan: `hotel-ops/ui-common.tsx`.
- İş domainine ait yeni modal, kart veya alt component ekliyorsan: `hotel-ops/jobs.tsx`.
- Büyük bir sayfa componenti ekliyorsan ana dosyaya gömmek yerine önce yeni domain dosyası aç: örn. `hotel-ops/calendar.tsx`, `hotel-ops/settings.tsx`, `hotel-ops/reports.tsx`.

## Refactor Sınırı

Bu yapı davranış değiştirmek için değil, büyüyen `hotel-ops-system.tsx` dosyasını yönetilebilir dallara ayırmak için kurulmuştur. Yeni taşımalarda önce typecheck ve lint temiz kalmalı, sonra gerekiyorsa sayfa davranışı ayrı commit veya ayrı değişiklik olarak ele alınmalıdır.
