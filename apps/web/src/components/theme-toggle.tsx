"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const storageKey = "nodera.theme";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(storageKey);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = savedTheme ? savedTheme === "dark" : prefersDark;

    document.documentElement.classList.toggle("nodera-dark", shouldUseDark);
    setIsDark(shouldUseDark);
  }, []);

  function toggleTheme() {
    const nextIsDark = !isDark;
    document.documentElement.classList.toggle("nodera-dark", nextIsDark);
    window.localStorage.setItem(storageKey, nextIsDark ? "dark" : "light");
    setIsDark(nextIsDark);
  }

  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Aydınlık" : "Karanlık";

  return (
    <button
      type="button"
      aria-label={`${label} modu aç`}
      title={`${label} modu aç`}
      onClick={toggleTheme}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#d5ebf8]/40 bg-[#edf7ff]/12 px-3 text-sm font-bold text-[#edf7ff] transition hover:bg-[#edf7ff]/22"
    >
      <Icon size={17} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
