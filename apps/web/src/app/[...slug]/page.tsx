import type { Metadata } from "next";
import { HotelOpsSystem } from "@/components/hotel-ops-system";
import { LegacyHotelRedirect } from "@/components/legacy-hotel-redirect";

const hotelRoutes = [
  ["hotel"],
  ["hotel", "login"],
  ["hotel", "dashboard"],
  ["hotel", "jobs"],
  ["hotel", "jobs", "new"],
  ["hotel", "jobs", "detail"],
  ["hotel", "maintenance"],
  ["hotel", "housekeeping"],
  ["hotel", "calendar", "department"],
  ["hotel", "calendar", "technical"],
  ["hotel", "calendar", "housekeeping"],
  ["hotel", "reminders"],
  ["hotel", "modules", "inventory"],
  ["hotel", "modules", "rooms"],
  ["hotel", "modules", "lost-found"],
  ["hotel", "modules", "guest-requests"],
  ["hotel", "modules", "requests"],
  ["hotel", "modules", "operation-documents"],
  ["hotel", "modules", "training"],
  ["hotel", "modules", "minibar"],
  ["hotel", "modules", "equipment"],
  ["hotel", "modules", "announcements"],
  ["hotel", "modules", "vip"],
  ["hotel", "reports"],
  ["hotel", "users"],
  ["hotel", "settings"]
];

const legacyHotelRoutes = [
  ["login"],
  ["dashboard"],
  ["jobs"],
  ["jobs", "new"],
  ["jobs", "detail"],
  ["maintenance"],
  ["housekeeping"],
  ["calendar", "department"],
  ["calendar", "technical"],
  ["calendar", "housekeeping"],
  ["reminders"],
  ["modules", "inventory"],
  ["modules", "rooms"],
  ["modules", "lost-found"],
  ["modules", "guest-requests"],
  ["modules", "requests"],
  ["modules", "operation-documents"],
  ["modules", "training"],
  ["modules", "minibar"],
  ["modules", "equipment"],
  ["modules", "announcements"],
  ["modules", "vip"],
  ["reports"],
  ["users"],
  ["settings"]
];

export const dynamicParams = false;

export function generateStaticParams() {
  return [...hotelRoutes, ...legacyHotelRoutes].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;

  if (slug[0] === "hotel") {
    return {
      title: "Nodera Sistem | Nodera Software",
      description: "Rol bazlı otel operasyon ve yönetim platformu"
    };
  }

  return {
    title: "Nodera Sistem | Nodera Software",
    description: "Otel paneli /hotel adresine taşındı"
  };
}

export default async function SlugPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  if (slug[0] !== "hotel") return <LegacyHotelRedirect />;
  return <HotelOpsSystem />;
}

