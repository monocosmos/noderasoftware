import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ConciergeBell,
  FileText,
  Gauge,
  HardHat,
  Hotel,
  KeyRound,
  LockKeyhole,
  LucideIcon,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Utensils,
  Waves
} from "lucide-react";
import type { DepartmentId, Permission, RoleId } from "./rbac";

export type Language = "tr" | "en";

export type ModuleDefinition = {
  id: DepartmentId | "all";
  titleTR: string;
  titleEN: string;
  descriptionTR: string;
  descriptionEN: string;
  icon: LucideIcon;
  color: string;
  requiredPermission?: Permission;
};

export type WorkItem = {
  id: string;
  titleTR: string;
  titleEN: string;
  department: DepartmentId;
  owner: string;
  statusTR: string;
  statusEN: string;
  priority: "Kritik" | "Yüksek" | "Orta" | "Düşük";
  sla: number;
  due: string;
};

export type CalendarEvent = {
  id: string;
  titleTR: string;
  titleEN: string;
  department: DepartmentId;
  window: string;
  load: number;
};

export const modules: ModuleDefinition[] = [
  {
    id: "all",
    titleTR: "Executive Command",
    titleEN: "Executive Command",
    descriptionTR: "Tüm operasyon, KPI, onay ve yoğunluk akışları",
    descriptionEN: "All operations, KPIs, approvals and workload flows",
    icon: Hotel,
    color: "from-teal-500 to-cyan-500",
    requiredPermission: "system.view_all"
  },
  {
    id: "hr",
    titleTR: "İnsan Kaynakları",
    titleEN: "Human Resources",
    descriptionTR: "Personel kartları, izin, bordro, eğitim ve performans",
    descriptionEN: "Employee files, leave, payroll, training and performance",
    icon: UsersRound,
    color: "from-sky-500 to-indigo-500"
  },
  {
    id: "technical",
    titleTR: "Teknik Servis",
    titleEN: "Engineering",
    descriptionTR: "Arıza, iş emri, bakım, depo ve SLA",
    descriptionEN: "Incidents, work orders, maintenance, stock and SLA",
    icon: HardHat,
    color: "from-orange-500 to-amber-400"
  },
  {
    id: "housekeeping",
    titleTR: "Housekeeping",
    titleEN: "Housekeeping",
    descriptionTR: "Oda durumları, kat planı, temizlik ve minibar",
    descriptionEN: "Room status, floor plan, cleaning and minibar",
    icon: Sparkles,
    color: "from-emerald-500 to-lime-400"
  },
  {
    id: "frontOffice",
    titleTR: "Ön Büro",
    titleEN: "Front Office",
    descriptionTR: "Rezervasyon, check-in, VIP, şikayet ve oda blokajı",
    descriptionEN: "Reservations, check-in, VIP, complaints and room blocking",
    icon: ConciergeBell,
    color: "from-violet-500 to-fuchsia-500"
  },
  {
    id: "security",
    titleTR: "Güvenlik",
    titleEN: "Security",
    descriptionTR: "Olay kayıtları, devriye, lost & found ve aksiyonlar",
    descriptionEN: "Incidents, patrols, lost & found and actions",
    icon: ShieldCheck,
    color: "from-rose-500 to-red-500"
  },
  {
    id: "spa",
    titleTR: "SPA",
    titleEN: "SPA",
    descriptionTR: "SPA operasyonları ve servis talepleri",
    descriptionEN: "SPA operations and service requests",
    icon: Waves,
    color: "from-cyan-500 to-teal-500"
  },
  {
    id: "fnb",
    titleTR: "Yiyecek & İçecek",
    titleEN: "Food & Beverage",
    descriptionTR: "Restoran, banket, servis ve talep yönetimi",
    descriptionEN: "Restaurant, banquet, service and request management",
    icon: Utensils,
    color: "from-yellow-500 to-orange-500"
  },
  {
    id: "purchasing",
    titleTR: "Satın Alma",
    titleEN: "Purchasing",
    descriptionTR: "Talep, teklif, onay ve tedarikçi akışları",
    descriptionEN: "Requests, offers, approvals and suppliers",
    icon: BriefcaseBusiness,
    color: "from-slate-500 to-zinc-500"
  },
  {
    id: "accounting",
    titleTR: "Muhasebe",
    titleEN: "Accounting",
    descriptionTR: "Bütçe, masraf, ödeme ve onay kontrolleri",
    descriptionEN: "Budget, expense, payment and approval controls",
    icon: ReceiptText,
    color: "from-green-500 to-teal-500"
  }
];

export const executiveKpis = [
  { labelTR: "Doluluk", labelEN: "Occupancy", value: "87.4%", trend: "+4.1", icon: Building2, tone: "teal" },
  { labelTR: "Açık İş Emri", labelEN: "Open Work Orders", value: "142", trend: "-8", icon: ClipboardCheck, tone: "orange" },
  { labelTR: "SLA Uyum", labelEN: "SLA Compliance", value: "94.2%", trend: "+2.8", icon: Gauge, tone: "green" },
  { labelTR: "Bekleyen Onay", labelEN: "Pending Approval", value: "18", trend: "+5", icon: BadgeCheck, tone: "violet" }
];

export const departmentKpis: Record<DepartmentId, typeof executiveKpis> = {
  executive: executiveKpis,
  hr: [
    { labelTR: "Aktif Personel", labelEN: "Active Staff", value: "486", trend: "+12", icon: UsersRound, tone: "sky" },
    { labelTR: "İzin Talebi", labelEN: "Leave Requests", value: "24", trend: "-3", icon: CalendarDays, tone: "amber" },
    { labelTR: "Eğitim Tamamlama", labelEN: "Training Completion", value: "81%", trend: "+9", icon: FileText, tone: "green" },
    { labelTR: "Aday Pipeline", labelEN: "Candidate Pipeline", value: "38", trend: "+6", icon: BriefcaseBusiness, tone: "violet" }
  ],
  technical: [
    { labelTR: "Aktif Arıza", labelEN: "Active Incidents", value: "37", trend: "-4", icon: AlertTriangle, tone: "orange" },
    { labelTR: "Planlı Bakım", labelEN: "Planned Maintenance", value: "19", trend: "+3", icon: CalendarDays, tone: "sky" },
    { labelTR: "Bakım Uyumu", labelEN: "Maintenance Compliance", value: "96%", trend: "+1.1", icon: Gauge, tone: "green" },
    { labelTR: "Satın Alma", labelEN: "Purchasing", value: "11", trend: "+2", icon: BriefcaseBusiness, tone: "violet" }
  ],
  housekeeping: [
    { labelTR: "Temiz Oda", labelEN: "Clean Rooms", value: "328", trend: "+22", icon: Sparkles, tone: "green" },
    { labelTR: "Kirli Oda", labelEN: "Dirty Rooms", value: "74", trend: "-18", icon: Hotel, tone: "orange" },
    { labelTR: "Minibar Kontrol", labelEN: "Minibar Checks", value: "116", trend: "+14", icon: ClipboardCheck, tone: "sky" },
    { labelTR: "Kontrol Bekleyen", labelEN: "Inspection Queue", value: "29", trend: "+5", icon: BadgeCheck, tone: "violet" }
  ],
  frontOffice: [
    { labelTR: "Geliş", labelEN: "Arrivals", value: "186", trend: "+21", icon: ConciergeBell, tone: "violet" },
    { labelTR: "Çıkış", labelEN: "Departures", value: "142", trend: "-8", icon: KeyRound, tone: "sky" },
    { labelTR: "VIP Misafir", labelEN: "VIP Guests", value: "34", trend: "+7", icon: BadgeCheck, tone: "amber" },
    { labelTR: "Şikayet", labelEN: "Complaints", value: "9", trend: "-2", icon: Bell, tone: "rose" }
  ],
  security: [
    { labelTR: "Devriye", labelEN: "Patrols", value: "48", trend: "+4", icon: ShieldCheck, tone: "green" },
    { labelTR: "Olay Kaydı", labelEN: "Incidents", value: "7", trend: "-1", icon: AlertTriangle, tone: "rose" },
    { labelTR: "Lost & Found", labelEN: "Lost & Found", value: "13", trend: "+2", icon: ClipboardCheck, tone: "sky" },
    { labelTR: "Kapı Logları", labelEN: "Access Logs", value: "1.2K", trend: "+80", icon: LockKeyhole, tone: "violet" }
  ],
  spa: [
    { labelTR: "Randevu", labelEN: "Appointments", value: "76", trend: "+9", icon: Waves, tone: "cyan" },
    { labelTR: "Servis Talebi", labelEN: "Service Requests", value: "5", trend: "+1", icon: ClipboardCheck, tone: "orange" },
    { labelTR: "Doluluk", labelEN: "Utilization", value: "72%", trend: "+6", icon: Gauge, tone: "green" },
    { labelTR: "VIP Paket", labelEN: "VIP Packages", value: "14", trend: "+3", icon: BadgeCheck, tone: "violet" }
  ],
  sales: [
    { labelTR: "Teklif", labelEN: "Offers", value: "28", trend: "+4", icon: FileText, tone: "sky" },
    { labelTR: "Kurumsal Lead", labelEN: "Corporate Leads", value: "17", trend: "+3", icon: BriefcaseBusiness, tone: "violet" },
    { labelTR: "Gelir Firsati", labelEN: "Revenue Opportunity", value: "₺2.1M", trend: "+8", icon: ReceiptText, tone: "green" },
    { labelTR: "Takip", labelEN: "Follow-ups", value: "34", trend: "-2", icon: CalendarDays, tone: "amber" }
  ],
  fnb: [
    { labelTR: "Banket", labelEN: "Banquets", value: "12", trend: "+2", icon: Utensils, tone: "amber" },
    { labelTR: "Servis Talebi", labelEN: "Service Requests", value: "18", trend: "-5", icon: ClipboardCheck, tone: "orange" },
    { labelTR: "Gelir", labelEN: "Revenue", value: "₺1.8M", trend: "+11", icon: ReceiptText, tone: "green" },
    { labelTR: "Stok Uyarısı", labelEN: "Stock Alerts", value: "6", trend: "+2", icon: AlertTriangle, tone: "rose" }
  ],
  purchasing: [
    { labelTR: "Talep", labelEN: "Requests", value: "42", trend: "+6", icon: BriefcaseBusiness, tone: "slate" },
    { labelTR: "Teklif", labelEN: "Offers", value: "27", trend: "+5", icon: FileText, tone: "sky" },
    { labelTR: "Onay Bekleyen", labelEN: "Pending Approval", value: "14", trend: "+2", icon: BadgeCheck, tone: "amber" },
    { labelTR: "SLA", labelEN: "SLA", value: "91%", trend: "+3", icon: Gauge, tone: "green" }
  ],
  accounting: [
    { labelTR: "Onay Bekleyen", labelEN: "Pending Approval", value: "16", trend: "+4", icon: BadgeCheck, tone: "amber" },
    { labelTR: "Bütçe Kullanımı", labelEN: "Budget Usage", value: "68%", trend: "+2", icon: Gauge, tone: "green" },
    { labelTR: "Ödeme Planı", labelEN: "Payment Plan", value: "31", trend: "-3", icon: ReceiptText, tone: "sky" },
    { labelTR: "Audit Uyarısı", labelEN: "Audit Alerts", value: "3", trend: "-1", icon: AlertTriangle, tone: "rose" }
  ]
};

export const occupancyData = [
  { name: "Suite", value: 34, fill: "#0f766e" },
  { name: "Deluxe", value: 46, fill: "#2563eb" },
  { name: "Standard", value: 72, fill: "#f59e0b" },
  { name: "Blocked", value: 11, fill: "#ef4444" }
];

export const funnelData = [
  { name: "Bildirildi", value: 168, fill: "#0ea5e9" },
  { name: "Atandı", value: 132, fill: "#14b8a6" },
  { name: "Devam", value: 86, fill: "#f59e0b" },
  { name: "Onay", value: 42, fill: "#8b5cf6" },
  { name: "Kapandı", value: 126, fill: "#22c55e" }
];

export const workloadData = [
  { label: "Pzt", technical: 31, hk: 58, front: 44, security: 18 },
  { label: "Sal", technical: 37, hk: 64, front: 39, security: 22 },
  { label: "Çar", technical: 29, hk: 49, front: 52, security: 20 },
  { label: "Per", technical: 43, hk: 72, front: 61, security: 24 },
  { label: "Cum", technical: 48, hk: 78, front: 66, security: 30 },
  { label: "Cmt", technical: 35, hk: 83, front: 74, security: 33 },
  { label: "Paz", technical: 26, hk: 57, front: 58, security: 25 }
];

export const workItems: WorkItem[] = [
  {
    id: "WO-24081",
    titleTR: "1108 numaralı odada klima arızası",
    titleEN: "AC failure in room 1108",
    department: "technical",
    owner: "Teknik Şef",
    statusTR: "Satın alma bekliyor",
    statusEN: "Waiting for purchasing",
    priority: "Yüksek",
    sla: 62,
    due: "14:30"
  },
  {
    id: "HK-88214",
    titleTR: "VIP suite final oda kontrolü",
    titleEN: "VIP suite final inspection",
    department: "housekeeping",
    owner: "Kat Şefi",
    statusTR: "Kontrol",
    statusEN: "Inspection",
    priority: "Kritik",
    sla: 84,
    due: "12:45"
  },
  {
    id: "FO-78110",
    titleTR: "Geç check-out yoğunluk planı",
    titleEN: "Late checkout load plan",
    department: "frontOffice",
    owner: "Ön Büro Müdürü",
    statusTR: "Planlandı",
    statusEN: "Planned",
    priority: "Orta",
    sla: 74,
    due: "16:00"
  },
  {
    id: "SEC-11902",
    titleTR: "Balo salonu devriye planı",
    titleEN: "Ballroom patrol plan",
    department: "security",
    owner: "Güvenlik Müdürü",
    statusTR: "Aktif",
    statusEN: "Active",
    priority: "Orta",
    sla: 92,
    due: "21:00"
  },
  {
    id: "HR-44107",
    titleTR: "Sezonluk işe alım mülakatları",
    titleEN: "Seasonal hiring interviews",
    department: "hr",
    owner: "İK Müdürü",
    statusTR: "Görüşme",
    statusEN: "Interview",
    priority: "Düşük",
    sla: 68,
    due: "17:30"
  },
  {
    id: "FNB-55320",
    titleTR: "Banket teknik kurulum talebi",
    titleEN: "Banquet engineering setup request",
    department: "fnb",
    owner: "F&B Müdürü",
    statusTR: "Tekniğe yönlendirildi",
    statusEN: "Routed to engineering",
    priority: "Yüksek",
    sla: 57,
    due: "19:00"
  }
];

export const calendarEvents: CalendarEvent[] = [
  { id: "CAL-HK-01", titleTR: "HK sabah vardiyası", titleEN: "HK morning shift", department: "housekeeping", window: "08:00-16:00", load: 82 },
  { id: "CAL-TEC-01", titleTR: "Chiller planlı bakım", titleEN: "Chiller planned maintenance", department: "technical", window: "09:30-11:00", load: 64 },
  { id: "CAL-FO-01", titleTR: "Grup check-in dalgası", titleEN: "Group check-in wave", department: "frontOffice", window: "14:00-18:00", load: 91 },
  { id: "CAL-SEC-01", titleTR: "Kongre katı devriye", titleEN: "Convention floor patrol", department: "security", window: "18:00-23:00", load: 70 },
  { id: "CAL-HR-01", titleTR: "Oryantasyon eğitimi", titleEN: "Orientation training", department: "hr", window: "10:00-12:00", load: 44 },
  { id: "CAL-SPA-01", titleTR: "VIP spa paketi", titleEN: "VIP spa package", department: "spa", window: "13:00-15:30", load: 73 },
  { id: "CAL-FNB-01", titleTR: "Gala servis hazırlığı", titleEN: "Gala service prep", department: "fnb", window: "16:00-22:00", load: 88 }
];

export const workflowSteps = [
  { labelTR: "Arıza bildirildi", labelEN: "Incident reported", actor: "Ön Büro", time: "09:12", state: "done" },
  { labelTR: "Teknik Şef atama yaptı", labelEN: "Engineering Chief assigned", actor: "Teknik", time: "09:18", state: "done" },
  { labelTR: "Teknisyen görevi aldı", labelEN: "Technician accepted", actor: "Teknik", time: "09:24", state: "done" },
  { labelTR: "Satın alma talebi oluşturuldu", labelEN: "Purchase request created", actor: "Teknik", time: "10:06", state: "active" },
  { labelTR: "Muhasebe onayı", labelEN: "Accounting approval", actor: "Muhasebe", time: "Bekliyor", state: "pending" },
  { labelTR: "GM görüntüledi", labelEN: "GM reviewed", actor: "Genel Müdür", time: "Bekliyor", state: "pending" },
  { labelTR: "HK kontrol ve kapanış", labelEN: "HK check and close", actor: "HK", time: "Bekliyor", state: "pending" }
];

export const notifications = [
  { id: "N-1", type: "approval", titleTR: "Satın alma onayı bekliyor", titleEN: "Purchase approval pending", time: "2 dk", department: "technical" as DepartmentId },
  { id: "N-2", type: "sla", titleTR: "SLA riski: oda 1108", titleEN: "SLA risk: room 1108", time: "9 dk", department: "technical" as DepartmentId },
  { id: "N-3", type: "vip", titleTR: "VIP suite kontrolü tamamlandı", titleEN: "VIP suite inspection completed", time: "14 dk", department: "housekeeping" as DepartmentId },
  { id: "N-4", type: "security", titleTR: "Lost & Found kaydı güncellendi", titleEN: "Lost & Found record updated", time: "22 dk", department: "security" as DepartmentId }
];

export const formBlueprints: Record<string, string[]> = {
  hr: ["Personel kartı", "İzin başlangıcı", "Bordro tipi", "Eğitim seti", "Dijital imza"],
  technical: ["Arıza lokasyonu", "Varlık kodu", "SLA seviyesi", "Parça ihtiyacı", "Fotoğraf yükleme"],
  housekeeping: ["Oda numarası", "Kat", "Temizlik tipi", "Minibar durumu", "Kontrol checklist"],
  frontOffice: ["Rezervasyon no", "Misafir tipi", "VIP notu", "Oda blokajı", "Şikayet kategorisi"],
  security: ["Olay tipi", "Lokasyon", "Kanıt dosyası", "Devriye noktası", "Aksiyon sahibi"],
  spa: ["Randevu tipi", "Terapist", "Oda", "Hijyen kontrolü", "Servis talebi"],
  fnb: ["Outlet", "Banket no", "Servis tipi", "Teknik ihtiyaç", "HK ihtiyaç"],
  purchasing: ["Talep kalemi", "Tedarikçi", "Teklif dosyası", "Bütçe kodu", "Onay akışı"],
  accounting: ["Masraf merkezi", "Fatura no", "Ödeme tarihi", "Bütçe kontrol", "Audit notu"]
};

export const roleDemoUsers: Record<RoleId, string> = {
  siteAdmin: "Hasan Fırat Keskin",
  generalManager: "Aylin Karaca",
  hrManager: "Mert Demir",
  technicalManager: "Selim Arslan",
  technicalAssistant: "Okan Teknik",
  hkManager: "Derya Şahin",
  frontOfficeManager: "Ece Yılmaz",
  securityManager: "Kerem Aksoy",
  technicalChief: "Baran Usta",
  floorChief: "Nihan Kaya",
  staff: "Emre Teknik",
  spaManager: "Lara Deniz",
  salesManager: "Deniz Satış",
  fnbManager: "Can Erdem"
};
