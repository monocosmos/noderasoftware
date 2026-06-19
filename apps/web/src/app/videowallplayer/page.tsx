import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Download,
  Github,
  MonitorPlay,
  Play,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles
} from "lucide-react";

export const metadata: Metadata = {
  title: "VideoWallPlayer | Nodera Software",
  description:
    "VideoWallPlayer, Windows ve Android ekranlarda video wall, kiosk ve tam ekran video oynatma için VLC/libVLC tabanlı Nodera Software uygulamasıdır."
};

const downloads = [
  {
    title: "Windows x64",
    text: "Taşınabilir zip paket. Exe, VLC/libVLC dosyaları, codec altyapısı ve örnek içerik birlikte gelir.",
    href: "/downloads/VideoWallPlayer-Windows-x64.zip",
    file: "VideoWallPlayer-Windows-x64.zip",
    icon: MonitorPlay
  },
  {
    title: "Android APK",
    text: "Android TV, tablet ve medya kutuları için APK paketi. VLC tabanlı oynatma motoru içerir.",
    href: "/downloads/VideoWallPlayer-Android.apk",
    file: "VideoWallPlayer-Android.apk",
    icon: Smartphone
  }
];

const features = [
  "Kenarlıksız ve penceresiz tam ekran oynatma",
  "Liste bitince başa dönme, tek video tekrar ve karışık oynatma",
  "ESC veya F11 ile ekrandan çıkış, Space ile duraklatma",
  "Windows tarafında donanım hızlandırma ve GPU tercih seçenekleri",
  "Android tarafında çoklu video seçimi ve kiosk odaklı kullanım",
  "VLC/libVLC codec desteğiyle geniş format uyumluluğu"
];

export default function VideoWallPlayerPage() {
  return (
    <main className="min-h-screen bg-[#07111f] text-[#edf7ff]">
      <section className="relative isolate overflow-hidden border-b border-[#2dd4bf]/30">
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(to_right,rgba(45,212,191,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(96,165,250,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,rgba(7,17,31,0.98),rgba(18,58,86,0.92)_48%,rgba(16,102,123,0.86))]" />

        <div className="mx-auto flex min-h-[72vh] w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
          <nav className="flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#d5ebf8] hover:text-white">
              <ArrowLeft size={17} />
              Nodera Software
            </Link>
            <a
              href="https://github.com/monocosmos/VideoWallPlayer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[#d5ebf8]/30 px-4 py-2.5 text-sm font-semibold text-[#edf7ff] transition hover:bg-[#edf7ff]/12"
            >
              <Github size={16} />
              GitHub
            </a>
          </nav>

          <div className="grid flex-1 gap-10 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-md border border-[#2dd4bf]/45 bg-[#2dd4bf]/10 px-3 py-2 text-sm font-semibold text-[#a5f3fc]">
                <Sparkles size={16} />
                Video wall ve kiosk oynatma
              </p>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.04] md:text-6xl">
                VideoWallPlayer
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#d5ebf8]">
                Otel lobisi, dijital tabela, showroom ve çoklu ekran kurulumlarında videoları kontrol çubuğu, pencere
                kenarı ve metin olmadan tam ekran oynatmak için hazırlanmış Windows ve Android uygulaması.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/downloads/VideoWallPlayer-Windows-x64.zip"
                  download
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#2dd4bf] px-5 py-3 text-sm font-bold text-[#07111f] transition hover:bg-[#67e8f9]"
                >
                  Windows indir
                  <Download size={17} />
                </a>
                <a
                  href="/downloads/VideoWallPlayer-Android.apk"
                  download
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-[#d5ebf8]/35 px-5 py-3 text-sm font-semibold text-[#edf7ff] transition hover:bg-[#edf7ff]/12"
                >
                  Android APK
                  <Smartphone size={17} />
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-xl border border-[#d5ebf8]/18 bg-[#edf7ff]/8 p-6 shadow-2xl shadow-cyan-950/40 backdrop-blur">
                <Image
                  src="/brand/videowallplayer/brand-model.png"
                  alt="VideoWallPlayer görsel modeli"
                  width={760}
                  height={760}
                  className="mx-auto h-auto max-h-[420px] w-full object-contain"
                  priority
                  unoptimized
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#2dd4bf]/20 bg-[#edf4fa] px-5 py-16 text-[#17324d] sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-bold uppercase text-[#2563eb]">İndirme paketleri</p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight">Windows ve Android için hazır yayın.</h2>
            </div>
            <p className="max-w-xl leading-7 text-[#4d647a]">
              Windows paketi zip olarak gelir; klasörü çıkarıp `VideoWallPlayer.exe` dosyasını çalıştırın. Android tarafında
              APK dosyasını cihaza yükleyebilirsiniz.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {downloads.map(({ title, text, href, file, icon: Icon }) => (
              <a
                key={title}
                href={href}
                download
                className="group rounded-lg border border-[#b8cce0] bg-white p-7 transition hover:-translate-y-0.5 hover:border-[#2dd4bf] hover:shadow-xl hover:shadow-[#2f80c9]/14"
              >
                <div className="flex items-start justify-between gap-4">
                  <Icon className="text-[#2563eb]" size={34} />
                  <span className="inline-flex items-center gap-2 rounded-md bg-[#e1ebf4] px-3 py-2 text-sm font-bold text-[#17324d]">
                    <Download size={16} />
                    İndir
                  </span>
                </div>
                <h3 className="mt-7 text-2xl font-semibold group-hover:text-[#2563eb]">{title}</h3>
                <p className="mt-4 leading-7 text-[#4d647a]">{text}</p>
                <p className="mt-5 break-all rounded-md border border-[#b8cce0] bg-[#edf4fa] px-3 py-2 text-sm font-semibold text-[#52637a]">
                  {file}
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#e7eef6] px-5 py-16 text-[#17324d] sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <p className="text-sm font-bold uppercase text-[#2563eb]">Özellikler</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight">Video başladıktan sonra ekranda sadece içerik kalır.</h2>
            <p className="mt-5 leading-8 text-[#4d647a]">
              Program arayüzü liste ve ayarlar için kullanılır; oynatma modunda mouse imleci ve kontrol elemanları gizlenir.
              Böylece video wall ekranı temiz, kesintisiz ve profesyonel görünür.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature) => (
              <div key={feature} className="rounded-lg border border-[#b8cce0] bg-[#edf4fa] p-5">
                <BadgeCheck className="text-[#16a34a]" size={22} />
                <p className="mt-4 font-semibold leading-7">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#2dd4bf]/20 bg-[#123a56] px-5 py-14 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-bold uppercase text-[#22d3ee]">Kaynak kod</p>
            <h2 className="mt-3 text-3xl font-semibold">Proje herkese açık GitHub deposunda yayınlanır.</h2>
            <p className="mt-4 max-w-2xl leading-7 text-[#d5ebf8]">
              Windows ve Android kaynakları ayrı klasörlerde tutulur; kurulum notları ve wiki sayfaları depo içinde yer alır.
            </p>
          </div>
          <a
            href="https://github.com/monocosmos/VideoWallPlayer"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#2dd4bf] px-5 py-3 text-sm font-bold text-[#07111f] transition hover:bg-[#67e8f9]"
          >
            GitHub deposunu aç
            <Github size={17} />
          </a>
          <div className="md:col-span-2 flex flex-wrap gap-3 text-sm font-semibold text-[#c6e2f2]">
            <span className="inline-flex items-center gap-2">
              <Play size={15} />
              Fullscreen playback
            </span>
            <span className="inline-flex items-center gap-2">
              <Settings2 size={15} />
              Donanım hızlandırma
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={15} />
              Kiosk kullanım
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
