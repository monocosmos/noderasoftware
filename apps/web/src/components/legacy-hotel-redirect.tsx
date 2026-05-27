"use client";

import { useEffect } from "react";

export function LegacyHotelRedirect() {
  useEffect(() => {
    const nextUrl = `/hotel${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(nextUrl);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#111316] px-6 text-white">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase text-[#43d9b8]">Nodera Sistem</p>
        <h1 className="mt-3 text-3xl font-semibold">Otel paneli /hotel altına taşındı.</h1>
        <p className="mt-4 text-white/70">Yönlendiriliyorsunuz.</p>
      </div>
    </main>
  );
}
