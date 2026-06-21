import type { ReactNode } from "react";
import { AlertTriangle, CalendarDays, Clock, Home, Users, Wrench } from "lucide-react";
import { EmptyState } from "./ui-common";
import type { HotelFloorAreaRecord, HotelFloorRecord, JobRecord, OperationalRecord } from "./types";

type OperationAreaTone = "occupied" | "vacant" | "department" | "meeting";

type AreaStatus = {
  label: string;
  tone: OperationAreaTone;
  departmentLabel?: string;
};

type AreaIssueCard = {
  id: string;
  label: string;
  title: string;
  detail: string;
  due: string;
  risk: "low" | "normal" | "high" | "urgent";
};

type MeetingPlan = {
  time: string;
  needs: string;
};

export function HotelOperationBoard({
  canViewFullPlan,
  departmentLabelFor,
  floors,
  jobs,
  onSelectArea,
  onSelectFloorLevel,
  onToggleShowAllFloors,
  records,
  selectedFloorLevel,
  showAllFloors
}: {
  canViewFullPlan: boolean;
  departmentLabelFor: (departmentId: string) => string;
  floors: HotelFloorRecord[];
  jobs: JobRecord[];
  onSelectArea: (area: HotelFloorAreaRecord) => void;
  onSelectFloorLevel: (level: string) => void;
  onToggleShowAllFloors: () => void;
  records: OperationalRecord[];
  selectedFloorLevel: string;
  showAllFloors: boolean;
}) {
  const selectedFloor = floors.find((floor) => String(floor.level) === selectedFloorLevel) ?? floors[0];
  const displayedFloors = showAllFloors ? floors : selectedFloor ? [selectedFloor] : [];
  const areaSummaries = floors.flatMap((floor) => floor.areas.map((area) => {
    const areaRecords = recordsForArea(area, records);
    const areaJobs = activeJobsForArea(area, jobs);
    return {
      area,
      floor,
      status: statusForArea(area, areaRecords, areaJobs, departmentLabelFor),
      issueCount: issueCardsForArea(areaRecords, areaJobs, departmentLabelFor).length,
      meetingPlan: meetingPlanForArea(area, areaRecords, areaJobs)
    };
  }));
  const occupiedCount = areaSummaries.filter((item) => item.status.tone === "occupied").length;
  const vacantCount = areaSummaries.filter((item) => item.status.tone === "vacant").length;
  const departmentCount = areaSummaries.filter((item) => item.status.tone === "department").length;
  const issueCount = areaSummaries.reduce((sum, item) => sum + item.issueCount, 0);
  const meetingCount = areaSummaries.filter((item) => item.meetingPlan).length;

  return (
    <section className="hotel-operation-board" aria-label="Otel operasyon kat ve oda haritası">
      <div className="hotel-operation-board-header">
        <div>
          <span className="dashboard-eyebrow">Ana görev izleme üssü</span>
          <h2>Otel Operasyon</h2>
          <p>Teknik kat planına göre oda, alan, toplantı ve bekleyen aksiyonlar tek ekranda izlenir.</p>
        </div>
        <div className="hotel-operation-legend" aria-label="Durum renkleri">
          <span className="hotel-operation-legend-item occupied">Dolu</span>
          <span className="hotel-operation-legend-item vacant">Boş</span>
          <span className="hotel-operation-legend-item department">Departmanda</span>
        </div>
      </div>

      <div className="hotel-operation-summary-grid">
        <SummaryCard icon={<Users size={18} />} label="Dolu" value={occupiedCount} tone="occupied" />
        <SummaryCard icon={<Home size={18} />} label="Boş" value={vacantCount} tone="vacant" />
        <SummaryCard icon={<Wrench size={18} />} label="Departmanda" value={departmentCount} tone="department" />
        <SummaryCard icon={<AlertTriangle size={18} />} label="Açık Aksiyon" value={issueCount} tone={issueCount ? "attention" : "vacant"} />
        <SummaryCard icon={<CalendarDays size={18} />} label="Toplantı Planı" value={meetingCount} tone="meeting" />
      </div>

      <div className="hotel-operation-toolbar">
        <div className="hotel-operation-floor-tabs" aria-label="Kat seçimi">
          <button
            type="button"
            className={`hotel-operation-floor-tab all ${showAllFloors ? "active" : ""}`}
            onClick={onToggleShowAllFloors}
            aria-pressed={showAllFloors}
          >
            Tüm Katlar
          </button>
          {floors.map((floor) => (
            <button
              key={floor.level}
              type="button"
              className={`hotel-operation-floor-tab ${!showAllFloors && selectedFloor?.level === floor.level ? "active" : ""}`}
              onClick={() => {
                if (showAllFloors) onToggleShowAllFloors();
                onSelectFloorLevel(String(floor.level));
              }}
              aria-pressed={!showAllFloors && selectedFloor?.level === floor.level}
            >
              {floor.name?.trim() || defaultFloorName(floor.level)}
            </button>
          ))}
        </div>
        <span className="hotel-operation-plan-note">
          {showAllFloors ? `${floors.length} kat açık` : selectedFloor ? `${selectedFloor.areas.length} oda-alan` : "Kat yok"}
        </span>
      </div>

      {displayedFloors.length ? (
        <div className="hotel-operation-floor-stack">
          {displayedFloors.map((floor) => (
            <section className="hotel-operation-floor-section" key={floor.level}>
              <div className="hotel-operation-floor-header">
                <span className="badge badge-inprogress">{floor.level > 0 ? `+${floor.level}` : floor.level === 0 ? "0 / L" : floor.level}</span>
                <strong>{floor.name || defaultFloorName(floor.level)}</strong>
                <small>{floor.areas.length} oda-alan</small>
              </div>
              {floor.areas.length ? (
                <div className="hotel-operation-area-grid">
                  {floor.areas
                    .slice()
                    .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, "tr-TR"))
                    .map((area) => {
                      const areaRecords = recordsForArea(area, records);
                      const areaJobs = activeJobsForArea(area, jobs);
                      const status = statusForArea(area, areaRecords, areaJobs, departmentLabelFor);
                      const issueCards = issueCardsForArea(areaRecords, areaJobs, departmentLabelFor);
                      const meetingPlan = meetingPlanForArea(area, areaRecords, areaJobs);
                      const guestPlan = guestPlanForArea(area, status, areaRecords, areaJobs);
                      return (
                        <button
                          type="button"
                          className={`hotel-operation-area-tile ${status.tone}`}
                          key={`${floor.level}-${area.id}-${area.label}`}
                          onClick={() => onSelectArea(area)}
                        >
                          <span className="hotel-operation-tile-main">
                            <span className="hotel-operation-tile-head">
                              <strong>{area.label}</strong>
                              <span className={`hotel-operation-status ${status.tone}`}>{status.label}</span>
                            </span>
                            <span className="hotel-operation-meta-row">
                              <span>{area.kind === "ROOM" ? "Oda" : "Alan"}</span>
                              {status.departmentLabel ? <span>{status.departmentLabel}</span> : null}
                            </span>
                            {guestPlan ? (
                              <span className="hotel-operation-note">
                                <Clock size={13} /> {guestPlan}
                              </span>
                            ) : null}
                            {meetingPlan ? (
                              <span className="hotel-operation-note meeting">
                                <CalendarDays size={13} /> {meetingPlan.time} · {meetingPlan.needs}
                              </span>
                            ) : null}
                          </span>
                          {issueCards.length ? (
                            <span className="hotel-operation-issue-list">
                              {issueCards.slice(0, 3).map((issue) => (
                                <span key={issue.id} className={`hotel-operation-issue-card ${issue.risk}`}>
                                  <span className="hotel-operation-issue-label">{issue.label}</span>
                                  <strong>{issue.title}</strong>
                                  <small>{issue.detail}</small>
                                  <small>{issue.due}</small>
                                </span>
                              ))}
                              {issueCards.length > 3 ? <span className="hotel-operation-more-issues">+{issueCards.length - 3} kayıt</span> : null}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                </div>
              ) : (
                <div className="module-helper">Bu katta tanımlı oda veya alan yok.</div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Görüntülenecek kat planı yok"
          description={canViewFullPlan ? "Kat Planı ekranından oda ve toplantı alanlarını tanımlayın." : "Teknik tarafından departmanlara açılan oda veya alan bulunmuyor."}
        />
      )}
    </section>
  );
}

function SummaryCard({ icon, label, tone, value }: { icon: ReactNode; label: string; tone: string; value: number }) {
  return (
    <div className={`hotel-operation-summary-card ${tone}`}>
      <span className="hotel-operation-summary-icon">{icon}</span>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function recordsForArea(area: HotelFloorAreaRecord, records: OperationalRecord[]) {
  const key = floorPlanAreaKey(area.label);
  return records.filter((record) => floorPlanAreaKey(operationAreaLabelFromRecord(record.title)) === key);
}

function activeJobsForArea(area: HotelFloorAreaRecord, jobs: JobRecord[]) {
  const key = floorPlanAreaKey(area.label);
  return jobs.filter((job) => {
    if (job.status === "Completed" || job.status === "Cancelled") return false;
    if (floorPlanAreaKey(job.room) === key) return true;
    const locationText = floorPlanAreaKey([job.location, job.locationDetail].filter(Boolean).join(" "));
    return Boolean(key) && locationText.includes(key);
  });
}

function statusForArea(
  area: HotelFloorAreaRecord,
  records: OperationalRecord[],
  jobs: JobRecord[],
  departmentLabelFor: (departmentId: string) => string
): AreaStatus {
  const statusText = [
    ...records.map((record) => `${record.status} ${record.meta} ${record.detail}`),
    ...jobs.map((job) => `${job.title} ${job.description} ${job.tags}`)
  ].join(" ").toLocaleLowerCase("tr-TR");
  const leadJob = jobs[0];
  const leadRecord = records[0];

  if (statusText.includes("dolu") || jobs.some((job) => job.guestImpact && !isDepartmentWorkJob(job))) {
    return { label: "Dolu", tone: "occupied" };
  }

  if (jobs.length || records.some((record) => isDepartmentWorkStatus(record.status))) {
    const departmentLabel = leadJob ? departmentLabelFor(leadJob.departmentId) : leadRecord?.owner;
    return {
      label: leadRecord?.status && !isVacantStatus(leadRecord.status) ? leadRecord.status : departmentLabel ? "Departmanda" : "İşlemde",
      tone: "department",
      departmentLabel
    };
  }

  if (isMeetingArea(area)) {
    return { label: "Hazır", tone: "meeting" };
  }

  return { label: "Boş", tone: "vacant" };
}

function issueCardsForArea(
  records: OperationalRecord[],
  jobs: JobRecord[],
  departmentLabelFor: (departmentId: string) => string
): AreaIssueCard[] {
  const jobCards = jobs.map((job) => ({
    id: `job-${job.id}`,
    label: issueLabelForJob(job),
    title: job.title,
    detail: departmentLabelFor(job.departmentId),
    due: job.due ? `Hedef ${formatBoardDate(job.due)}` : "Hedef bugün",
    risk: job.priority === "Urgent" || job.slaRisk ? "urgent" : job.priority === "High" || job.status === "Delayed" ? "high" : "normal"
  } satisfies AreaIssueCard));
  const recordCards = records
    .filter((record) => !isVacantStatus(record.status) && !record.status.includes("Tamamlandı"))
    .map((record) => ({
      id: `record-${record.id}`,
      label: issueLabelForStatus(record.status),
      title: record.status,
      detail: record.meta || record.detail,
      due: record.due || "Bugün",
      risk: record.risk
    } satisfies AreaIssueCard));
  return [...jobCards, ...recordCards];
}

function guestPlanForArea(area: HotelFloorAreaRecord, status: AreaStatus, records: OperationalRecord[], jobs: JobRecord[]) {
  if (area.kind !== "ROOM") return "";
  const sourceText = [
    records[0]?.due,
    records[0]?.meta,
    records[0]?.detail,
    jobs.find((job) => job.guestImpact)?.due,
    jobs[0]?.due,
    jobs[0]?.description
  ].filter(Boolean).join(" ");
  const time = findTime(sourceText);
  const day = dateOrDayLabel(records[0]?.due || jobs.find((job) => job.guestImpact)?.due || jobs[0]?.due);
  if (status.tone === "occupied") return `Misafir var · giriş ${time ? `${day} ${time}` : day}`;
  if (status.tone === "department") return `Giriş ${time ? `${day} ${time}` : `${day} / saat bekliyor`}`;
  return "Giriş planı yok";
}

function meetingPlanForArea(area: HotelFloorAreaRecord, records: OperationalRecord[], jobs: JobRecord[]): MeetingPlan | null {
  if (!isMeetingArea(area)) return null;
  const jobSource = jobs[0];
  const recordSource = records[0];
  const sourceText = jobSource
    ? `${jobSource.due} ${jobSource.description} ${jobSource.tags}`
    : recordSource
      ? `${recordSource.due} ${recordSource.meta} ${recordSource.detail}`
      : "";
  const time = findTime(sourceText);
  const day = dateOrDayLabel(jobSource?.due || recordSource?.due);
  const needs = jobSource
    ? jobSource.description || jobSource.title
    : recordSource
      ? recordSource.meta || recordSource.detail
    : "İhtiyaç notu bekliyor";
  return {
    time: time ? `${day} ${time}` : `${day} / saat bekliyor`,
    needs
  };
}

function issueLabelForJob(job: JobRecord) {
  const text = `${job.type} ${job.title} ${job.description} ${job.tags}`.toLocaleLowerCase("tr-TR");
  if (job.type === "Fault" || text.includes("arıza") || text.includes("ariza")) return "Arıza";
  if (job.type === "PlannedHousekeeping" || text.includes("temizlik") || text.includes("hk")) return "Temizlik";
  return "Eksik / Görev";
}

function issueLabelForStatus(status: string) {
  const normalized = status.toLocaleLowerCase("tr-TR");
  if (normalized.includes("arız") || normalized.includes("ariz")) return "Arıza";
  if (normalized.includes("kirli") || normalized.includes("temiz")) return "Temizlik";
  if (normalized.includes("blokaj") || normalized.includes("ooo") || normalized.includes("ooi")) return "Blokaj";
  return "Aksiyon";
}

function isDepartmentWorkJob(job: JobRecord) {
  const text = `${job.type} ${job.title} ${job.description} ${job.tags}`.toLocaleLowerCase("tr-TR");
  return job.type === "Fault" || job.type === "PlannedHousekeeping" || text.includes("arıza") || text.includes("temizlik") || text.includes("bakım");
}

function isDepartmentWorkStatus(status: string) {
  const normalized = status.toLocaleLowerCase("tr-TR");
  return [
    "operasyon",
    "kirli",
    "bakım",
    "arız",
    "ariz",
    "kontrol",
    "blokaj",
    "dnd",
    "ooo",
    "ooi"
  ].some((keyword) => normalized.includes(keyword));
}

function isVacantStatus(status: string) {
  const normalized = status.toLocaleLowerCase("tr-TR");
  return normalized.includes("boş") || normalized.includes("bos") || normalized.includes("temiz");
}

function isMeetingArea(area: HotelFloorAreaRecord) {
  if (area.kind !== "AREA") return false;
  const label = area.label.toLocaleLowerCase("tr-TR");
  return ["toplantı", "toplanti", "meeting", "salon", "balo", "konferans", "board"].some((keyword) => label.includes(keyword));
}

function operationAreaLabelFromRecord(title: string) {
  return title.replace(/^Oda\s+/i, "").trim();
}

function floorPlanAreaKey(label: string) {
  return label.trim().toLocaleLowerCase("tr-TR");
}

function defaultFloorName(level: number) {
  if (level === 0) return "L Zemin Kat";
  if (level > 0) return `${level}. Kat`;
  return `${level}. Kat`;
}

function findTime(value: string) {
  return value.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)?.[0] ?? "";
}

function dateOrDayLabel(value?: string) {
  if (!value) return "Bugün";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function formatBoardDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const time = parsed.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return `${parsed.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })} ${time}`;
}
