import Image from "next/image";
import { ArrowUpRight, Crosshair, MonitorDown, Radio, Users } from "lucide-react";
import styles from "./home.module.css";

const gameFacts = [
  { label: "Birinci şahıs FPS", icon: Crosshair },
  { label: "Solo + co-op", icon: Users },
  { label: "Windows prototipi", icon: MonitorDown }
];

export function UndeadHellgradSection() {
  return (
    <section id="undead-hellgrad" className={styles.undeadSection}>
      <Image
        src="/brand/undead-hellgrad/hellgrad-city.jpg"
        alt=""
        fill
        sizes="100vw"
        className={styles.undeadBackdrop}
        unoptimized
      />
      <div className={styles.undeadShade} />
      <div className={styles.undeadEmbers} />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.92fr_1.08fr] lg:items-end lg:px-10 lg:py-28">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d95a43]/40 bg-[#190b09]/70 px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#ffb19f] backdrop-blur-md">
            <Radio size={14} />
            Nodera Games · Oynanabilir prototip
          </div>

          <h2 className="sr-only">Undead Hellgrad</h2>
          <Image
            src="/brand/undead-hellgrad/hellgrad-logo.png"
            alt="Undead Hellgrad"
            width={900}
            height={600}
            className={styles.undeadLogo}
            unoptimized
          />

          <p className="max-w-xl text-2xl font-semibold leading-tight text-white sm:text-3xl">
            Karanlık çöker. Hat burada kurulur.
          </p>
          <p className="mt-5 max-w-xl text-base leading-8 text-[#d4cac4] sm:text-lg">
            Hellgrad meydanında mevzini al, dalgayı kır ve hattı mümkün olduğu kadar uzun süre koru. Tek oyunculu ve
            co-op akışlarını aynı Windows FPS prototipinde buluşturan bağımsız oyun projesi.
          </p>

          <div className="mt-7 flex flex-wrap gap-2">
            {gameFacts.map(({ label, icon: Icon }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-2 text-sm font-semibold text-[#eee6df] backdrop-blur-md"
              >
                <Icon size={15} className="text-[#ed6a50]" />
                {label}
              </span>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="https://noderasoftware.com/undeadhellgrad/"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#e75a43] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#f06b54]"
            >
              Operasyona gir
              <ArrowUpRight size={17} />
            </a>
            <a
              href="https://noderasoftware.com/undeadhellgrad/#download"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              Güncel Windows sürümü
              <MonitorDown size={17} />
            </a>
          </div>
        </div>

        <figure className={styles.undeadProofCard}>
          <div className="relative aspect-video overflow-hidden rounded-[1.15rem]">
            <Image
              src="/brand/undead-hellgrad/shipping-menu.jpg"
              alt="Undead Hellgrad oynanabilir prototip ana menüsü"
              fill
              sizes="(min-width: 1024px) 48vw, 90vw"
              className="object-cover"
              unoptimized
            />
          </div>
          <figcaption className="flex flex-col gap-4 px-1 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ed826d]">Gerçek build görüntüsü</p>
              <p className="mt-2 text-sm font-semibold text-white">Windows Shipping prototipi</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#6f866c]/35 bg-[#344031]/35 px-3 py-2 text-xs font-bold text-[#b7d0b4]">
              <span className="h-2 w-2 rounded-full bg-[#8fbd89] shadow-[0_0_14px_rgba(143,189,137,0.8)]" />
              Geliştirme sürümü
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
