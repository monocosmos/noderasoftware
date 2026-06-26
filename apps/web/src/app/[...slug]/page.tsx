import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegacyHotelRedirect } from "@/components/legacy-hotel-redirect";
import { isKnownLegacyHotelRouteSlug, legacyHotelRouteSlugs } from "@/sections/hotel/routes";

export const dynamicParams = false;

export function generateStaticParams() {
  return legacyHotelRouteSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  await params;

  return {
    title: "Nodera Sistem | Nodera Software",
    description: "Otel paneli /hotel adresine tasindi"
  };
}

export default async function SlugPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  if (!isKnownLegacyHotelRouteSlug(slug)) notFound();
  return <LegacyHotelRedirect />;
}
