import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | Nodera HotelOps",
  description: "Nodera HotelOps privacy policy for web and Android users",
  alternates: {
    canonical: "https://noderasoftware.com/privacy/"
  },
  robots: {
    index: true,
    follow: true
  }
};

const updatedAt = "26 June 2026";

const sections = [
  {
    title: "Information We Process",
    items: [
      "Account and login information used to access HotelOps workspaces.",
      "Operational records such as tasks, departments, reminders, reports, notes, room and maintenance records entered by authorized users.",
      "Device and push notification tokens used to deliver HotelOps operational notifications.",
      "Photos, videos or files selected by the user when a HotelOps workflow requires media attachment.",
      "Basic technical logs needed to keep the service reliable and secure."
    ]
  },
  {
    title: "How We Use Information",
    items: [
      "To provide HotelOps web, Android and desktop application features.",
      "To authenticate users and keep authorized sessions active.",
      "To deliver task, shift, update and operational notifications.",
      "To support customer administration, troubleshooting, security and service improvement.",
      "To comply with legal, security and platform requirements."
    ]
  },
  {
    title: "Android Permissions",
    items: [
      "Internet and network access are used to connect to the HotelOps service.",
      "Notifications are used for operational alerts and app update messages.",
      "Camera and media/file access are used only when the user chooses to capture or attach media in the application.",
      "The Android app stores limited session and push registration data on the device to keep the service working between launches."
    ]
  },
  {
    title: "Sharing and Retention",
    items: [
      "HotelOps data is not sold.",
      "Data may be processed by hosting, infrastructure, notification and service providers needed to run the application.",
      "Customer operational data is retained for as long as required to provide the service, support the customer, meet legal obligations or maintain audit records.",
      "Authorized administrators may request export, correction or deletion of eligible data."
    ]
  },
  {
    title: "Security",
    items: [
      "HotelOps uses HTTPS for production service access.",
      "Access is role-based inside the application.",
      "Sensitive operational access should be limited to authorized staff and protected with strong account credentials."
    ]
  }
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#eef4f8] text-[#17324d]">
      <section className="border-b border-[#b8cce0] bg-[#123a56] px-5 py-8 text-[#edf7ff] sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          <nav className="flex items-center justify-between gap-4">
            <Link href="/" className="text-sm font-bold uppercase tracking-normal text-[#edf7ff]">
              Nodera Software
            </Link>
            <Link href="/hotel/" className="rounded-md border border-[#d5ebf8]/35 px-4 py-2 text-sm font-semibold">
              HotelOps
            </Link>
          </nav>

          <div className="max-w-3xl py-8">
            <p className="inline-flex items-center gap-2 rounded-md border border-[#22d3ee]/45 bg-[#22d3ee]/10 px-3 py-2 text-sm font-semibold text-[#a5f3fc]">
              <ShieldCheck size={16} />
              Nodera HotelOps
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">Privacy Policy</h1>
            <p className="mt-5 text-base leading-8 text-[#d5ebf8]">
              This policy explains how Nodera Software processes information for the HotelOps web, Android and desktop
              applications. This page is public and does not require login.
            </p>
            <p className="mt-4 text-base leading-8 text-[#d5ebf8]">
              Bu sayfa Nodera HotelOps web, Android ve masaustu uygulamalari icin gizlilik politikasidir ve oturum
              acmadan goruntulenebilir.
            </p>
            <p className="mt-4 text-sm font-semibold text-[#a5f3fc]">Last updated: {updatedAt}</p>
          </div>
        </div>
      </section>

      <section className="px-5 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-5xl gap-5">
          {sections.map((section) => (
            <article key={section.title} className="rounded-lg border border-[#b8cce0] bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              <ul className="mt-5 grid gap-3 text-sm leading-7 text-[#4d647a]">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#2f80c9]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}

          <article className="rounded-lg border border-[#b8cce0] bg-[#1e4f6f] p-6 text-[#edf7ff]">
            <h2 className="text-2xl font-semibold">Contact</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#d5ebf8]">
              For privacy questions, data requests or support, contact Nodera Software.
            </p>
            <a
              href="mailto:info@noderasoftware.com"
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#2dd4bf] px-4 py-2.5 text-sm font-bold text-[#17324d]"
            >
              info@noderasoftware.com
              <Mail size={16} />
            </a>
          </article>
        </div>
      </section>
    </main>
  );
}
