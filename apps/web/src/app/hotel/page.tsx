import type { Metadata } from "next";
import { HotelSectionPage } from "@/sections/hotel/page";

export const metadata: Metadata = {
  title: "Nodera Sistem | Nodera Software",
  description: "Rol bazli otel operasyon ve yonetim platformu"
};

export default function HotelPage() {
  return <HotelSectionPage />;
}
