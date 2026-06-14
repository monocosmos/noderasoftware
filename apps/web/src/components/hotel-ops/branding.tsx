import { useState } from "react";
import Image from "next/image";
import { AlertTriangle } from "lucide-react";
import type { AppUpdateNotice, ShellAppInfo } from "./types";

const BRAND_LOGO_SRC = "/brand/nodera-logo.png";

export function BrandLogo() {
  return <Image className="brand-logo-img" src={BRAND_LOGO_SRC} alt="Nodera Software" width={64} height={64} draggable={false} priority unoptimized />;
}

export function NoderaBrandFooter() {
  return null;
}

export function SidebarShellMeta({
  appUpdateNotice,
  onAppUpdate,
  shellAppInfo
}: {
  appUpdateNotice: AppUpdateNotice | null;
  onAppUpdate: (notice: AppUpdateNotice) => void;
  shellAppInfo: ShellAppInfo | null;
}) {
  const showBrandSite = !shellAppInfo || shellAppInfo.runtime === "desktop";

  return (
    <div className="sidebar-meta">
      {showBrandSite ? <div className="sidebar-brand-site">www.noderasoftware.com</div> : null}
      {shellAppInfo ? (
        <button
          type="button"
          className={`sidebar-app-version ${appUpdateNotice ? "outdated" : ""}`}
          onClick={() => appUpdateNotice && onAppUpdate(appUpdateNotice)}
          disabled={!appUpdateNotice}
        >
          {appUpdateNotice ? <span className="sidebar-app-version-badge">Güncelleme</span> : null}
          <span>{shellAppInfo.label} v{shellAppInfo.version}</span>
        </button>
      ) : null}
    </div>
  );
}

export function AndroidLogo() {
  return (
    <svg className="download-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.7 7.4 6.1 4.7a.7.7 0 0 1 1.2-.7l1.7 2.9a7.1 7.1 0 0 1 6 0L16.7 4a.7.7 0 1 1 1.2.7l-1.6 2.7A6.4 6.4 0 0 1 19 12H5a6.4 6.4 0 0 1 2.7-4.6Z" />
      <path d="M5 13h14v5.2c0 1-.8 1.8-1.8 1.8H6.8c-1 0-1.8-.8-1.8-1.8V13Z" />
      <path d="M3.2 13.5c0-.7.6-1.2 1.2-1.2s1.2.5 1.2 1.2v4.1c0 .7-.6 1.2-1.2 1.2s-1.2-.5-1.2-1.2v-4.1Zm15.2 0c0-.7.6-1.2 1.2-1.2s1.2.5 1.2 1.2v4.1c0 .7-.6 1.2-1.2 1.2s-1.2-.5-1.2-1.2v-4.1ZM8.2 20h2v2.1c0 .7-.4 1.1-1 1.1s-1-.4-1-1.1V20Zm5.6 0h2v2.1c0 .7-.4 1.1-1 1.1s-1-.4-1-1.1V20Z" />
      <circle cx="9" cy="9.8" r=".8" fill="#fff" />
      <circle cx="15" cy="9.8" r=".8" fill="#fff" />
    </svg>
  );
}

export function WindowsLogo() {
  return (
    <svg className="download-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 5.3 11 4.2v7.1H3.5v-6Zm8.6-1.2 8.4-1.2v8.4h-8.4V4.1ZM3.5 12.7H11v7.1l-7.5-1.1v-6Zm8.6 0h8.4v8.4l-8.4-1.2v-7.2Z" />
    </svg>
  );
}

export function AppleLogo() {
  return (
    <svg className="download-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.6 12.4c0-2 1.6-3 1.7-3.1-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.7 0-1.7-.7-2.7-.7-1.4 0-2.7.8-3.4 2.1-1.5 2.6-.4 6.4 1 8.5.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.7.7 2.9.7c1.2 0 2-1 2.7-2.1.8-1.2 1.1-2.3 1.1-2.4 0 0-2.9-1.1-2.9-3.5Z" />
      <path d="M14.6 6.4c.6-.7 1-1.7.9-2.8-.9 0-1.9.6-2.5 1.3-.6.7-1 1.7-.9 2.7.9.1 1.9-.5 2.5-1.2Z" />
    </svg>
  );
}

export function LinuxLogo() {
  return (
    <svg className="download-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.2c-2.1 0-3.5 1.8-3.5 4.5 0 1.2.2 2.2.5 3-.9.9-1.4 2.2-1.4 3.6v2.4l-2 2.1c-.5.5-.5 1.3 0 1.8.5.5 1.3.5 1.8 0l1.3-1.3c.7 1.9 1.9 3.1 3.3 3.1s2.6-1.2 3.3-3.1l1.3 1.3c.5.5 1.3.5 1.8 0 .5-.5.5-1.3 0-1.8l-2-2.1v-2.4c0-1.4-.5-2.7-1.4-3.6.3-.8.5-1.8.5-3 0-2.7-1.4-4.5-3.5-4.5Zm-1.2 5.2c-.4 0-.7-.4-.7-.8s.3-.8.7-.8.7.4.7.8-.3.8-.7.8Zm2.4 0c-.4 0-.7-.4-.7-.8s.3-.8.7-.8.7.4.7.8-.3.8-.7.8Z" />
    </svg>
  );
}

export const appDownloadGroups = [
  {
    id: "windows",
    label: "Windows",
    icon: WindowsLogo,
    items: [
      {
        href: "/downloads/HotelOps-Setup-V1-x64.exe",
        icon: WindowsLogo,
        label: "Windows 64bit",
        meta: "Kurulum",
        download: true
      },
      {
        href: "/downloads/HotelOps-Portable-V1-x64.exe",
        icon: WindowsLogo,
        label: "Portable 64bit",
        meta: "Kurulumsuz",
        download: true
      },
      {
        href: "/downloads/HotelOps-Setup-V1-arm64.exe",
        icon: WindowsLogo,
        label: "Windows ARM64",
        meta: "Kurulum",
        download: true
      },
      {
        href: "/downloads/HotelOps-Portable-V1-arm64.exe",
        icon: WindowsLogo,
        label: "Portable ARM64",
        meta: "Kurulumsuz",
        download: true
      }
    ]
  },
  {
    id: "android",
    label: "Android",
    icon: AndroidLogo,
    items: [
      {
        href: "/downloads/HotelOps-Android-V1.apk",
        icon: AndroidLogo,
        label: "Android APK",
        meta: "Mobil",
        download: true
      },
      {
        href: "",
        icon: AndroidLogo,
        label: "Play Store",
        meta: "Yakında"
      }
    ]
  },
  {
    id: "linux",
    label: "Linux",
    icon: LinuxLogo,
    items: [
      {
        href: "/downloads/HotelOps-Linux-V1-x64.tar.gz",
        icon: LinuxLogo,
        label: "Linux 64bit",
        meta: "tar.gz",
        download: true
      },
      {
        href: "/downloads/HotelOps-Linux-V1-arm64.tar.gz",
        icon: LinuxLogo,
        label: "Linux ARM64",
        meta: "tar.gz",
        download: true
      }
    ]
  },
  {
    id: "apple",
    label: "Apple",
    icon: AppleLogo,
    items: [
      {
        href: "/downloads/HotelOps-Mac-V1-arm64.dmg",
        icon: AppleLogo,
        label: "Mac ARM64",
        meta: "Apple Silicon",
        download: true
      },
      {
        href: "/downloads/HotelOps-Mac-V1-x64.dmg",
        icon: AppleLogo,
        label: "Mac Intel",
        meta: "DMG",
        download: true
      },
      {
        href: "",
        icon: AppleLogo,
        label: "iPhone",
        meta: "Yakında"
      }
    ]
  }
];

export function AppDownloadCards({ className = "app-download-grid" }: { className?: string }) {
  const [activeGroupId, setActiveGroupId] = useState(appDownloadGroups[0].id);
  const activeGroup = appDownloadGroups.find((group) => group.id === activeGroupId) ?? appDownloadGroups[0];

  return (
    <div className={`${className} app-download-panel`}>
      <div className="download-group-tabs" role="tablist" aria-label="Uygulama indirme platformları">
        {appDownloadGroups.map((group) => {
          const Icon = group.icon;
          const active = group.id === activeGroup.id;
          return (
            <button
              key={group.id}
              type="button"
              className={`download-group-tab ${active ? "active" : ""}`}
              onClick={() => setActiveGroupId(group.id)}
              role="tab"
              aria-selected={active}
            >
              <span className="download-card-icon"><Icon /></span>
              <strong>{group.label}</strong>
            </button>
          );
        })}
      </div>
      <div className="download-group-items" role="tabpanel">
      {activeGroup.items.map((item) => {
        const Icon = item.icon;
        const content = (
          <>
            <span className="download-card-icon"><Icon /></span>
            <strong>{item.label}</strong>
            <span>{item.meta}</span>
          </>
        );

        if (!item.href) {
          return (
            <span key={item.label} className="download-card download-card-disabled" aria-disabled="true">
              {content}
            </span>
          );
        }

        return (
          <a key={item.href} className="download-card" href={item.href} download={item.download ? true : undefined}>
            {content}
          </a>
        );
      })}
      </div>
    </div>
  );
}

export function AppUpdateCard({ notice, onUpdate }: { notice: AppUpdateNotice; onUpdate: (notice: AppUpdateNotice) => void }) {
  return (
    <div className="app-update-card" role="status">
      <div className="app-update-icon">
        <AlertTriangle size={23} />
      </div>
      <div className="app-update-copy">
        <span className="app-update-kicker">Güncelleme</span>
        <strong>{notice.title}</strong>
        <span>{notice.message || `${notice.label} uygulaması için yeni güncelleme hazır.`}</span>
      </div>
      <button type="button" className="btn btn-danger app-update-btn" onClick={() => onUpdate(notice)}>
        Güncelle
      </button>
    </div>
  );
}

export function RequiredAppUpdateScreen({ notice, onUpdate }: { notice: AppUpdateNotice; onUpdate: (notice: AppUpdateNotice) => void }) {
  const details = notice.runtime === "android"
    ? "Yeni Android APK ayri paket adiyla kurulur. Kurulumdan sonra yeni Nodera HotelOps uygulamasini acin; eski uygulama cihazda kalirsa calismaz."
    : "Windows uygulamasinin eski surumu artik kullanilamaz. Yeni kurulum dosyasini indirip kurun.";

  return (
    <main className="classic-app maintenance-mode-page">
      <section className="maintenance-mode-panel" role="alert" aria-live="assertive">
        <div className="maintenance-mode-topbar">
          <div className="maintenance-mode-brand">
            <span className="logo-mark logo-mark-image maintenance-mode-logo"><BrandLogo /></span>
            <span>Nodera Sistem</span>
          </div>
          <div className="maintenance-mode-badge">
            <AlertTriangle size={16} />
            Zorunlu guncelleme
          </div>
        </div>
        <div className="maintenance-mode-body">
          <div className="maintenance-mode-icon">
            <AlertTriangle size={34} />
          </div>
          <div>
            <p className="maintenance-mode-eyebrow">Uygulama guncel degil</p>
            <h1>{notice.title}</h1>
            <p className="maintenance-mode-copy">{notice.message}</p>
            <p className="maintenance-mode-copy">{details}</p>
          </div>
        </div>
        <div className="maintenance-mode-status">
          <span>Mevcut: {notice.label} v{notice.currentVersion}</span>
          <span>Gerekli: v{notice.latestVersion}</span>
        </div>
        <button type="button" className="btn btn-danger app-update-btn" onClick={() => onUpdate(notice)}>
          Guncelle
        </button>
      </section>
    </main>
  );
}
