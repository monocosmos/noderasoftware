import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  CircuitBoard,
  Code2,
  Cpu,
  ExternalLink,
  Github,
  Globe2,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  ScanSearch,
  TerminalSquare
} from "lucide-react";

export const metadata: Metadata = {
  title: "Hasan Fırat Keskin | spacemonochrome",
  description:
    "Elektrik-elektronik, embedded yazılım, elektronik kart tasarımı, Python görüntü işleme ve modern web arayüzleri üzerine kişisel portfolyo."
};

const avatarUrl = "https://avatars.githubusercontent.com/u/52783312?v=4";

const profileStats = [
  { value: "16", label: "public repo" },
  { value: "C / C#", label: "embedded + desktop" },
  { value: "TR", label: "İstanbul" }
];

const focusAreas: Array<{ title: string; text: string; icon: LucideIcon }> = [
  {
    title: "Embedded yazılım",
    text: "STM32, ESP32, PIC ve Raspberry Pi çevresinde sensör, haberleşme ve kontrol odaklı yazılım denemeleri.",
    icon: Cpu
  },
  {
    title: "Elektronik tasarım",
    text: "Altium Designer ile kart kütüphaneleri, eğitim kitleri ve mikrodenetleyici tabanlı donanım arşivleri.",
    icon: CircuitBoard
  },
  {
    title: "Görüntü işleme",
    text: "Python ve OpenCV ile tespit, ölçüm, geometri işleme ve Raspberry Pi destekli prototipler.",
    icon: ScanSearch
  },
  {
    title: "Arayüz ve otomasyon",
    text: "C#, web panelleri, kontrol ekranları ve gerçek operasyonlarda çalışacak yardımcı yazılım araçları.",
    icon: Code2
  }
];

const repositories = [
  {
    name: "STM32_KalmanFilter_MPU6050",
    text: "MPU6050 ve Kalman filtre odağında STM32 tabanlı hareket/ölçüm çalışması.",
    tech: "C",
    href: "https://github.com/spacemonochrome/STM32_KalmanFilter_MPU6050"
  },
  {
    name: "demedukit_kod_arsiv",
    text: "Demedukit eğitim kiti için ESP32 ve STM32 kod arşivi.",
    tech: "C",
    href: "https://github.com/spacemonochrome/demedukit_kod_arsiv"
  },
  {
    name: "hfk-altium-library",
    text: "Altium için elektronik çalışma kütüphanesi; circuit, electronics ve library başlıklarıyla.",
    tech: "Altium",
    href: "https://github.com/spacemonochrome/hfk-altium-library"
  },
  {
    name: "STM32_Series",
    text: "STM32 işlemcileri için hazırlanmış örnek kod arşivi.",
    tech: "C",
    href: "https://github.com/spacemonochrome/STM32_Series"
  },
  {
    name: "circle_detect_code",
    text: "OpenCV ile çember tespiti yapan Python kodu ve görüntü işleme denemesi.",
    tech: "Python",
    href: "https://github.com/spacemonochrome/circle_detect_code"
  },
  {
    name: "csharp_fuzzy_logic_example",
    text: "Sera otomasyonu örneği üzerinden Mamdani çıkarım mekanizmalı bulanık mantık uygulaması.",
    tech: "C#",
    href: "https://github.com/spacemonochrome/csharp_fuzzy_logic_example"
  }
];

const socials = [
  { label: "GitHub", href: "https://github.com/spacemonochrome", icon: Github },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/hasanfiratkeskin", icon: Linkedin },
  { label: "Instagram", href: "https://www.instagram.com/hasanfiratkeskin", icon: Instagram },
  { label: "Web", href: "http://spacemonochrome.tech/", icon: Globe2 }
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4f5f2] text-[#111412]">
      <section className="relative isolate min-h-[86vh] overflow-hidden bg-[#0e100f] text-white">
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(115deg,rgba(14,16,15,0.98)_0%,rgba(14,16,15,0.88)_47%,rgba(14,16,15,0.42)_100%)]" />
        <Image
          src={avatarUrl}
          alt="Hasan Fırat Keskin GitHub profil fotoğrafı"
          width={760}
          height={760}
          priority
          unoptimized
          className="absolute bottom-0 right-0 -z-10 h-[78vh] max-h-[760px] w-auto translate-x-[18%] object-cover opacity-28 grayscale lg:translate-x-0 lg:opacity-42"
        />

        <div className="mx-auto flex min-h-[86vh] w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
          <nav className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3 text-sm font-bold uppercase tracking-normal text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-white/16 bg-white text-[#0e100f]">
                HF
              </span>
              spacemonochrome
            </Link>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/spacemonochrome"
                className="inline-flex items-center gap-2 rounded-md border border-white/16 px-4 py-2 text-sm font-semibold text-white/84 transition hover:bg-white/10"
              >
                <Github size={16} />
                GitHub
              </a>
              <a
                href="mailto:info@noderasoftware.com"
                className="hidden items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-[#0e100f] transition hover:bg-[#e8ece8] sm:inline-flex"
              >
                <Mail size={16} />
                İletişim
              </a>
            </div>
          </nav>

          <div className="flex flex-1 items-center py-14">
            <div className="max-w-3xl">
              <p className="mb-5 inline-flex items-center gap-2 rounded-md border border-[#4fd1b5]/35 bg-[#4fd1b5]/12 px-3 py-2 text-sm font-semibold text-[#9df5df]">
                <TerminalSquare size={16} />
                GitHub: @spacemonochrome
              </p>
              <h1 className="text-5xl font-semibold leading-[1.04] sm:text-6xl lg:text-7xl">Hasan Fırat Keskin</h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/76">
                Elektrik-elektronik mühendisliği kökenli; embedded yazılım, elektronik kart tasarımı, C# arayüzler,
                Python görüntü işleme ve web tabanlı yönetim panelleri arasında çalışan bir geliştiriciyim.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3 text-sm font-semibold text-white/72">
                <span className="inline-flex items-center gap-2 rounded-md border border-white/14 bg-white/8 px-3 py-2">
                  <MapPin size={16} />
                  İstanbul
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-white/14 bg-white/8 px-3 py-2">
                  <BadgeCheck size={16} />
                  Nodera
                </span>
                <span className="inline-flex items-center gap-2 rounded-md border border-white/14 bg-white/8 px-3 py-2">
                  <Cpu size={16} />
                  Electrical-Electronics
                </span>
              </div>
              <div className="mt-9 flex flex-wrap gap-3">
                <a
                  href="https://github.com/spacemonochrome"
                  className="inline-flex items-center gap-2 rounded-md bg-[#4fd1b5] px-5 py-3 text-sm font-bold text-[#07110e] transition hover:bg-[#7be7d2]"
                >
                  GitHub profilini aç
                  <ArrowRight size={17} />
                </a>
                <a
                  href="#projeler"
                  className="inline-flex items-center gap-2 rounded-md border border-white/18 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Projelere bak
                  <ExternalLink size={17} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#d9ded8] bg-[#f4f5f2] px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-3">
          {profileStats.map((item) => (
            <div key={item.label} className="rounded-lg border border-[#d9ded8] bg-white p-5">
              <p className="text-3xl font-semibold">{item.value}</p>
              <p className="mt-2 text-sm font-semibold uppercase text-[#68736b]">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.66fr_1.34fr]">
            <div>
              <p className="text-sm font-bold uppercase text-[#0e8f7e]">Odak alanları</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight">Donanım, yazılım ve arayüz tarafını aynı masada birleştiren işler.</h2>
              <p className="mt-5 leading-8 text-[#5b665e]">
                Mikrodenetleyici, elektronik eğitim kitleri, Altium kütüphanesi, görüntü işleme ve masaüstü/web arayüz
                üretimi üzerine çalışmalar.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-lg border border-[#d9ded8] bg-[#d9ded8] md:grid-cols-2">
              {focusAreas.map(({ title, text, icon: Icon }) => (
                <article key={title} className="bg-white p-7">
                  <Icon className="mb-8 text-[#0e8f7e]" size={30} />
                  <h3 className="text-xl font-semibold">{title}</h3>
                  <p className="mt-4 leading-7 text-[#5b665e]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="projeler" className="border-y border-[#d9ded8] bg-white px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-bold uppercase text-[#0e8f7e]">GitHub referansları</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight">Öne çıkan açık repo seçkisi.</h2>
            </div>
            <a
              href="https://github.com/spacemonochrome?tab=repositories"
              className="inline-flex items-center gap-2 rounded-md border border-[#cdd5ce] px-4 py-3 text-sm font-semibold text-[#17201a] transition hover:bg-[#f4f5f2]"
            >
              Tüm repolar
              <ExternalLink size={16} />
            </a>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {repositories.map((repo) => (
              <a
                key={repo.name}
                href={repo.href}
                className="group rounded-lg border border-[#d9ded8] bg-[#fbfcfa] p-6 transition hover:-translate-y-0.5 hover:border-[#8fb9ad] hover:shadow-xl hover:shadow-[#1d2a24]/8"
              >
                <div className="flex items-start justify-between gap-4">
                  <Github className="text-[#0e8f7e]" size={24} />
                  <span className="rounded-md border border-[#d9ded8] bg-white px-2 py-1 text-xs font-bold text-[#52605a]">{repo.tech}</span>
                </div>
                <h3 className="mt-6 text-xl font-semibold group-hover:text-[#0e8f7e]">{repo.name}</h3>
                <p className="mt-4 min-h-20 leading-7 text-[#5b665e]">{repo.text}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#0e8f7e]">
                  Repoyu incele
                  <ArrowRight size={16} />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-bold uppercase text-[#0e8f7e]">Bağlantılar</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight">Sosyal profiller ve çalışma hesapları.</h2>
            </div>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {socials.map(({ label, href, icon: Icon }) => (
              <a key={label} href={href} className="rounded-lg border border-[#d9ded8] bg-white p-6 transition hover:border-[#8fb9ad] hover:bg-[#fbfcfa]">
                <Icon className="text-[#0e8f7e]" size={28} />
                <p className="mt-8 text-2xl font-semibold">{label}</p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#5b665e]">
                  Bağlantıyı aç
                  <ExternalLink size={15} />
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#d9ded8] bg-white px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-bold uppercase text-[#0e8f7e]">İletişim</p>
            <h2 className="mt-3 text-3xl font-semibold">İletişim için aşağıdaki kanallardan ulaşabilirsin.</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="mailto:info@noderasoftware.com"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#111412] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2a302c]"
            >
              info@noderasoftware.com
              <Mail size={17} />
            </a>
            <a
              href="https://github.com/spacemonochrome"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[#cdd5ce] px-5 py-3 text-sm font-semibold text-[#17201a] transition hover:bg-[#f4f5f2]"
            >
              @spacemonochrome
              <Github size={17} />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
