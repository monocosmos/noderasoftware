import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Blocks,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircuitBoard,
  ClipboardCheck,
  Code2,
  Cpu,
  ExternalLink,
  Factory,
  Github,
  Globe2,
  Hotel,
  Layers3,
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

const platformStats = [
  { value: "HotelOps", label: "otel operasyon platformu" },
  { value: "STM32 / ESP32", label: "gömülü sistem yazılımı" },
  { value: "ISO 9001 / 14001", label: "kalite ve çevre yönetimi" }
];

const mainProducts: Array<{
  title: string;
  eyebrow: string;
  text: string;
  icon: LucideIcon;
  features: string[];
  href: string;
}> = [
  {
    title: "HotelOps Yönetim Sistemi",
    eyebrow: "SaaS + masaüstü + mobil",
    text: "Otel ekiplerinin housekeeping, teknik servis, ön büro, güvenlik, stok, eğitim ve yönetim süreçlerini tek ekranda toplar.",
    icon: Hotel,
    features: ["Rol bazlı operasyon ekranları", "Web, Windows ve Android kullanım", "Raspberry Pi üzerinde canlı kurulum"],
    href: "/hotel/"
  },
  {
    title: "STM32 ve ESP32 Yazılım Paketleri",
    eyebrow: "embedded ürünleşme",
    text: "Sensör okuma, haberleşme, kontrol algoritmaları, eğitim kiti arşivleri ve üretime yakın mikrodenetleyici firmware çalışmaları.",
    icon: Cpu,
    features: ["STM32 örnek kod arşivleri", "ESP32 eğitim kiti yazılımları", "Prototipten saha testine geçiş"],
    href: "#embedded"
  },
  {
    title: "Kalite Yönetim Yazılımları",
    eyebrow: "ISO 9001 ve ISO 14001",
    text: "Doküman kontrolü, aksiyon takibi, iç tetkik, uygunsuzluk, çevre hedefleri ve yönetim gözden geçirme süreçleri için yazılım modülleri.",
    icon: ClipboardCheck,
    features: ["Doküman revizyon takibi", "CAPA ve denetim akışları", "Çevre hedefleri ve performans kayıtları"],
    href: "#kalite"
  }
];

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

          <div className="grid flex-1 items-center gap-8 py-10 md:grid-cols-[1.02fr_0.98fr] lg:py-14">
            <div>
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

            <div className="relative hidden md:block">
              <div className="rounded-lg border border-[#d5ebf8]/28 bg-[#edf7ff]/12 p-4 shadow-2xl shadow-[#0f3d5a]/24 backdrop-blur">
                <div className="rounded-md border border-[#bfd4e7] bg-[#edf4fa] p-4 text-[#17324d]">
                  <div className="flex items-center justify-between gap-4 border-b border-[#dbe6f3] pb-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#2f80c9] text-[#edf7ff]">
                        <Layers3 size={20} />
                      </span>
                      <div>
                        <p className="text-sm font-bold">Nodera ürün paneli</p>
                        <p className="text-xs font-semibold text-[#65746b]">Teklif, kurulum, destek ve satış hattı</p>
                      </div>
                    </div>
                    <span className="rounded-md bg-[#dcfce7] px-2.5 py-1 text-xs font-bold text-[#166534]">Canlı</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {platformStats.map((item) => (
                      <div key={item.value} className="rounded-md border border-[#bfd4e7] bg-[#f0f6fb] p-4">
                        <p className="text-lg font-bold">{item.value}</p>
                        <p className="mt-2 text-xs font-semibold leading-5 text-[#65746b]">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-md border border-[#bfd4e7] bg-[#1e4f6f] p-4 text-[#edf7ff]">
                      <p className="text-sm font-bold text-[#a5f3fc]">Satış odakları</p>
                      <div className="mt-4 space-y-3">
                        {["Otel operasyonları", "Endüstriyel kontrol", "ISO süreç takibi"].map((item) => (
                          <div key={item} className="flex items-center gap-2 text-sm font-semibold text-[#e1f2fb]">
                            <CheckCircle2 size={16} className="text-[#22d3ee]" />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-md border border-[#bfd4e7] bg-[#f0f6fb] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold">Kurulum akışı</p>
                        <BarChart3 size={18} className="text-[#2563eb]" />
                      </div>
                      <div className="mt-4 space-y-2">
                        {["Analiz", "Demo", "Özelleştirme", "Teslim"].map((step, index) => (
                          <div key={step} className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#edf2ef] text-xs font-bold">
                              {index + 1}
                            </span>
                            <span className="text-sm font-semibold text-[#34413a]">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="urunler" className="px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase text-[#2563eb]">Pazarlanacak ürün aileleri</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
              Yazılım, donanım ve saha operasyonunu aynı satış çatısı altında topluyoruz.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {mainProducts.map(({ title, eyebrow, text, icon: Icon, features, href }) => (
              <article key={title} className="rounded-lg border border-[#b8cce0] bg-[#edf4fa] p-6 shadow-soft">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-md bg-[#ccefff] text-[#2f80c9]">
                    <Icon size={24} />
                  </span>
                  <span className="rounded-md border border-[#cbd8e6] px-2.5 py-1 text-xs font-bold uppercase text-[#52637a]">
                    {eyebrow}
                  </span>
                </div>
                <h3 className="mt-7 text-2xl font-semibold">{title}</h3>
                <p className="mt-4 leading-7 text-[#4d647a]">{text}</p>
                <div className="mt-6 space-y-3">
                  {features.map((feature) => (
                    <p key={feature} className="flex gap-2 text-sm font-semibold text-[#17324d]">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-[#16a34a]" size={16} />
                      {feature}
                    </p>
                  ))}
                </div>
                <a href={href} className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#2f80c9]">
                  Detaylara git
                  <ArrowRight size={16} />
                </a>
              </article>
            ))}
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
