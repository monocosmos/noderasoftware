# Nodera Sistem Desktop

Windows için Nodera Sistem WebView kabuğu.

- Hedef adres: `https://noderasoftware.com/hotel/`
- Uygulama kendi API istemcisi çalıştırmaz.
- Node entegrasyonu kapalıdır.
- Windows üzerinde Mica arka plan materyali denenir; desteklenmeyen Windows sürümlerinde normal pencere olarak açılır.
- Ayrı bir webview çubuğu kullanılmaz; uygulama direkt Nodera Sistem arayüzüyle açılır.
- Windows'un kendi küçült, büyüt ve kapat kontrolleri kullanılır. Tam ekran için `F11` kullanılabilir.
- Canlı web adresi kullanıcı arayüzünde gösterilmez.

## Komutlar

```powershell
npm run desktop:start
npm run desktop:pack
npm run desktop:dist
```

`desktop:dist` çıktıları `apps/desktop/release` klasörüne yazılır.
