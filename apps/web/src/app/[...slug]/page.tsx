import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HotelOpsSystem } from "@/components/hotel-ops-system";
import { LegacyHotelRedirect } from "@/components/legacy-hotel-redirect";
import {
  hotelRouteSlugs,
  isKnownHotelRouteSlug,
  isKnownLegacyHotelRouteSlug,
  legacyHotelRouteSlugs
} from "@/lib/hotel-routes";

export const dynamicParams = false;

export function generateStaticParams() {
  return [...hotelRouteSlugs, ...legacyHotelRouteSlugs].map((slug) => ({ slug }));
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
  if (slug[0] !== "hotel") {
    if (!isKnownLegacyHotelRouteSlug(slug)) notFound();
    return <LegacyHotelRedirect />;
  }

  if (!isKnownHotelRouteSlug(slug)) notFound();
  return <HotelOpsSystem />;
}
