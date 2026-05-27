"use client";

import { create } from "zustand";
import type { DepartmentId, RoleId } from "@/lib/rbac";
import type { Language } from "@/lib/hotel-data";

type Theme = "light" | "dark";

type PlatformState = {
  roleId: RoleId;
  activeModule: DepartmentId | "all";
  language: Language;
  theme: Theme;
  query: string;
  calendarView: "Günlük" | "Haftalık" | "Aylık" | "Timeline";
  setRole: (roleId: RoleId, activeModule: DepartmentId | "all") => void;
  setActiveModule: (module: DepartmentId | "all") => void;
  setLanguage: (language: Language) => void;
  toggleTheme: () => void;
  setQuery: (query: string) => void;
  setCalendarView: (view: PlatformState["calendarView"]) => void;
};

export const usePlatformStore = create<PlatformState>((set) => ({
  roleId: "generalManager",
  activeModule: "all",
  language: "tr",
  theme: "light",
  query: "",
  calendarView: "Haftalık",
  setRole: (roleId, activeModule) => set({ roleId, activeModule }),
  setActiveModule: (activeModule) => set({ activeModule }),
  setLanguage: (language) => set({ language }),
  toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
  setQuery: (query) => set({ query }),
  setCalendarView: (calendarView) => set({ calendarView })
}));
