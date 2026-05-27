"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Globe2,
  History,
  LayoutDashboard,
  ListChecks,
  Menu,
  MessageSquareText,
  Moon,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UploadCloud,
  UserRound,
  X,
  type LucideIcon
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  calendarEvents,
  departmentKpis,
  formBlueprints,
  funnelData,
  modules,
  notifications,
  occupancyData,
  roleDemoUsers,
  workloadData,
  workflowSteps,
  workItems
} from "@/lib/hotel-data";
import type { CalendarEvent, Language, ModuleDefinition, WorkItem } from "@/lib/hotel-data";
import { canViewDepartment, departments, getRole, hasPermission, roles, type DepartmentId } from "@/lib/rbac";
import { cn, formatCurrency } from "@/lib/utils";
import { usePlatformStore } from "@/store/platform-store";
import { Badge, Button, Card, Field, ProgressBar, Select, TextInput } from "./ui";

const labels = {
  tr: {
    product: "HotelOps Enterprise",
    search: "Modül, görev, oda veya personel ara",
    command: "Operasyon Merkezi",
    dashboard: "Dashboard",
    calendar: "Takvim",
    workflow: "Workflow",
    modules: "Modüller",
    permissions: "Yetki Matrisi",
    newRecord: "Yeni Kayıt",
    exportPdf: "PDF",
    exportExcel: "Excel",
    filters: "Filtreler",
    live: "Canlı",
    notificationCenter: "Bildirimler",
    role: "Rol",
    language: "Dil",
    dark: "Tema",
    overview: "Genel Bakış",
    list: "Liste",
    detail: "Detay",
    create: "Veri Girişi",
    edit: "Düzenleme",
    status: "Durum",
    owner: "Sorumlu",
    priority: "Öncelik",
    due: "Saat",
    sla: "SLA",
    activity: "Aktivite Logları",
    comments: "Yorumlar",
    files: "Dosyalar",
    audit: "Audit",
    allCalendars: "Tüm Departman Takvimleri",
    departmentCalendar: "Departman Takvimi",
    dropzone: "Dosya veya fotoğraf sürükle bırak",
    gmScope: "Genel Müdür tüm operasyonları görüntüler; iş emri oluşturma ve veri silme kapalıdır.",
    scope: "Bu rol sadece kendi departman kapsamındaki kayıtları görür.",
    revenue: "Günlük Gelir",
    occupancy: "Oda Dağılımı",
    funnel: "İş Emri Funnel",
    workload: "Yoğunluk Analizi"
  },
  en: {
    product: "HotelOps Enterprise",
    search: "Search module, task, room or employee",
    command: "Operations Center",
    dashboard: "Dashboard",
    calendar: "Calendar",
    workflow: "Workflow",
    modules: "Modules",
    permissions: "Permission Matrix",
    newRecord: "New Record",
    exportPdf: "PDF",
    exportExcel: "Excel",
    filters: "Filters",
    live: "Live",
    notificationCenter: "Notifications",
    role: "Role",
    language: "Language",
    dark: "Theme",
    overview: "Overview",
    list: "List",
    detail: "Detail",
    create: "Data Entry",
    edit: "Edit",
    status: "Status",
    owner: "Owner",
    priority: "Priority",
    due: "Time",
    sla: "SLA",
    activity: "Activity Logs",
    comments: "Comments",
    files: "Files",
    audit: "Audit",
    allCalendars: "All Department Calendars",
    departmentCalendar: "Department Calendar",
    dropzone: "Drag and drop files or photos",
    gmScope: "General Manager can view all operations; work order creation and deletion are disabled.",
    scope: "This role can only see records within its own department scope.",
    revenue: "Daily Revenue",
    occupancy: "Room Mix",
    funnel: "Work Order Funnel",
    workload: "Workload Analysis"
  }
} satisfies Record<Language, Record<string, string>>;

const revenueData = [
  { label: "08:00", value: 420000 },
  { label: "10:00", value: 760000 },
  { label: "12:00", value: 980000 },
  { label: "14:00", value: 1280000 },
  { label: "16:00", value: 1460000 },
  { label: "18:00", value: 1730000 },
  { label: "20:00", value: 1910000 }
];

function text(language: Language, tr: string, en: string) {
  return language === "tr" ? tr : en;
}

function departmentLabel(language: Language, departmentId: DepartmentId) {
  const department = departments[departmentId];
  return text(language, department.labelTR, department.labelEN);
}

function moduleLabel(language: Language, module: ModuleDefinition) {
  return text(language, module.titleTR, module.titleEN);
}

function moduleDescription(language: Language, module: ModuleDefinition) {
  return text(language, module.descriptionTR, module.descriptionEN);
}

function priorityTone(priority: WorkItem["priority"]) {
  if (priority === "Kritik") return "rose";
  if (priority === "Yüksek") return "amber";
  return "blue";
}

export function HotelOpsApp() {
  const {
    activeModule,
    calendarView,
    language,
    query,
    roleId,
    setActiveModule,
    setCalendarView,
    setLanguage,
    setQuery,
    setRole,
    theme,
    toggleTheme
  } = usePlatformStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState(workItems[0].id);
  const dictionary = labels[language];
  const role = getRole(roleId);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const visibleModules = useMemo(() => {
    return modules.filter((module) => {
      if (module.id === "all") {
        return hasPermission(roleId, "system.view_all");
      }
      return canViewDepartment(roleId, module.id);
    });
  }, [roleId]);

  const visibleDepartments = useMemo(() => {
    if (activeModule === "all") {
      return role.visibleDepartments;
    }
    return [activeModule];
  }, [activeModule, role.visibleDepartments]);

  const scopedWorkItems = useMemo(() => {
    return workItems.filter((item) => visibleDepartments.includes(item.department));
  }, [visibleDepartments]);

  const searchedWorkItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    if (!normalized) return scopedWorkItems;
    return scopedWorkItems.filter((item) => {
      const title = text(language, item.titleTR, item.titleEN).toLocaleLowerCase("tr-TR");
      return title.includes(normalized) || item.id.toLocaleLowerCase("tr-TR").includes(normalized);
    });
  }, [language, query, scopedWorkItems]);

  const scopedCalendar = useMemo(() => {
    return calendarEvents.filter((event) => visibleDepartments.includes(event.department));
  }, [visibleDepartments]);

  const scopedNotifications = useMemo(() => {
    return notifications.filter((notification) => visibleDepartments.includes(notification.department));
  }, [visibleDepartments]);

  const activeModuleDefinition = useMemo(() => {
    return modules.find((module) => module.id === activeModule) ?? visibleModules[0] ?? modules[0];
  }, [activeModule, visibleModules]);

  const activeKpis = activeModule === "all" ? departmentKpis.executive : departmentKpis[activeModule];

  function handleRoleChange(nextRoleId: string) {
    const nextRole = getRole(nextRoleId as typeof roleId);
    const nextModule = nextRole.id === "generalManager" ? "all" : nextRole.department;
    setRole(nextRole.id, nextModule);
    setSidebarOpen(false);
  }

  function handleModuleSelect(moduleId: DepartmentId | "all") {
    setActiveModule(moduleId);
    setSidebarOpen(false);
  }

  return (
    <main className="min-h-screen soft-grid">
      <div className="flex min-h-screen">
        <Sidebar
          activeModule={activeModule}
          dictionary={dictionary}
          language={language}
          modules={visibleModules}
          onSelect={handleModuleSelect}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            dictionary={dictionary}
            language={language}
            notificationCount={scopedNotifications.length}
            onLanguageChange={setLanguage}
            onMenu={() => setSidebarOpen(true)}
            onQueryChange={setQuery}
            onRoleChange={handleRoleChange}
            onThemeToggle={toggleTheme}
            query={query}
            roleId={roleId}
            theme={theme}
          />

          <div className="mx-auto grid w-full max-w-[1520px] gap-5 px-4 py-5 sm:px-6 lg:px-8">
            <HeroStrip
              activeModule={activeModuleDefinition}
              dictionary={dictionary}
              language={language}
              roleId={roleId}
            />

            <KpiGrid kpis={activeKpis} language={language} />

            <section className="grid gap-5 xl:grid-cols-[1.45fr_0.9fr]">
              <AnalyticsBoard dictionary={dictionary} language={language} />
              <NotificationCenter
                dictionary={dictionary}
                events={scopedNotifications}
                language={language}
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <WorkflowTimeline dictionary={dictionary} language={language} />
              <CalendarBoard
                dictionary={dictionary}
                events={scopedCalendar}
                language={language}
                view={calendarView}
                onViewChange={setCalendarView}
              />
            </section>

            <ModuleWorkspace
              activeRecord={activeRecord}
              dictionary={dictionary}
              language={language}
              module={activeModuleDefinition}
              onActiveRecordChange={setActiveRecord}
              roleId={roleId}
              workItems={searchedWorkItems}
            />

            <PermissionMatrix dictionary={dictionary} language={language} roleId={roleId} />
          </div>
        </div>
      </div>
    </main>
  );
}

function Sidebar({
  activeModule,
  dictionary,
  language,
  modules,
  onClose,
  onSelect,
  open
}: {
  activeModule: DepartmentId | "all";
  dictionary: typeof labels.tr;
  language: Language;
  modules: ModuleDefinition[];
  onClose: () => void;
  onSelect: (moduleId: DepartmentId | "all") => void;
  open: boolean;
}) {
  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[292px] flex-col border-r border-border bg-surface/95 px-4 py-5 shadow-glass backdrop-blur-xl transition lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground shadow-soft">
              <HotelIcon />
            </div>
            <div>
              <p className="text-sm font-semibold">{dictionary.product}</p>
              <p className="text-xs text-muted-foreground">Enterprise ERP</p>
            </div>
          </div>
          <Button className="lg:hidden" size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="grid gap-2">
          <p className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {dictionary.modules}
          </p>
          {modules.map((module) => {
            const Icon = module.icon;
            const selected = activeModule === module.id;
            return (
              <button
                key={module.id}
                className={cn(
                  "group flex min-h-[56px] items-center gap-3 rounded-lg border px-3 text-left transition",
                  selected
                    ? "border-primary/30 bg-primary/10 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground"
                )}
                onClick={() => onSelect(module.id)}
              >
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-md bg-gradient-to-br text-white", module.color)}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{moduleLabel(language, module)}</span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">{moduleDescription(language, module)}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-lg border border-border bg-muted/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            RBAC
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {dictionary.scope}
          </p>
        </div>
      </aside>
      {open && <button className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={onClose} aria-label="Overlay" />}
    </>
  );
}

function TopBar({
  dictionary,
  language,
  notificationCount,
  onLanguageChange,
  onMenu,
  onQueryChange,
  onRoleChange,
  onThemeToggle,
  query,
  roleId,
  theme
}: {
  dictionary: typeof labels.tr;
  language: Language;
  notificationCount: number;
  onLanguageChange: (language: Language) => void;
  onMenu: () => void;
  onQueryChange: (query: string) => void;
  onRoleChange: (roleId: string) => void;
  onThemeToggle: () => void;
  query: string;
  roleId: string;
  theme: "light" | "dark";
}) {
  const role = getRole(roleId as typeof roles[number]["id"]);
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/78 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1520px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button className="lg:hidden" size="icon" variant="secondary" onClick={onMenu} aria-label="Menu">
          <Menu className="h-5 w-5" />
        </Button>

        <div className="relative hidden min-w-0 flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-md border border-border bg-surface px-10 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder={dictionary.search}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button size="icon" variant="secondary" aria-label={dictionary.notificationCenter}>
            <span className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                {notificationCount}
              </span>
            </span>
          </Button>

          <Button size="icon" variant="secondary" onClick={() => onLanguageChange(language === "tr" ? "en" : "tr")} aria-label={dictionary.language}>
            <Globe2 className="h-5 w-5" />
          </Button>

          <Button size="icon" variant="secondary" onClick={onThemeToggle} aria-label={dictionary.dark}>
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>

          <div className="hidden items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 shadow-soft sm:flex">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-muted">
              <UserRound className="h-4 w-4" />
            </div>
            <div className="hidden lg:block">
              <p className="text-xs font-semibold">{roleDemoUsers[role.id]}</p>
              <p className="text-[11px] text-muted-foreground">{text(language, role.labelTR, role.labelEN)}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>

          <Select value={roleId} onChange={(event) => onRoleChange(event.target.value)} aria-label={dictionary.role}>
            {roles.map((roleOption) => (
              <option key={roleOption.id} value={roleOption.id}>
                {text(language, roleOption.labelTR, roleOption.labelEN)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="border-t border-border px-4 py-3 md:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-md border border-border bg-surface px-10 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder={dictionary.search}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
      </div>
    </header>
  );
}

function HeroStrip({
  activeModule,
  dictionary,
  language,
  roleId
}: {
  activeModule: ModuleDefinition;
  dictionary: typeof labels.tr;
  language: Language;
  roleId: string;
}) {
  const role = getRole(roleId as typeof roles[number]["id"]);
  const Icon = activeModule.icon;
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-soft">
      <div className="grid gap-4 p-5 lg:grid-cols-[1.1fr_0.9fr] lg:p-6">
        <div className="flex min-w-0 gap-4">
          <div className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white shadow-soft", activeModule.color)}>
            <Icon className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={role.id === "generalManager" ? "green" : "blue"}>
                {text(language, role.labelTR, role.labelEN)}
              </Badge>
              <Badge tone="neutral">{dictionary.live}</Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
              {moduleLabel(language, activeModule)}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {moduleDescription(language, activeModule)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Audit", value: "99.8%", icon: History },
            { label: "2FA", value: "Aktif", icon: ShieldCheck },
            { label: "Realtime", value: "Socket.io", icon: Activity }
          ].map((item) => {
            const ItemIcon = item.icon;
            return (
              <div key={item.label} className="rounded-lg border border-border bg-background/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <ItemIcon className="h-4 w-4 text-primary" />
                  <span className="h-2 w-2 rounded-full bg-success" />
                </div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-sm font-semibold">{item.value}</p>
              </div>
            );
          })}
        </div>
      </div>
      <div className="border-t border-border bg-muted/45 px-5 py-3 text-xs text-muted-foreground lg:px-6">
        {role.id === "generalManager" ? dictionary.gmScope : dictionary.scope}
      </div>
    </section>
  );
}

function KpiGrid({ kpis, language }: { kpis: typeof departmentKpis.executive; language: Language }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card key={kpi.labelTR} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{text(language, kpi.labelTR, kpi.labelEN)}</p>
                <p className="mt-2 text-3xl font-semibold tracking-normal">{kpi.value}</p>
              </div>
              <span
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-lg",
                  kpi.tone === "orange" && "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
                  kpi.tone === "green" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                  kpi.tone === "violet" && "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
                  kpi.tone === "sky" && "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
                  kpi.tone === "amber" && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                  kpi.tone === "rose" && "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
                  kpi.tone === "teal" && "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
                  kpi.tone === "cyan" && "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
                  kpi.tone === "slate" && "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <ProgressBar value={Number.parseFloat(kpi.value) || 72} />
              <span className="ml-4 text-xs font-semibold text-success">{kpi.trend}</span>
            </div>
          </Card>
        );
      })}
    </section>
  );
}

function AnalyticsBoard({ dictionary, language }: { dictionary: typeof labels.tr; language: Language }) {
  return (
    <Card className="p-4 lg:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{dictionary.overview}</p>
          <p className="text-xs text-muted-foreground">{dictionary.workload}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary">
            <Download className="h-4 w-4" />
            {dictionary.exportPdf}
          </Button>
          <Button size="sm" variant="secondary">
            <FileSpreadsheet className="h-4 w-4" />
            {dictionary.exportExcel}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="min-h-[280px] rounded-lg border border-border bg-background/65 p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-muted-foreground">{dictionary.revenue}</p>
            <p className="text-sm font-semibold">{formatCurrency(1910000)}</p>
          </div>
          <ResponsiveContainer width="100%" height={232}>
            <AreaChart data={revenueData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity={0.34} />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "currentColor" }} />
              <YAxis hide />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Area type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={3} fill="url(#revenueGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="min-h-[132px] rounded-lg border border-border bg-background/65 p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{dictionary.occupancy}</p>
            <ResponsiveContainer width="100%" height={112}>
              <PieChart>
                <Pie data={occupancyData} innerRadius={34} outerRadius={52} dataKey="value" paddingAngle={4}>
                  {occupancyData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="min-h-[132px] rounded-lg border border-border bg-background/65 p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{dictionary.funnel}</p>
            <ResponsiveContainer width="100%" height={112}>
              <FunnelChart>
                <Tooltip />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="right" fill="currentColor" stroke="none" dataKey="name" fontSize={11} />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 min-h-[220px] rounded-lg border border-border bg-background/65 p-3">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">{text(language, "Departman Yoğunluğu", "Department Load")}</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={workloadData} margin={{ left: -20, right: 10, top: 12, bottom: 0 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "currentColor" }} />
            <YAxis hide />
            <Tooltip />
            <Bar dataKey="technical" stackId="a" fill="#f97316" radius={[0, 0, 4, 4]} />
            <Bar dataKey="hk" stackId="a" fill="#22c55e" />
            <Bar dataKey="front" stackId="a" fill="#8b5cf6" />
            <Bar dataKey="security" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function NotificationCenter({
  dictionary,
  events,
  language
}: {
  dictionary: typeof labels.tr;
  events: typeof notifications;
  language: Language;
}) {
  return (
    <Card className="p-4 lg:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{dictionary.notificationCenter}</p>
          <p className="text-xs text-muted-foreground">{events.length} {dictionary.live.toLocaleLowerCase("tr-TR")}</p>
        </div>
        <Button size="icon" variant="secondary" aria-label={dictionary.filters}>
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3">
        {events.length === 0 ? (
          <EmptyState language={language} />
        ) : (
          events.map((event) => (
            <div key={event.id} className="rounded-lg border border-border bg-background/65 p-3">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{text(language, event.titleTR, event.titleEN)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {departmentLabel(language, event.department)} · {event.time}
                  </p>
                </div>
                <Badge tone="green">{dictionary.live}</Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function WorkflowTimeline({ dictionary, language }: { dictionary: typeof labels.tr; language: Language }) {
  return (
    <Card className="p-4 lg:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{dictionary.workflow}</p>
          <p className="text-xs text-muted-foreground">WO-24081 · Room 1108</p>
        </div>
        <Badge tone="amber">SLA 62%</Badge>
      </div>

      <div className="grid gap-3">
        {workflowSteps.map((step, index) => (
          <div key={step.labelTR} className="grid grid-cols-[28px_1fr_auto] gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full border text-xs",
                  step.state === "done" && "border-success bg-success text-white",
                  step.state === "active" && "border-warning bg-warning text-white",
                  step.state === "pending" && "border-border bg-muted text-muted-foreground"
                )}
              >
                {step.state === "done" ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              {index < workflowSteps.length - 1 && <span className="h-9 w-px bg-border" />}
            </div>
            <div className="min-w-0 pb-3">
              <p className="text-sm font-semibold">{text(language, step.labelTR, step.labelEN)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{step.actor}</p>
            </div>
            <span className="text-xs text-muted-foreground">{step.time}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CalendarBoard({
  dictionary,
  events,
  language,
  onViewChange,
  view
}: {
  dictionary: typeof labels.tr;
  events: CalendarEvent[];
  language: Language;
  onViewChange: (view: "Günlük" | "Haftalık" | "Aylık" | "Timeline") => void;
  view: "Günlük" | "Haftalık" | "Aylık" | "Timeline";
}) {
  const viewLabels = ["Günlük", "Haftalık", "Aylık", "Timeline"] as const;
  return (
    <Card className="p-4 lg:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {events.length > 2 ? dictionary.allCalendars : dictionary.departmentCalendar}
          </p>
          <p className="text-xs text-muted-foreground">{dictionary.workload}</p>
        </div>
        <div className="flex rounded-md border border-border bg-background p-1">
          {viewLabels.map((item) => (
            <button
              key={item}
              className={cn(
                "h-8 rounded px-2 text-xs font-medium transition",
                view === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => onViewChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {events.length === 0 ? (
          <EmptyState language={language} />
        ) : (
          events.map((event) => (
            <div key={event.id} className="rounded-lg border border-border bg-background/65 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{text(language, event.titleTR, event.titleEN)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{departmentLabel(language, event.department)} · {event.window}</p>
                </div>
                <Badge tone={event.load > 85 ? "rose" : event.load > 70 ? "amber" : "green"}>{event.load}%</Badge>
              </div>
              <ProgressBar value={event.load} />
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function ModuleWorkspace({
  activeRecord,
  dictionary,
  language,
  module,
  onActiveRecordChange,
  roleId,
  workItems
}: {
  activeRecord: string;
  dictionary: typeof labels.tr;
  language: Language;
  module: ModuleDefinition;
  onActiveRecordChange: (id: string) => void;
  roleId: string;
  workItems: WorkItem[];
}) {
  const [tab, setTab] = useState<"list" | "detail" | "create" | "edit">("list");
  const role = getRole(roleId as typeof roles[number]["id"]);
  const selected = workItems.find((item) => item.id === activeRecord) ?? workItems[0];
  const fields = formBlueprints[module.id === "all" ? "technical" : module.id] ?? formBlueprints.technical;
  const canCreate = hasPermission(role.id, "workorder.create") || hasPermission(role.id, "staff.create") || hasPermission(role.id, "complaint.create");
  const tabs: Array<{ id: "list" | "detail" | "create" | "edit"; label: string; icon: LucideIcon }> = [
    { id: "list", label: dictionary.list, icon: ListChecks },
    { id: "detail", label: dictionary.detail, icon: ClipboardList },
    { id: "create", label: dictionary.create, icon: Plus },
    { id: "edit", label: dictionary.edit, icon: SlidersHorizontal }
  ];

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 lg:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn("grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br text-white", module.color)}>
            <module.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{moduleLabel(language, module)}</p>
            <p className="truncate text-xs text-muted-foreground">{moduleDescription(language, module)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary">
            <Filter className="h-4 w-4" />
            {dictionary.filters}
          </Button>
          <Button size="sm" variant="secondary">
            <FileText className="h-4 w-4" />
            {dictionary.exportPdf}
          </Button>
          <Button size="sm" variant="secondary">
            <FileSpreadsheet className="h-4 w-4" />
            {dictionary.exportExcel}
          </Button>
          <Button size="sm" disabled={!canCreate}>
            <Plus className="h-4 w-4" />
            {dictionary.newRecord}
          </Button>
        </div>
      </div>

      <div className="border-b border-border px-4 pt-4 lg:px-5">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition",
                tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setTab(id)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 p-4 lg:grid-cols-[1.35fr_0.9fr] lg:p-5">
        <div className="min-w-0">
          {tab === "list" && (
            <DataTable
              dictionary={dictionary}
              language={language}
              onActiveRecordChange={onActiveRecordChange}
              selectedId={activeRecord}
              workItems={workItems}
            />
          )}
          {tab === "detail" && <DetailPane dictionary={dictionary} item={selected} language={language} />}
          {(tab === "create" || tab === "edit") && (
            <EntryForm dictionary={dictionary} fields={fields} language={language} mode={tab} />
          )}
        </div>

        <OperationsAside dictionary={dictionary} language={language} selected={selected} />
      </div>
    </Card>
  );
}

function DataTable({
  dictionary,
  language,
  onActiveRecordChange,
  selectedId,
  workItems
}: {
  dictionary: typeof labels.tr;
  language: Language;
  onActiveRecordChange: (id: string) => void;
  selectedId: string;
  workItems: WorkItem[];
}) {
  if (workItems.length === 0) return <EmptyState language={language} />;

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-muted/70 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">{dictionary.modules}</th>
              <th className="px-4 py-3">{dictionary.owner}</th>
              <th className="px-4 py-3">{dictionary.status}</th>
              <th className="px-4 py-3">{dictionary.priority}</th>
              <th className="px-4 py-3">{dictionary.sla}</th>
              <th className="px-4 py-3">{dictionary.due}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {workItems.map((item) => (
              <tr
                key={item.id}
                className={cn("transition hover:bg-muted/50", selectedId === item.id && "bg-primary/5")}
                onClick={() => onActiveRecordChange(item.id)}
              >
                <td className="px-4 py-3 font-semibold">{item.id}</td>
                <td className="max-w-[260px] px-4 py-3">
                  <p className="truncate font-medium">{text(language, item.titleTR, item.titleEN)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{departmentLabel(language, item.department)}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{item.owner}</td>
                <td className="px-4 py-3">
                  <Badge tone="blue">{text(language, item.statusTR, item.statusEN)}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={priorityTone(item.priority)}>{item.priority}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="w-28">
                    <ProgressBar value={item.sla} />
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{item.due}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetailPane({
  dictionary,
  item,
  language
}: {
  dictionary: typeof labels.tr;
  item?: WorkItem;
  language: Language;
}) {
  if (!item) return <EmptyState language={language} />;

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-border bg-background/65 p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">{item.id}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-normal">{text(language, item.titleTR, item.titleEN)}</h2>
          </div>
          <Badge tone={priorityTone(item.priority)}>{item.priority}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label={dictionary.owner} value={item.owner} />
          <Metric label={dictionary.status} value={text(language, item.statusTR, item.statusEN)} />
          <Metric label={dictionary.due} value={item.due} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StateTile title={dictionary.comments} icon={MessageSquareText} value="12" />
        <StateTile title={dictionary.files} icon={Paperclip} value="8" />
        <StateTile title={dictionary.audit} icon={History} value="31" />
      </div>
    </div>
  );
}

function EntryForm({
  dictionary,
  fields,
  language,
  mode
}: {
  dictionary: typeof labels.tr;
  fields: string[];
  language: Language;
  mode: "create" | "edit";
}) {
  return (
    <form className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field, index) => (
          <Field key={field} label={field}>
            {index % 3 === 0 ? (
              <Select defaultValue="">
                <option value="" disabled>
                  {field}
                </option>
                <option>Standart</option>
                <option>VIP</option>
                <option>Kritik</option>
              </Select>
            ) : (
              <TextInput placeholder={field} />
            )}
          </Field>
        ))}
      </div>
      <label className="grid min-h-[116px] place-items-center rounded-lg border border-dashed border-border bg-background/65 p-4 text-center text-sm text-muted-foreground">
        <UploadCloud className="mb-2 h-6 w-6 text-primary" />
        {dictionary.dropzone}
        <input className="sr-only" type="file" multiple />
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary">
          {text(language, "Taslak", "Draft")}
        </Button>
        <Button type="button">
          {mode === "create" ? dictionary.newRecord : dictionary.edit}
        </Button>
      </div>
    </form>
  );
}

function OperationsAside({
  dictionary,
  language,
  selected
}: {
  dictionary: typeof labels.tr;
  language: Language;
  selected?: WorkItem;
}) {
  return (
    <aside className="grid gap-4">
      <div className="rounded-lg border border-border bg-background/65 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">{dictionary.activity}</p>
          <Activity className="h-4 w-4 text-primary" />
        </div>
        <div className="grid gap-3">
          {[
            ["09:12", text(language, "Kayıt oluşturuldu", "Record created")],
            ["09:18", text(language, "Atama güncellendi", "Assignment updated")],
            ["10:06", text(language, "Satın alma talebi eklendi", "Purchase request added")]
          ].map(([time, label]) => (
            <div key={`${time}-${label}`} className="flex gap-3">
              <span className="w-10 text-xs text-muted-foreground">{time}</span>
              <p className="text-sm">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/65 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">{dictionary.comments}</p>
          <MessageSquareText className="h-4 w-4 text-primary" />
        </div>
        <div className="grid gap-3">
          <p className="rounded-lg bg-muted p-3 text-sm leading-6">
            {selected ? text(language, selected.titleTR, selected.titleEN) : text(language, "Kayıt seçilmedi", "No record selected")}
          </p>
          <TextInput placeholder={text(language, "Yorum ekle", "Add comment")} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/65 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">{dictionary.audit}</p>
          <ShieldCheck className="h-4 w-4 text-primary" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="IP" value="10.10.8.44" />
          <Metric label="Session" value="2FA" />
          <Metric label="Soft delete" value="On" />
          <Metric label="Rate limit" value="60/m" />
        </div>
      </div>
    </aside>
  );
}

function PermissionMatrix({
  dictionary,
  language,
  roleId
}: {
  dictionary: typeof labels.tr;
  language: Language;
  roleId: string;
}) {
  const role = getRole(roleId as typeof roles[number]["id"]);
  const permissions = role.permissions;
  return (
    <Card className="p-4 lg:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{dictionary.permissions}</p>
          <p className="text-xs text-muted-foreground">
            {text(language, role.labelTR, role.labelEN)} · {departmentLabel(language, role.department)}
          </p>
        </div>
        <Badge tone={role.id === "generalManager" ? "green" : "blue"}>
          {role.visibleDepartments.length} {text(language, "kapsam", "scope")}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["RBAC", "JWT", "Session", "2FA"],
          ["Audit log", "IP log", "Login history", "Rate limit"],
          ["PDF", "Excel", "File upload", "Photo upload"],
          ["Timeline", "Comments", "Soft delete", "Notifications"]
        ].map((group, index) => (
          <div key={index} className="rounded-lg border border-border bg-background/65 p-3">
            <div className="grid gap-2">
              {group.map((item) => (
                <div key={item} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{item}</span>
                  <Check className="h-4 w-4 text-success" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {permissions.map((permission) => (
          <Badge key={permission} tone="neutral">
            {permission}
          </Badge>
        ))}
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function StateTile({
  icon: Icon,
  title,
  value
}: {
  icon: typeof MessageSquareText;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/65 p-4">
      <div className="mb-3 flex items-center justify-between">
        <Icon className="h-4 w-4 text-primary" />
        <Badge tone="neutral">{value}</Badge>
      </div>
      <p className="text-sm font-semibold">{title}</p>
    </div>
  );
}

function EmptyState({ language }: { language: Language }) {
  return (
    <div className="grid min-h-[160px] place-items-center rounded-lg border border-dashed border-border bg-background/65 p-6 text-center">
      <div>
        <LayoutDashboard className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold">{text(language, "Kayıt bulunamadı", "No records found")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{text(language, "Filtre veya rol kapsamını değiştirin.", "Change filter or role scope.")}</p>
      </div>
    </div>
  );
}

function HotelIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M4 21V6.5L12 3l8 3.5V21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 21v-7h8v7M8 9h.01M12 9h.01M16 9h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
