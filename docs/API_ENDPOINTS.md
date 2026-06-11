# API Endpoint Tasarımı

## Auth

| Method | Endpoint | Açıklama |
| --- | --- | --- |
| POST | `/auth/login` | JWT token üretir, login history kaydı açar. |
| POST | `/auth/logout` | Session revoke. |

## Dashboard

| Method | Endpoint | Yetki |
| --- | --- | --- |
| GET | `/me` | Aktif kullanıcı, modül ve dashboard yetkileri. |
| GET | `/work-orders` | Rol kapsamına göre filtreli iş listesi. |
| GET | `/calendar-events` | Departman takvimi; genel müdür tüm departmanları okur. |

## Work Orders

| Method | Endpoint | Açıklama |
| --- | --- | --- |
| GET | `/work-orders` | Rol ve departman kapsamına göre filtreli liste. |
| POST | `/work-orders` | Yetkili rol için iş veya planlı görev oluşturur. |
| GET | `/work-orders/:id` | Detay, yorum, fotoğraf ve timeline. |
| PATCH | `/work-orders/:id` | Departman müdürü/şefi için durum ve atama güncelleme; diğer alanlar scope içinde kalır. |
| DELETE | `/work-orders/:id` | Soft delete; sadece politika izin veriyorsa. |
| POST | `/work-orders/:id/comments` | Yorum ekler. |
| POST | `/work-orders/:id/attachments` | Fotoğraf ekler. |

## Calendar

| Method | Endpoint | Açıklama |
| --- | --- | --- |
| GET | `/calendar-events` | Departman takvim kayıtları. |
| POST | `/calendar/work-orders` | Departman takviminden planlı iş oluşturur. |
| PATCH | `/calendar/work-orders/:id/status` | Sadece ilgili departman müdürü/şefi durum günceller. |

## HR

| Method | Endpoint | Açıklama |
| --- | --- | --- |
| GET | `/users` | Personel listesi. |
| POST | `/users` | Personel ekleme. |
| PATCH | `/users/:id` | Personel düzenleme. |
| DELETE | `/users/:id` | Personel pasifleştirme. |
| GET | `/departments` | Departman listesi. |
| POST | `/departments` | İK için departman oluşturma. |
| DELETE | `/departments/:id` | İK için departman silme/pasifleştirme. |

## Realtime Events

Socket.io room yapısı:

- `department:technical`
- `department:housekeeping`
- `department:frontOffice`
- `department:security`
- `department:hr`
- `department:spa`
- `department:fnb`

Örnek eventler:

- `work-order.created`
- `work-order.updated`
- `work-order.comment.created`
- `notification.created`
- `sla.warning`
