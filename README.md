# HotelOps Enterprise Platform

Modern, rol bazlı ve Node.js tabanlı otel operasyon ERP prototipi.

## Çalıştırma

```bash
npm install
npm run dev
```

Web uygulaması varsayılan olarak `http://127.0.0.1:3000` adresinde çalışır.

## İçerik

- `apps/web`: Next.js, TypeScript, TailwindCSS, Zustand ve Recharts tabanlı SaaS arayüzü.
- `apps/api`: Node.js, Express, Socket.io, JWT, rate limit ve RBAC örnek API katmanı.
- `prisma/schema.prisma`: PostgreSQL için enterprise veri modeli.
- `docs`: sistem mimarisi, endpointler ve workflow tasarımları.

## Demo Davranışı

Arayüzde üst bardaki rol seçiciyle RBAC görünürlüğü test edilebilir. Genel Müdür tüm modülleri görür; departman rollerinde sidebar, KPI, tablo, takvim ve bildirimler departman kapsamına iner.
