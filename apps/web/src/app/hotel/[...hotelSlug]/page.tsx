import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HotelSectionPage } from "@/sections/hotel/page";
import { hotelRouteSubSlugs, isKnownHotelRouteSubSlug } from "@/sections/hotel/routes";

export const dynamicParams = false;

export const metadata: Metadata = {
  title: "Nodera Sistem | Nodera Software",
  description: "Rol bazli otel operasyon ve yonetim platformu"
};

export function generateStaticParams() {
  return hotelRouteSubSlugs.map((hotelSlug) => ({ hotelSlug }));
}

export default async function HotelSlugPage({ params }: { params: Promise<{ hotelSlug: string[] }> }) {
  const { hotelSlug } = await params;
  if (!isKnownHotelRouteSubSlug(hotelSlug)) notFound();
  return <HotelSectionPage />;
}
