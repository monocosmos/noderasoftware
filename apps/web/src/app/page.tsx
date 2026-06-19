import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Building2,
  ChevronRight,
  CircuitBoard,
  ClipboardCheck,
  Code2,
  Cpu,
  Download,
  ExternalLink,
  Factory,
  Github,
  Globe2,
  Mail,
  MapPin,
  MonitorCog,
  Network,
  ScanSearch,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wrench
} from "lucide-react";
import { ThemeToggle } from "../components/theme-toggle";

export const metadata: Metadata = {
  title: "Nodera Software | Hotel, Embedded ve Kalite Yönetim Yazılımları",
  description:
    "Nodera Software; HotelOps, STM32/ESP32 tabanlı gömülü yazılım, ISO 9001/14001 kalite yönetimi, elektronik tasarım ve özel otomasyon çözümleri geliştirir."
};

const brandLogo = "/brand/nodera-logo.png";

const serviceLines: Array<{ title: string; text: string; icon: LucideIcon }> = [
  {
    title: "Özel web panelleri",
    text: "Satış, operasyon, stok, servis ve yönetim işlerini tek merkeze alan hızlı ve ölçülebilir web uygulamaları.",
    icon: MonitorCog
  },
  {
    title: "Elektronik kart ve kütüphane",
    text: "Altium Designer tabanlı kart kütüphaneleri, eğitim kitleri ve mikrodenetleyici çevre birimi tasarımları.",
    icon: CircuitBoard
  },
  {
    title: "Görüntü işleme",
    text: "Python ve OpenCV ile tespit, ölçüm, geometri işleme ve Raspberry Pi destekli prototipleme işleri.",
    icon: ScanSearch
  },
  {
    title: "C# ve otomasyon arayüzleri",
    text: "Makine, saha cihazı veya kurum içi iş akışları için masaüstü arayüzler ve kontrol ekranları.",
    icon: Code2
  }
];

const currentProducts = [
  {
    name: "STM32_KalmanFilter_MPU6050",
    type: "STM32",
    text: "MPU6050 ve Kalman filtre odağında hareket/ölçüm çözümü.",
    href: "https://github.com/spacemonochrome/STM32_KalmanFilter_MPU6050"
  },
  {
    name: "demedukit_kod_arsiv",
    type: "STM32 / ESP32",
    text: "Demedukit eğitim kiti için hazırlanmış gömülü kod arşivi.",
    href: "https://github.com/spacemonochrome/demedukit_kod_arsiv"
  },
  {
    name: "hfk-altium-library",
    type: "Altium",
    text: "Elektronik kart tasarımı için parça ve proje kütüphanesi.",
    href: "https://github.com/spacemonochrome/hfk-altium-library"
  },
  {
    name: "STM32_Series",
    type: "STM32",
    text: "STM32 işlemci ailesi için örnek kod ve öğrenme arşivi.",
    href: "https://github.com/spacemonochrome/STM32_Series"
  },
  {
    name: "circle_detect_code",
    type: "Python / OpenCV",
    text: "Görüntü işleme ile çember tespiti ve ölçüm denemesi.",
    href: "https://github.com/spacemonochrome/circle_detect_code"
  },
  {
    name: "csharp_fuzzy_logic_example",
    type: "C#",
    text: "Sera otomasyonu için Mamdani bulanık mantık uygulaması.",
    href: "https://github.com/spacemonochrome/csharp_fuzzy_logic_example"
  }
];

const qmsModules = [
  "Doküman ve revizyon yönetimi",
  "Uygunsuzluk, CAPA ve kök neden takibi",
  "İç tetkik ve tedarikçi değerlendirme",
  "Çevre hedefleri, atık ve faaliyet kayıtları"
];

export default function Home() {
  return (
    <main className="nodera-site min-h-screen bg-[#e7eef6] text-[#17324d]">
      <section className="relative isolate overflow-hidden border-b border-[#b8cce0] bg-[#123a56] text-[#edf7ff]">
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(to_right,rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(59,130,246,0.07)_1px,transparent_1px)] bg-[size:54px_54px]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(140deg,rgba(18,58,86,0.98)_0%,rgba(21,77,111,0.94)_48%,rgba(42,116,139,0.9)_100%)]" />

        <div className="mx-auto flex min-h-[76vh] w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
          <nav className="flex items-center justify-between gap-4">
            <Link href="/" className="flex min-w-0 items-center gap-3 text-sm font-bold uppercase text-[#edf7ff]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#eaf4fb] p-1.5">
                <Image src={brandLogo} alt="Nodera Software logosu" width={36} height={36} priority unoptimized />
              </span>
              <span className="truncate">Nodera Software</span>
            </Link>
            <div className="hidden items-center gap-6 text-sm font-semibold text-[#d5ebf8] md:flex">
              <a href="#urunler" className="hover:text-[#ffffff]">
                Ürünler
              </a>
              <Link href="/videowallplayer/" className="hover:text-[#ffffff]">
                VideoWallPlayer
              </Link>
              <a href="#embedded" className="hover:text-[#ffffff]">
                STM32 / ESP32
              </a>
              <a href="#kalite" className="hover:text-[#ffffff]">
                Kalite
              </a>
              <a href="#referanslar" className="hover:text-[#ffffff]">
                Referanslar
              </a>
              <a href="#iletisim" className="hover:text-[#ffffff]">
                İletişim
              </a>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <a
                href="mailto:info@noderasoftware.com"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#eaf4fb] px-4 py-2.5 text-sm font-bold text-[#17324d] transition hover:bg-[#d5ebf8]"
              >
                <Mail size={16} />
                Teklif Al
              </a>
            </div>
          </nav>

          <div className="flex flex-1 items-center py-10 lg:py-14">
            <div className="max-w-4xl">
              <p className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#22d3ee]/45 bg-[#22d3ee]/10 px-3 py-2 text-sm font-semibold text-[#a5f3fc]">
                <Sparkles size={16} />
                Otel, gömülü sistem ve kalite yönetimi için yazılım
              </p>
              <h1 className="max-w-4xl text-5xl font-semibold leading-[1.04] md:text-6xl lg:text-7xl">
                Nodera Software
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#d5ebf8]">
                Hotel yönetim sistemi, STM32/ESP32 tabanlı ürün yazılımları, ISO 9001/14001 kalite yönetim modülleri ve
                mevcut elektronik/yazılım ürünleri için tanıtım, satış ve uygulama merkezi.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#urunler"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#2dd4bf] px-5 py-3 text-sm font-bold text-[#17324d] transition hover:bg-[#67e8f9]"
                >
                  Ürünleri incele
                  <ArrowRight size={17} />
                </a>
                <Link
                  href="/hotel/"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-[#d5ebf8]/35 px-5 py-3 text-sm font-semibold text-[#edf7ff] transition hover:bg-[#edf7ff]/12"
                >
                  HotelOps demosu
                  <ExternalLink size={17} />
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3 text-sm font-semibold text-[#d5ebf8]">
                <span className="inline-flex items-center gap-2 rounded-md border border-[#d5ebf8]/25 bg-[#edf7ff]/10 px-3 py-2">
                  <MapPin size={16} />
                  İstanbul
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-[#d5ebf8]/25 bg-[#edf7ff]/10 px-3 py-2">
                  <Factory size={16} />
                  KOBİ ve saha operasyonları
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-[#d5ebf8]/25 bg-[#edf7ff]/10 px-3 py-2">
                  <BadgeCheck size={16} />
                  Web, mobil, desktop, embedded
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="urunler" className="border-y border-[#5f86a0] bg-[#07111f] text-[#edf7ff]">
        <div className="relative min-h-[calc(100vh-96px)] overflow-hidden">
          <iframe
            title="Nodera HotelOps web tabanlı tanıtım deneyimi"
            src="/animations/hotelops-ad/Nodera%20Reklam%20Web.html"
            className="pointer-events-none absolute inset-0 h-full w-full border-0 opacity-55"
            loading="eager"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_62%_42%,rgba(47,230,176,0.08),transparent_34%),linear-gradient(90deg,rgba(7,17,31,0.94)_0%,rgba(7,17,31,0.82)_42%,rgba(7,17,31,0.52)_100%)]" />
          <div className="relative z-10 mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-7xl flex-col justify-center px-5 py-16 sm:px-8 lg:px-10">
            <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
              <div>
                <p className="text-sm font-bold uppercase text-[#2dd4bf]">HotelOps web deneyimi</p>
                <h2 className="mt-5 max-w-3xl text-5xl font-semibold leading-tight sm:text-6xl">
                  Nodera HotelOps
                </h2>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-[#d5ebf8]">
                  Otel operasyonlarını, departman görevlerini ve yönetim takiplerini tek merkezde toplayan seçilebilir,
                  tıklanabilir ve web tabanlı tanıtım yüzeyi.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/hotel/"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-[#2dd4bf] px-5 py-3 text-sm font-bold text-[#17324d] transition hover:bg-[#67e8f9]"
                  >
                    HotelOps girişini aç
                    <ExternalLink size={17} />
                  </Link>
                  <a
                    href="mailto:info@noderasoftware.com"
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-[#d5ebf8]/35 px-5 py-3 text-sm font-semibold text-[#edf7ff] transition hover:bg-[#edf7ff]/12"
                  >
                    Demo talep et
                    <Mail size={17} />
                  </a>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { value: "Housekeeping", label: "oda ve görev takibi" },
                  { value: "Teknik servis", label: "arıza, bakım ve aksiyon" },
                  { value: "Yönetim", label: "rapor, rol ve süreç görünümü" }
                ].map((item) => (
                  <div key={item.value} className="rounded-lg border border-[#d5ebf8]/22 bg-[#edf7ff]/10 p-5 backdrop-blur-md">
                    <p className="text-xl font-bold text-[#ffffff]">{item.value}</p>
                    <p className="mt-3 text-sm font-semibold leading-6 text-[#c8e3f3]">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="videowallplayer" className="border-y border-[#b8cce0] bg-[#edf4fa] px-5 py-14 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div className="flex items-start gap-5">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-[#b8cce0] bg-[#07111f] p-3">
              <Image
                src="/brand/videowallplayer/brand-logo.png"
                alt="VideoWallPlayer logosu"
                width={64}
                height={64}
                className="h-full w-full object-contain"
                unoptimized
              />
            </span>
            <div>
              <p className="text-sm font-bold uppercase text-[#2563eb]">Yeni yayınlanan proje</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight">VideoWallPlayer</h2>
              <p className="mt-4 max-w-2xl leading-8 text-[#4d647a]">
                Otel, showroom ve video wall ekranlarında kenarlıksız, tam ekran ve kesintisiz oynatma için Windows ve
                Android tabanlı medya oynatıcı.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              "Windows ve Android paketleri",
              "VLC/libVLC codec altyapısı",
              "Loop, karışık mod ve kiosk oynatma"
            ].map((item) => (
              <div key={item} className="rounded-lg border border-[#b8cce0] bg-[#e1ebf4] p-5">
                <BadgeCheck className="text-[#16a34a]" size={22} />
                <p className="mt-4 text-sm font-bold leading-6 text-[#17324d]">{item}</p>
              </div>
            ))}
          </div>
          <div className="lg:col-span-2 flex flex-wrap gap-3">
            <Link
              href="/videowallplayer/"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#2f80c9] px-5 py-3 text-sm font-bold text-[#edf7ff] transition hover:bg-[#2563eb]"
            >
              Detay ve indirme
              <Download size={17} />
            </Link>
            <a
              href="https://github.com/monocosmos/VideoWallPlayer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[#b8cce0] px-5 py-3 text-sm font-semibold text-[#17324d] transition hover:bg-[#d8e6f2]"
            >
              Kaynak kod
              <Github size={17} />
            </a>
          </div>
        </div>
      </section>

      <section className="border-y border-[#b8cce0] bg-[#e1ebf4] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="text-sm font-bold uppercase text-[#2563eb]">HotelOps</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight">Otel içi işler için operasyon merkezi.</h2>
            <p className="mt-5 leading-8 text-[#4d647a]">
              Housekeeping, teknik servis, talepler, kayıp eşya, envanter, duyuru, eğitim ve VIP takiplerini rol bazlı
              ekranlarla yönetmek için geliştirildi.
            </p>
            <Link
              href="/hotel/"
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-md bg-[#2f80c9] px-5 py-3 text-sm font-bold text-[#edf7ff] transition hover:bg-[#2563eb]"
            >
              HotelOps girişini aç
              <ExternalLink size={17} />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Departman bazlı iş takibi", icon: Building2 },
              { title: "Mobil ve masaüstü erişim", icon: Smartphone },
              { title: "Canlı API ve raporlama altyapısı", icon: Network },
              { title: "Yerel sunucu veya bulut kurulum", icon: ShieldCheck }
            ].map(({ title, icon: Icon }) => (
              <div key={title} className="rounded-lg border border-[#b8cce0] bg-[#edf4fa] p-6">
                <Icon className="text-[#2563eb]" size={28} />
                <p className="mt-8 text-xl font-semibold">{title}</p>
                <p className="mt-3 leading-7 text-[#4d647a]">
                  Kuruma göre yetki, ekran, süreç ve raporlar uyarlanarak teslim edilir.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="embedded" className="px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
          <div className="rounded-lg border border-[#b8cce0] bg-[#1e4f6f] p-7 text-[#edf7ff]">
            <p className="text-sm font-bold uppercase text-[#facc15]">STM32 / ESP32</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight">Firmware, eğitim kiti ve saha prototipi.</h2>
            <p className="mt-5 leading-8 text-[#d5ebf8]">
              Sensör, haberleşme, motor/kontrol, veri toplama ve cihaz arayüzü işleri için ürünleşmeye hazır gömülü
              yazılım geliştirme hattı.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {["UART, I2C, SPI, ADC", "Wi-Fi ve IoT senaryoları", "MPU6050 ve filtreleme", "Raspberry Pi entegrasyonu"].map(
                (item) => (
                  <div key={item} className="rounded-md border border-[#d5ebf8]/25 bg-[#edf7ff]/12 p-4 text-sm font-semibold text-[#e1f2fb]">
                    {item}
                  </div>
                )
              )}
            </div>
          </div>
          <div id="kalite" className="rounded-lg border border-[#b8cce0] bg-[#edf4fa] p-7 shadow-soft">
            <p className="text-sm font-bold uppercase text-[#2563eb]">ISO 9001 / ISO 14001</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight">Kalite süreçleri için yönetilebilir yazılım modülleri.</h2>
            <p className="mt-5 leading-8 text-[#4d647a]">
              Klasör ve Excel ağırlıklı kalite takibini kontrollü, izlenebilir ve raporlanabilir bir sisteme taşımak için
              modüler yapı.
            </p>
            <div className="mt-8 space-y-3">
              {qmsModules.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-md border border-[#b8cce0] bg-[#e1ebf4] p-4">
                  <ShieldCheck className="shrink-0 text-[#16a34a]" size={20} />
                  <span className="font-semibold text-[#17324d]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#b8cce0] bg-[#d8e6f2] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.66fr_1.34fr]">
            <div>
              <p className="text-sm font-bold uppercase text-[#2563eb]">Hizmet alanları</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight">Mevcut uzmanlıklar satış diline dönüştürüldü.</h2>
              <p className="mt-5 leading-8 text-[#4d647a]">
                Canlı sitedeki portföy başlıkları artık ürünleştirilebilir hizmet kalemleri olarak konumlandırıldı.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-lg border border-[#b8cce0] bg-[#b8cce0] md:grid-cols-2">
              {serviceLines.map(({ title, text, icon: Icon }) => (
                <article key={title} className="bg-[#edf4fa] p-7">
                  <Icon className="mb-8 text-[#2563eb]" size={30} />
                  <h3 className="text-xl font-semibold">{title}</h3>
                  <p className="mt-4 leading-7 text-[#4d647a]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="referanslar" className="bg-[#e7eef6] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-bold uppercase text-[#2563eb]">Mevcut ürün ve referanslar</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight">Sitedeki açık ürünler korunarak tanıtım alanına taşındı.</h2>
            </div>
            <a
              href="https://github.com/spacemonochrome?tab=repositories"
              className="inline-flex items-center gap-2 rounded-md border border-[#b8cce0] px-4 py-3 text-sm font-semibold text-[#17324d] transition hover:bg-[#d8e6f2]"
            >
              Tüm repolar
              <Github size={16} />
            </a>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {currentProducts.map((product) => (
              <a
                key={product.name}
                href={product.href}
                className="group rounded-lg border border-[#b8cce0] bg-[#edf4fa] p-6 transition hover:-translate-y-0.5 hover:border-[#60a5fa] hover:shadow-xl hover:shadow-[#2f80c9]/16"
              >
                <div className="flex items-start justify-between gap-4">
                  <Blocks className="text-[#2563eb]" size={24} />
                  <span className="rounded-md border border-[#b8cce0] bg-[#e1ebf4] px-2 py-1 text-xs font-bold text-[#4d647a]">
                    {product.type}
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-semibold group-hover:text-[#2563eb]">{product.name}</h3>
                <p className="mt-4 min-h-20 leading-7 text-[#4d647a]">{product.text}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#2563eb]">
                  İncele
                  <ChevronRight size={16} />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="iletisim" className="border-t border-[#b8cce0] bg-[#1e4f6f] px-5 py-16 text-[#edf7ff] sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-bold uppercase text-[#22d3ee]">Satış ve demo</p>
            <h2 className="mt-3 text-3xl font-semibold">HotelOps, embedded ya da kalite yönetimi için görüşme başlatın.</h2>
            <p className="mt-4 max-w-2xl leading-7 text-[#d5ebf8]">
              Kurulum kapsamı, demo akışı, ürün özelleştirme ve teslim planı için doğrudan iletişime geçilebilir.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="mailto:info@noderasoftware.com"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#2dd4bf] px-5 py-3 text-sm font-bold text-[#17324d] transition hover:bg-[#67e8f9]"
            >
              info@noderasoftware.com
              <Mail size={17} />
            </a>
            <a
              href="https://www.noderasoftware.com/"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[#d5ebf8]/35 px-5 py-3 text-sm font-semibold text-[#edf7ff] transition hover:bg-[#edf7ff]/12"
            >
              <Globe2 size={17} />
              noderasoftware.com
            </a>
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-3 text-sm font-semibold text-[#c6e2f2]">
            <span className="inline-flex items-center gap-2">
              <Wrench size={15} />
              Özel geliştirme
            </span>
            <span className="inline-flex items-center gap-2">
              <Cpu size={15} />
              Gömülü sistem
            </span>
            <span className="inline-flex items-center gap-2">
              <ClipboardCheck size={15} />
              Kalite süreçleri
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
