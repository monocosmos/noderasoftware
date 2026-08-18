import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Blocks,
  Building2,
  CircuitBoard,
  ClipboardCheck,
  Cpu,
  ExternalLink,
  Github,
  Globe2,
  Layers3,
  Mail,
  MapPin,
  MonitorCog,
  MonitorPlay,
  ScanSearch,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import styles from "./home.module.css";
import { UndeadHellgradSection } from "./undead-hellgrad-section";

export const metadata: Metadata = {
  title: "Nodera Software | Dijital Ürünler, Oyun ve Mühendislik",
  description:
    "Nodera Software; HotelOps, Undead Hellgrad, VideoWallPlayer, gömülü sistemler, kalite yönetimi ve özel otomasyon çözümleri geliştirir."
};

const brandLogo = "/brand/nodera-logo.png";

const serviceLines: Array<{
  title: string;
  text: string;
  tag: string;
  icon: LucideIcon;
}> = [
  {
    title: "Özel iş uygulamaları",
    text: "Satış, operasyon, stok, servis ve yönetim akışlarını tek merkezde toplayan web ve masaüstü ürünleri.",
    tag: "Web · Desktop",
    icon: MonitorCog
  },
  {
    title: "Gömülü sistemler",
    text: "STM32, ESP32 ve Raspberry Pi üzerinde sensör, haberleşme, kontrol ve saha prototipleme çözümleri.",
    tag: "Firmware · IoT",
    icon: CircuitBoard
  },
  {
    title: "Görüntü işleme",
    text: "Python ve OpenCV ile tespit, ölçüm, geometri işleme ve donanım destekli görüntü analizi.",
    tag: "Python · OpenCV",
    icon: ScanSearch
  },
  {
    title: "Kalite ve otomasyon",
    text: "ISO 9001/14001 süreçlerini, saha verisini ve kurum içi iş akışlarını izlenebilir dijital sistemlere dönüştürme.",
    tag: "QMS · Workflow",
    icon: ClipboardCheck
  }
];

const currentProducts = [
  {
    name: "STM32_KalmanFilter_MPU6050",
    type: "STM32",
    text: "MPU6050 ve Kalman filtre odağında hareket ve ölçüm çözümü.",
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

export default function Home() {
  return (
    <main className={styles.site}>
      <header className={styles.hero}>
        <div className="mx-auto flex min-h-[760px] w-full max-w-7xl flex-col px-5 pb-16 pt-5 sm:px-8 lg:px-10">
          <nav className={`${styles.navShell} flex items-center justify-between gap-4 rounded-2xl px-3 py-3 sm:px-4`}>
            <Link href="/" className="flex min-w-0 items-center gap-3 text-sm font-bold uppercase tracking-[0.08em] text-white">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-lg shadow-black/10">
                <Image src={brandLogo} alt="Nodera Software logosu" width={36} height={36} priority unoptimized />
              </span>
              <span className="hidden truncate sm:block">Nodera Software</span>
            </Link>

            <div className="hidden items-center gap-5 text-sm font-semibold text-[#cbe2ee] xl:flex">
              <a href="#projeler" className="transition hover:text-white">
                Projeler
              </a>
              <a href="#undead-hellgrad" className="transition hover:text-white">
                Undead
              </a>
              <Link href="/hotel/" className="transition hover:text-white">
                HotelOps
              </Link>
              <Link href="/videowallplayer/" className="transition hover:text-white">
                VideoWallPlayer
              </Link>
              <a href="#yetkinlikler" className="transition hover:text-white">
                Yetkinlikler
              </a>
              <a href="#iletisim" className="transition hover:text-white">
                İletişim
              </a>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <a
                href="mailto:info@noderasoftware.com"
                className="hidden items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#12334a] transition hover:-translate-y-0.5 hover:bg-[#dff5f5] sm:inline-flex"
              >
                Projeni konuşalım
                <ArrowUpRight size={16} />
              </a>
            </div>
          </nav>

          <div className="grid flex-1 gap-14 py-16 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:py-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[#8adce2]/25 bg-[#8adce2]/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#a7edf0]">
                <Sparkles size={15} />
                Nodera Product Studio · İstanbul
              </p>
              <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
                Karmaşık fikirleri <span className={styles.heroAccent}>çalışan ürünlere</span> dönüştürüyoruz.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#c4dbe7]">
                Kurumsal operasyon yazılımlarından bağımsız oyunlara, gömülü sistemlerden medya teknolojilerine uzanan
                ürünler tasarlıyor ve geliştiriyoruz.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <a
                  href="#projeler"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#42d6c1] px-5 py-3 text-sm font-bold text-[#092635] transition hover:-translate-y-0.5 hover:bg-[#69e7d5]"
                >
                  Projeleri keşfet
                  <ArrowRight size={17} />
                </a>
                <Link
                  href="/hotel/"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/10"
                >
                  HotelOps demosu
                  <ExternalLink size={17} />
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-[#b6cfdb]">
                <span className="inline-flex items-center gap-2">
                  <Globe2 size={16} className="text-[#68d8dc]" />
                  Web + mobil
                </span>
                <span className="inline-flex items-center gap-2">
                  <Cpu size={16} className="text-[#68d8dc]" />
                  Embedded + IoT
                </span>
                <span className="inline-flex items-center gap-2">
                  <MonitorPlay size={16} className="text-[#68d8dc]" />
                  Oyun + medya
                </span>
              </div>
            </div>

            <div className={`${styles.heroPanel} rounded-[1.75rem] p-4 sm:p-5`}>
              <div className="relative z-10 flex items-center justify-between gap-4 border-b border-white/10 px-1 pb-4">
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-[#7bcdd7]">Nodera / Product system</p>
                  <p className="mt-2 text-sm font-semibold text-white">Aktif ürün hatları</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#77d9cf]/20 bg-[#58d7c5]/10 px-3 py-2 text-xs font-bold text-[#9de7dd]">
                  <span className="h-2 w-2 rounded-full bg-[#54ddca] shadow-[0_0_14px_rgba(84,221,202,0.8)]" />
                  03 aktif
                </span>
              </div>

              <div className="relative z-10 mt-4 space-y-3">
                <Link href="/hotel/" className={`${styles.productLine} flex items-center gap-4 rounded-2xl p-4`}>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#4ed4bf]/15 text-[#69e0cf]">
                    <Building2 size={23} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold uppercase tracking-[0.16em] text-[#78cfd4]">SaaS / Operations</span>
                    <span className="mt-1 block text-lg font-semibold text-white">HotelOps</span>
                  </span>
                  <ArrowUpRight className="text-[#8db4c6]" size={19} />
                </Link>

                <a
                  href="https://noderasoftware.com/undeadhellgrad/"
                  className={`${styles.productLine} flex items-center gap-4 rounded-2xl p-4`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#351716]">
                    <Image
                      src="/brand/undead-hellgrad/hellgrad-skull.png"
                      alt=""
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold uppercase tracking-[0.16em] text-[#e88972]">Game / Prototype</span>
                    <span className="mt-1 block text-lg font-semibold text-white">Undead Hellgrad</span>
                  </span>
                  <ArrowUpRight className="text-[#8db4c6]" size={19} />
                </a>

                <Link href="/videowallplayer/" className={`${styles.productLine} flex items-center gap-4 rounded-2xl p-4`}>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#51bce0]/15 text-[#72d6ef]">
                    <MonitorPlay size={23} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold uppercase tracking-[0.16em] text-[#78cfd4]">Media / Multi-platform</span>
                    <span className="mt-1 block text-lg font-semibold text-white">VideoWallPlayer</span>
                  </span>
                  <ArrowUpRight className="text-[#8db4c6]" size={19} />
                </Link>
              </div>

              <div className="relative z-10 mt-4 grid grid-cols-3 gap-2">
                {[
                  ["Web", "Ürün arayüzü"],
                  ["Native", "Desktop + cihaz"],
                  ["Cloud", "Canlı servis"]
                ].map(([value, label]) => (
                  <div key={value} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                    <p className="text-sm font-bold text-white">{value}</p>
                    <p className="mt-1 text-xs leading-5 text-[#91adbb]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <section id="projeler" className={`${styles.section} border-b px-5 py-20 sm:px-8 sm:py-24 lg:px-10`}>
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="grid gap-7 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div>
              <p className={`${styles.sectionLabel} text-xs font-bold uppercase tracking-[0.22em]`}>Seçili projeler / 01</p>
              <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">
                Farklı sektörler. Aynı ürün disiplini.
              </h2>
            </div>
            <p className={`${styles.mutedText} max-w-2xl text-lg leading-8 lg:justify-self-end`}>
              Her projeyi yalnızca bir ekran olarak değil; kullanıcı akışı, altyapı, dağıtım ve sürdürülebilir operasyonuyla
              birlikte ele alıyoruz.
            </p>
          </div>

          <article className={`${styles.hotelShowcase} mt-12 rounded-[2rem] p-5 sm:p-8 lg:p-10`}>
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#55dbc8]">Hotel operations platform</p>
                <h3 className="mt-5 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Nodera HotelOps</h3>
                <p className="mt-6 max-w-xl text-base leading-8 text-[#c4dbe7] sm:text-lg">
                  Housekeeping, teknik servis, talepler, envanter ve yönetim görünümünü rol bazlı ekranlarla tek operasyon
                  merkezinde toplar.
                </p>

                <div className="mt-7 flex flex-wrap gap-2">
                  {["Departman bazlı takip", "Mobil + masaüstü", "Canlı API", "Yerel veya bulut"].map((item) => (
                    <span key={item} className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-[#d9eaf2]">
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/hotel/"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#43d6c1] px-5 py-3 text-sm font-bold text-[#082635] transition hover:-translate-y-0.5 hover:bg-[#6de9d7]"
                  >
                    HotelOps girişini aç
                    <ExternalLink size={17} />
                  </Link>
                  <Link
                    href="/hotel/hotelpanel/"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    HotelPanel
                    <ArrowRight size={17} />
                  </Link>
                </div>
              </div>

              <div className={styles.hotelScreen}>
                <iframe
                  title="Nodera HotelOps tanıtım deneyimi"
                  src="/animations/hotelops-ad/Nodera%20Reklam%20Web.html"
                  className="pointer-events-none absolute inset-0 h-full w-full border-0 opacity-80"
                  loading="lazy"
                />
                <div className="absolute inset-x-4 bottom-4 z-10 grid grid-cols-3 gap-2">
                  {[
                    ["Housekeeping", "oda akışı"],
                    ["Teknik", "bakım takibi"],
                    ["Yönetim", "rapor görünümü"]
                  ].map(([value, label]) => (
                    <div key={value} className="rounded-xl border border-white/15 bg-[#07131e]/75 p-3 backdrop-blur-md">
                      <p className="text-xs font-bold text-white sm:text-sm">{value}</p>
                      <p className="mt-1 hidden text-xs text-[#9fbdca] sm:block">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <UndeadHellgradSection />

      <section id="videowallplayer" className={`${styles.sectionMuted} border-b border-[var(--site-line)] px-5 py-20 sm:px-8 sm:py-24 lg:px-10`}>
        <div className="relative z-10 mx-auto max-w-7xl">
          <article className={`${styles.videoWallCard} grid gap-8 rounded-[2rem] p-6 sm:p-9 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:p-12`}>
            <div>
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#071522] p-2.5">
                  <Image
                    src="/brand/videowallplayer/brand-logo.png"
                    alt="VideoWallPlayer logosu"
                    width={48}
                    height={48}
                    className="h-full w-full object-contain"
                    unoptimized
                  />
                </span>
                <div>
                  <p className={`${styles.sectionLabel} text-xs font-bold uppercase tracking-[0.2em]`}>Multi-platform media</p>
                  <p className={`${styles.mutedText} mt-1 text-sm font-semibold`}>Windows + Android</p>
                </div>
              </div>

              <h2 className="mt-7 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">VideoWallPlayer</h2>
              <p className={`${styles.mutedText} mt-5 max-w-2xl text-lg leading-8`}>
                Otel, showroom ve video wall ekranlarında kenarlıksız, tam ekran ve kesintisiz oynatma için geliştirilen
                medya deneyimi.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {["Kiosk oynatma", "VLC/libVLC altyapısı", "Loop + karışık mod"].map((item) => (
                  <div key={item} className={`${styles.surfaceCard} rounded-xl p-4`}>
                    <BadgeCheck className="text-[#19a98f]" size={20} />
                    <p className="mt-3 text-sm font-bold leading-6">{item}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/videowallplayer/"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#257fc0] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#1f6fa9]"
                >
                  Detay ve indirme
                  <ArrowUpRight size={17} />
                </Link>
                <a
                  href="https://github.com/monocosmos/VideoWallPlayer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--site-line)] px-5 py-3 text-sm font-semibold transition hover:bg-[var(--site-surface)]"
                >
                  Kaynak kod
                  <Github size={17} />
                </a>
              </div>
            </div>

            <div className="relative flex min-h-[300px] items-center justify-center lg:min-h-[440px]">
              <div className="absolute h-64 w-64 rounded-full bg-[#2cccd3]/15 blur-3xl sm:h-80 sm:w-80" />
              <Image
                src="/brand/videowallplayer/brand-model.png"
                alt="VideoWallPlayer medya ağı görseli"
                width={520}
                height={520}
                className={`${styles.videoWallArt} relative z-10 h-auto w-full max-w-[430px]`}
                unoptimized
              />
            </div>
          </article>
        </div>
      </section>

      <section id="yetkinlikler" className={`${styles.section} border-b px-5 py-20 sm:px-8 sm:py-24 lg:px-10`}>
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div>
              <p className={`${styles.sectionLabel} text-xs font-bold uppercase tracking-[0.22em]`}>Mühendislik yetkinlikleri / 02</p>
              <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">
                Yazılımın ötesinde, uçtan uca ürün geliştirme.
              </h2>
            </div>
            <p className={`${styles.mutedText} max-w-2xl text-lg leading-8 lg:justify-self-end`}>
              Arayüz, iş kuralı, cihaz yazılımı ve dağıtım katmanlarını aynı ürün hedefi etrafında birleştiriyoruz.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {serviceLines.map(({ title, text, tag, icon: Icon }, index) => (
              <article key={title} className={`${styles.capabilityCard} rounded-2xl p-6 sm:p-7`}>
                <div className="flex items-start justify-between gap-5">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2d83be]/10 text-[#2d83be]">
                    <Icon size={25} />
                  </span>
                  <span className={`${styles.mutedText} text-xs font-bold tabular-nums`}>0{index + 1}</span>
                </div>
                <p className={`${styles.sectionLabel} mt-8 text-xs font-bold uppercase tracking-[0.18em]`}>{tag}</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.02em]">{title}</h3>
                <p className={`${styles.mutedText} mt-4 leading-7`}>{text}</p>
              </article>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className={`${styles.surfaceCard} rounded-2xl p-6 sm:p-8`}>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f6c945]/15 text-[#b98508]">
                  <Cpu size={22} />
                </span>
                <div>
                  <p className={`${styles.sectionLabel} text-xs font-bold uppercase tracking-[0.18em]`}>STM32 / ESP32</p>
                  <h3 className="mt-1 text-xl font-semibold">Cihazdan buluta veri hattı</h3>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {["UART · I2C · SPI", "Wi-Fi + IoT", "Sensör füzyonu", "Raspberry Pi"].map((item) => (
                  <span key={item} className="rounded-full border border-[var(--site-line)] px-3 py-2 text-sm font-semibold">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className={`${styles.surfaceCard} rounded-2xl p-6 sm:p-8`}>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2ec79c]/12 text-[#159b79]">
                  <ShieldCheck size={22} />
                </span>
                <div>
                  <p className={`${styles.sectionLabel} text-xs font-bold uppercase tracking-[0.18em]`}>ISO 9001 / 14001</p>
                  <h3 className="mt-1 text-xl font-semibold">İzlenebilir kalite süreçleri</h3>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Doküman + revizyon", "CAPA", "İç tetkik", "Çevre hedefleri"].map((item) => (
                  <span key={item} className="rounded-full border border-[var(--site-line)] px-3 py-2 text-sm font-semibold">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="referanslar" className={`${styles.sectionMuted} px-5 py-20 sm:px-8 sm:py-24 lg:px-10`}>
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className={`${styles.sectionLabel} text-xs font-bold uppercase tracking-[0.22em]`}>Açık kaynak / 03</p>
              <h2 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">
                Deney, kütüphane ve mühendislik arşivi.
              </h2>
            </div>
            <a
              href="https://github.com/spacemonochrome?tab=repositories"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--site-line)] bg-[var(--site-surface)] px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
            >
              Tüm repolar
              <Github size={17} />
            </a>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {currentProducts.map((product) => (
              <a key={product.name} href={product.href} className={`${styles.referenceCard} group rounded-2xl p-6`}>
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2d83be]/10 text-[#2d83be]">
                    <Blocks size={21} />
                  </span>
                  <span className={`${styles.mutedText} rounded-full border border-[var(--site-line)] px-2.5 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em]`}>
                    {product.type}
                  </span>
                </div>
                <h3 className="mt-7 break-words text-xl font-semibold tracking-[-0.02em] transition group-hover:text-[#2d83be]">
                  {product.name}
                </h3>
                <p className={`${styles.mutedText} mt-4 min-h-14 leading-7`}>{product.text}</p>
                <span className={`${styles.sectionLabel} mt-6 inline-flex items-center gap-2 text-sm font-bold`}>
                  İncele
                  <ArrowUpRight size={16} />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="iletisim" className={`${styles.contactSection} px-5 py-20 sm:px-8 sm:py-24 lg:px-10`}>
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#7ee4da]">Birlikte üretelim</p>
              <h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-6xl">
                Bir sonraki ürünü birlikte kuralım.
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#c4dbe7]">
                Yeni ürün, mevcut sistemin modernizasyonu ya da özel mühendislik ihtiyacı için kapsamı birlikte netleştirelim.
              </p>
            </div>
            <a
              href="mailto:info@noderasoftware.com"
              className="inline-flex w-fit items-center justify-center gap-3 rounded-full bg-[#4ad9c4] px-6 py-3.5 text-sm font-bold text-[#082635] transition hover:-translate-y-0.5 hover:bg-[#72ead9]"
            >
              info@noderasoftware.com
              <Mail size={18} />
            </a>
          </div>

          <div className="mt-16 flex flex-col gap-7 border-t border-white/10 pt-8 md:flex-row md:items-center md:justify-between">
            <Link href="/" className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.08em] text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1.5">
                <Image src={brandLogo} alt="" width={32} height={32} unoptimized />
              </span>
              Nodera Software
            </Link>
            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#b8d2df]">
              <span className="inline-flex items-center gap-2">
                <MapPin size={15} />
                İstanbul
              </span>
              <span className="inline-flex items-center gap-2">
                <Layers3 size={15} />
                Web · Mobil · Desktop · Embedded
              </span>
              <Link href="/privacy/" className="inline-flex items-center gap-2 transition hover:text-white">
                <ShieldCheck size={15} />
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
