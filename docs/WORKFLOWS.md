# Workflow Tasarımları

## Arıza Akışı

```mermaid
flowchart LR
  A["Arıza bildirildi"] --> B["Departman müdürü veya şefi atama yaptı"]
  B --> C["Atanan kişi görevi aldı"]
  C --> D["İş yapılıyor"]
  D --> E{"Tamamlandı mı?"}
  E -- "Evet" --> F["Tamamlandı olarak işaretlendi"]
  E -- "Hayır" --> G["Beklemeye alındı veya gecikti"]
  F --> H["İş listesinde aktif görünümden çıktı"]
  G --> D
```

Her adım `WorkOrderTimeline` tablosuna kullanıcı, tarih/saat, eski/yeni durum ve metadata ile yazılır.

## Talep Akışı

```mermaid
flowchart TD
  A["Talep oluşturuldu"] --> B["İlgili müdür, şef veya genel müdür seçildi"]
  B --> C["Sadece ilgili taraflar talebi gördü"]
  C --> D["Yanıt veya aksiyon notu eklendi"]
  D --> E["Talep kapatıldı"]
```

## Departman Görünürlüğü

```mermaid
flowchart LR
  U["Kullanıcı"] --> R["Rol"]
  R --> S["Departman Scope"]
  S --> API["API Policy Guard"]
  API --> UI["UI Filtreleri"]
  API --> DB["PostgreSQL Row Scope"]
```

## Audit ve Soft Delete

- Silme işlemleri fiziksel silme değildir; `deletedAt` set edilir.
- Kritik update öncesi/sonrası JSON snapshot `AuditLog.before` ve `AuditLog.after` alanlarına yazılır.
- IP, user agent, session ve actor bilgisi her aksiyonda saklanır.
