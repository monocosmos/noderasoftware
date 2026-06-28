import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Clock, Home, LogIn, LogOut, PenLine, X, Users, Wrench } from "lucide-react";
import { EmptyState } from "./ui-common";
import type { HotelFloorAreaRecord, HotelFloorRecord, JobRecord, OperationalRecord } from "./types";

type OperationAreaTone = "occupied" | "vacant" | "department" | "meeting" | "area";
type NormalizedAreaKind = "ROOM" | "SALON" | "DEPARTMENT_AREA" | "GENERAL_AREA";

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

type AreaActivity = {
  id: string;
  sourceLabel: string;
  title: string;
  detail: string;
  owner: string;
  due: string;
  status: string;
  risk: AreaIssueCard["risk"];
};

type ScheduledRoomEntry = {
  scheduledAt: number;
  guestName: string;
  note: string;
  activatedAt?: number;
  exitScheduledAt?: number;
  exitActivatedAt?: number;
  exitNote?: string;
};

type ScheduledRoomExit = {
  scheduledAt: number;
  note: string;
};

type AreaView = {
  key: string;
  floor: HotelFloorRecord;
  area: HotelFloorAreaRecord;
  status: AreaStatus;
  issueCards: AreaIssueCard[];
  meetingPlan: MeetingPlan | null;
  guestPlan: string;
  records: OperationalRecord[];
  jobs: JobRecord[];
  activities: AreaActivity[];
  roomEntry?: ScheduledRoomEntry;
};

export function HotelOperationBoard({
  canViewFullPlan,
  departmentLabelFor,
  departmentShortCodeFor,
  floors,
  jobs,
  onSelectArea,
  onSelectFloorLevel,
  onToggleShowAllFloors,
  records,
  selectedFloorLevel,
  sessionDepartmentId,
  showAllFloors
}: {
  canViewFullPlan: boolean;
  departmentLabelFor: (departmentId: string) => string;
  departmentShortCodeFor?: (departmentId: string) => string;
  floors: HotelFloorRecord[];
  jobs: JobRecord[];
  onSelectArea: (area: HotelFloorAreaRecord) => void;
  onSelectFloorLevel: (level: string) => void;
  onToggleShowAllFloors: () => void;
  records: OperationalRecord[];
  selectedFloorLevel: string;
  sessionDepartmentId: string;
  showAllFloors: boolean;
}) {
  const [expandedAreaKey, setExpandedAreaKey] = useState("");
  const [detailAreaKey, setDetailAreaKey] = useState("");
  const [entryAreaKey, setEntryAreaKey] = useState("");
  const [roomEntries, setRoomEntries] = useState<Record<string, ScheduledRoomEntry>>({});
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const shortCodeFor = useMemo(
    () => departmentShortCodeFor ?? ((departmentId: string) => departmentAbbreviationFor(departmentId, departmentLabelFor)),
    [departmentLabelFor, departmentShortCodeFor]
  );
  const selectedFloor = floors.find((floor) => String(floor.level) === selectedFloorLevel) ?? floors[0];
  const displayedFloors = showAllFloors ? floors : selectedFloor ? [selectedFloor] : [];
  const areaSummaries = floors.flatMap((floor) => floor.areas.map((area) => {
    const view = areaViewFor(floor, area, records, jobs, departmentLabelFor, shortCodeFor, roomEntries[areaKeyFor(floor, area)], nowTick);
    return {
      area,
      floor,
      status: view.status,
      issueCount: view.issueCards.length,
      meetingPlan: view.meetingPlan
    };
  }));
  const occupiedCount = areaSummaries.filter((item) => item.status.tone === "occupied").length;
  const vacantCount = areaSummaries.filter((item) => item.status.tone === "vacant").length;
  const departmentCount = areaSummaries.filter((item) => item.status.tone === "department").length;
  const issueCount = areaSummaries.reduce((sum, item) => sum + item.issueCount, 0);
  const salonCount = areaSummaries.filter((item) => normalizedAreaKind(item.area) === "SALON").length;
  const detailView = useMemo(() => {
    if (!detailAreaKey) return null;
    for (const floor of floors) {
      const area = floor.areas.find((candidate) => areaKeyFor(floor, candidate) === detailAreaKey);
      if (area) return areaViewFor(floor, area, records, jobs, departmentLabelFor, shortCodeFor, roomEntries[areaKeyFor(floor, area)], nowTick);
    }
    return null;
  }, [departmentLabelFor, detailAreaKey, floors, jobs, nowTick, records, roomEntries, shortCodeFor]);
  const entryView = useMemo(() => {
    if (!entryAreaKey) return null;
    for (const floor of floors) {
      const area = floor.areas.find((candidate) => areaKeyFor(floor, candidate) === entryAreaKey);
      if (area) return areaViewFor(floor, area, records, jobs, departmentLabelFor, shortCodeFor, roomEntries[areaKeyFor(floor, area)], nowTick);
    }
    return null;
  }, [departmentLabelFor, entryAreaKey, floors, jobs, nowTick, records, roomEntries, shortCodeFor]);

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
          <span className="hotel-operation-legend-item meeting">Salon</span>
          <span className="hotel-operation-legend-item department">Departmanda</span>
          <span className="hotel-operation-legend-item area">Alan</span>
        </div>
      </div>

      <div className="hotel-operation-summary-grid">
        <SummaryCard icon={<Users size={18} />} label="Dolu" value={occupiedCount} tone="occupied" />
        <SummaryCard icon={<Home size={18} />} label="Boş" value={vacantCount} tone="vacant" />
        <SummaryCard icon={<Wrench size={18} />} label="Departmanda" value={departmentCount} tone="department" />
        <SummaryCard icon={<AlertTriangle size={18} />} label="Açık Aksiyon" value={issueCount} tone={issueCount ? "attention" : "vacant"} />
        <SummaryCard icon={<CalendarDays size={18} />} label="Salon" value={salonCount} tone="meeting" />
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
                      const view = areaViewFor(floor, area, records, jobs, departmentLabelFor, shortCodeFor, roomEntries[areaKeyFor(floor, area)], nowTick);
                      const isExpanded = expandedAreaKey === view.key;
                      const canManageRoomEntry = canDepartmentEnterRoom(view.area, sessionDepartmentId);
                      const entryBlockedReason = roomEntryBlockedReason(view, sessionDepartmentId, nowTick);
                      const dockTileStatus = shouldDockTileStatus(view);
                      const tileMetaLabels = tileMetaLabelsForView(view);
                      return (
                        <div
                          className={`hotel-operation-area-cell ${isExpanded ? "expanded" : ""}`}
                          key={view.key}
                        >
                          <button
                            type="button"
                            className={`hotel-operation-area-tile ${view.status.tone}`}
                            onClick={() => setExpandedAreaKey((current) => current === view.key ? "" : view.key)}
                            aria-expanded={isExpanded}
                          >
                          <span className="hotel-operation-tile-main">
                            <span className="hotel-operation-tile-head">
                              <strong>{area.label}</strong>
                              {!dockTileStatus ? <span className={`hotel-operation-status ${view.status.tone}`}>{view.status.label}</span> : null}
                            </span>
                            {view.guestPlan ? (
                              <span className="hotel-operation-note">
                                <Clock size={13} /> {view.guestPlan}
                              </span>
                            ) : null}
                            {view.meetingPlan ? (
                              <span className="hotel-operation-note meeting">
                                <CalendarDays size={13} /> {view.meetingPlan.time} · {view.meetingPlan.needs}
                              </span>
                            ) : null}
                            {dockTileStatus || tileMetaLabels.length ? (
                              <span className="hotel-operation-meta-row">
                                {dockTileStatus ? <span className={`hotel-operation-status ${view.status.tone}`}>{view.status.label}</span> : null}
                                {tileMetaLabels.map((label) => <span key={label}>{label}</span>)}
                              </span>
                            ) : null}
                          </span>
                          {view.issueCards.length ? (
                            <span className="hotel-operation-compact-alert">{view.issueCards.length} açık kayıt</span>
                          ) : null}
                        </button>
                        {isExpanded ? (
                          <AreaNotePaper
                            canManageRoomEntry={canManageRoomEntry}
                            entryBlockedReason={entryBlockedReason}
                            view={view}
                            onEdit={() => onSelectArea(area)}
                            onOpenEntry={() => {
                              if (!entryBlockedReason) setEntryAreaKey(view.key);
                            }}
                            onDetails={() => {
                              setDetailAreaKey(view.key);
                            }}
                          />
                        ) : null}
                      </div>
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
      {detailView ? <AreaDetailModal view={detailView} onClose={() => setDetailAreaKey("")} /> : null}
      {entryView && canDepartmentEnterRoom(entryView.area, sessionDepartmentId) && !roomEntryBlockedReason(entryView, sessionDepartmentId, nowTick) ? (
        <RoomEntryModal
          departmentLabelFor={departmentLabelFor}
          view={entryView}
          onActivate={(entry) => {
            setRoomEntries((current) => ({
              ...current,
              [entryView.key]: { ...entry, scheduledAt: Math.min(entry.scheduledAt, Date.now()), activatedAt: Date.now() }
            }));
            setNowTick(Date.now());
            setEntryAreaKey("");
          }}
          onActivateExit={(exit) => {
            setRoomEntries((current) => {
              const currentEntry = current[entryView.key] ?? entryView.roomEntry;
              if (!currentEntry) return current;
              return {
                ...current,
                [entryView.key]: {
                  ...currentEntry,
                  exitScheduledAt: Date.now(),
                  exitActivatedAt: Date.now(),
                  exitNote: exit.note
                }
              };
            });
            setNowTick(Date.now());
            setEntryAreaKey("");
          }}
          onClose={() => setEntryAreaKey("")}
          onSchedule={(entry) => {
            setRoomEntries((current) => ({ ...current, [entryView.key]: entry }));
            setNowTick(Date.now());
            setEntryAreaKey("");
          }}
          onScheduleExit={(exit) => {
            setRoomEntries((current) => {
              const currentEntry = current[entryView.key] ?? entryView.roomEntry;
              if (!currentEntry) return current;
              return {
                ...current,
                [entryView.key]: {
                  ...currentEntry,
                  exitScheduledAt: exit.scheduledAt,
                  exitActivatedAt: undefined,
                  exitNote: exit.note
                }
              };
            });
            setNowTick(Date.now());
            setEntryAreaKey("");
          }}
        />
      ) : null}
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

function normalizedAreaKind(area: HotelFloorAreaRecord): NormalizedAreaKind {
  if (area.kind === "ROOM" || area.kind === "SALON" || area.kind === "DEPARTMENT_AREA" || area.kind === "GENERAL_AREA") {
    return area.kind;
  }
  const label = area.label.trim();
  if (/^\d/.test(label)) return "ROOM";
  if (/^[A-Za-zÇĞİÖŞÜçğıöşü]/.test(label)) return "SALON";
  return "GENERAL_AREA";
}

function areaKindLabel(area: HotelFloorAreaRecord) {
  const kind = normalizedAreaKind(area);
  if (kind === "ROOM") return "Oda";
  if (kind === "SALON") return "Salon";
  if (kind === "DEPARTMENT_AREA") return "Departman Alanı";
  return "Alan";
}

function tileMetaLabelsForView(view: AreaView) {
  const statusLabel = view.status.label.trim().toLocaleLowerCase("tr-TR");
  const seen = new Set<string>();
  return [areaKindLabel(view.area), view.status.departmentLabel].reduce<string[]>((labels, label) => {
    const trimmed = label?.trim();
    if (!trimmed) return labels;
    const normalized = trimmed.toLocaleLowerCase("tr-TR");
    if (normalized === statusLabel || seen.has(normalized)) return labels;
    seen.add(normalized);
    labels.push(trimmed);
    return labels;
  }, []);
}

function shouldDockTileStatus(view: AreaView) {
  return view.status.label.trim().toLocaleLowerCase("tr-TR") === areaKindLabel(view.area).toLocaleLowerCase("tr-TR");
}

function uniqueDepartmentIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

function roomEntryDepartmentIdsForArea(area: HotelFloorAreaRecord) {
  if (normalizedAreaKind(area) !== "ROOM") return [];
  return uniqueDepartmentIds(area.roomEntryDepartmentIds ?? ["frontOffice"]);
}

function canDepartmentEnterRoom(area: HotelFloorAreaRecord, departmentId: string) {
  return roomEntryDepartmentIdsForArea(area).includes(departmentId);
}

function activeTechnicalOrHousekeepingJobs(jobs: JobRecord[]) {
  return jobs.filter((job) => {
    const text = `${job.type} ${job.title} ${job.description} ${job.tags}`.toLocaleLowerCase("tr-TR");
    return job.departmentId === "technical"
      || job.departmentId === "housekeeping"
      || job.type === "Fault"
      || job.type === "PlannedMaintenance"
      || job.type === "PlannedHousekeeping"
      || text.includes("arıza")
      || text.includes("ariza")
      || text.includes("temizlik")
      || text.includes("bakım");
  });
}

function roomEntryBlockedReason(view: AreaView, departmentId: string, nowMs: number) {
  if (normalizedAreaKind(view.area) !== "ROOM") return "";
  if (!canDepartmentEnterRoom(view.area, departmentId)) return "";
  if (hasRoomEntryDefined(view.roomEntry, nowMs)) return "";
  const blockingJobs = activeTechnicalOrHousekeepingJobs(view.jobs);
  if (blockingJobs.length && !view.area.allowGuestAssignmentDuringWork) return "Teknik/HK işi aktif";
  return "";
}

function AreaNotePaper({
  canManageRoomEntry,
  entryBlockedReason,
  onDetails,
  onEdit,
  onOpenEntry,
  view
}: {
  canManageRoomEntry: boolean;
  entryBlockedReason: string;
  onDetails: () => void;
  onEdit: () => void;
  onOpenEntry: () => void;
  view: AreaView;
}) {
  const visibleIssues = view.issueCards.slice(0, 4);
  const hasOpenEntry = hasRoomEntryDefined(view.roomEntry);
  const noteSummary = noteSummaryForArea(view);

  return (
    <div className="hotel-operation-note-paper">
      <div className="hotel-operation-note-paper-status">
        <span className={`hotel-operation-status ${view.status.tone}`}>{view.status.label}</span>
        <span>{view.area.label}</span>
      </div>
      <div className="hotel-operation-note-actions">
        {normalizedAreaKind(view.area) === "ROOM" && canManageRoomEntry ? (
          <button type="button" className="btn btn-primary btn-sm hotel-operation-note-action" onClick={onOpenEntry} disabled={Boolean(entryBlockedReason)} title={entryBlockedReason || undefined}>
            {hasOpenEntry ? <LogOut size={13} /> : <LogIn size={13} />}
            {entryBlockedReason ? "Misafir girişi bloklu" : hasOpenEntry ? "Misafir çıkışı aç" : "Misafir girişi aç"}
          </button>
        ) : null}
        <button type="button" className="btn btn-secondary btn-sm hotel-operation-note-action" onClick={onEdit}>
          <PenLine size={13} /> Alanı düzenlemeye al
        </button>
        <button type="button" className="btn btn-secondary btn-sm hotel-operation-note-action" onClick={onDetails}>
          <ClipboardList size={13} /> Detaylar
        </button>
      </div>
      {noteSummary ? (
        <div className="hotel-operation-note-paper-body">
          <p>{noteSummary}</p>
        </div>
      ) : null}
      {visibleIssues.length ? (
        <div className="hotel-operation-request-timeline" aria-label="Açık iş talepleri">
          {visibleIssues.map((issue) => (
            <span className={`hotel-operation-request-row ${issue.risk}`} key={issue.id}>
              <span className="hotel-operation-request-dot" />
              <span>
                <strong>{issue.label}</strong>
                <small>{issue.title}</small>
              </span>
            </span>
          ))}
        </div>
      ) : (
        <div className="hotel-operation-note-paper-empty">
          <CheckCircle2 size={14} /> Açık iş talebi yok
        </div>
      )}
    </div>
  );
}

function RoomEntryModal({
  departmentLabelFor,
  onActivate,
  onActivateExit,
  onClose,
  onSchedule,
  onScheduleExit,
  view
}: {
  departmentLabelFor: (departmentId: string) => string;
  onActivate: (entry: ScheduledRoomEntry) => void;
  onActivateExit: (exit: ScheduledRoomExit) => void;
  onClose: () => void;
  onSchedule: (entry: ScheduledRoomEntry) => void;
  onScheduleExit: (exit: ScheduledRoomExit) => void;
  view: AreaView;
}) {
  const titleId = `hotel-operation-entry-${view.key}`;
  const nowMs = Date.now();
  const hasOpenEntry = hasRoomEntryDefined(view.roomEntry, nowMs);
  const defaultScheduledAt = hasOpenEntry ? view.roomEntry?.scheduledAt ?? nextWholeHourTimestamp() : nextWholeHourTimestamp();
  const [guestName, setGuestName] = useState(hasOpenEntry ? "" : view.roomEntry?.guestName ?? "");
  const [note, setNote] = useState(hasOpenEntry ? "" : view.roomEntry?.note ?? "");
  const [scheduledAt, setScheduledAt] = useState(datetimeLocalValueForDate(defaultScheduledAt));
  const [plannedExitAt, setPlannedExitAt] = useState(hasOpenEntry || !view.roomEntry?.exitScheduledAt ? "" : datetimeLocalValueForDate(view.roomEntry.exitScheduledAt));
  const [exitScheduledAt, setExitScheduledAt] = useState(datetimeLocalValueForDate(view.roomEntry?.exitScheduledAt && !isRoomStayExited(view.roomEntry, nowMs) ? view.roomEntry.exitScheduledAt : nextWholeHourTimestamp()));
  const [exitNote, setExitNote] = useState(view.roomEntry?.exitNote ?? "");
  const [error, setError] = useState("");
  const entryDraft = (): ScheduledRoomEntry => {
    const parsedScheduledAt = timestampForDatetimeLocal(scheduledAt, Date.now());
    const draft: ScheduledRoomEntry = {
      scheduledAt: parsedScheduledAt,
      guestName: guestName.trim(),
      note: note.trim()
    };
    if (plannedExitAt) {
      draft.exitScheduledAt = timestampForDatetimeLocal(plannedExitAt, parsedScheduledAt);
    }
    return draft;
  };
  const exitDraft = (): ScheduledRoomExit => ({
    scheduledAt: timestampForDatetimeLocal(exitScheduledAt, nextWholeHourTimestamp()),
    note: exitNote.trim()
  });
  const validateEntryDraft = (entry: ScheduledRoomEntry, immediate: boolean) => {
    const effectiveEntryAt = immediate ? Date.now() : entry.scheduledAt;
    if (entry.exitScheduledAt && entry.exitScheduledAt <= effectiveEntryAt) {
      setError("Planlanan misafir çıkış saati misafir giriş saatinden sonra olmalı.");
      return false;
    }
    setError("");
    return true;
  };
  const validateExitDraft = (exit: ScheduledRoomExit) => {
    const earliestExitAt = Math.max(Date.now(), view.roomEntry?.activatedAt ?? view.roomEntry?.scheduledAt ?? Date.now());
    if (exit.scheduledAt <= earliestExitAt) {
      setError("Planlanan misafir çıkış saati şu andan ve misafir giriş saatinden sonra olmalı.");
      return false;
    }
    setError("");
    return true;
  };
  const modalTitle = hasOpenEntry ? `${view.area.label} misafir çıkışı` : `${view.area.label} misafir girişi`;
  const modalIcon = hasOpenEntry ? <LogOut size={20} /> : <LogIn size={20} />;
  const closeLabel = hasOpenEntry ? "Misafir çıkışı penceresini kapat" : "Misafir girişi penceresini kapat";
  const handleScheduleEntry = () => {
    const draft = entryDraft();
    if (validateEntryDraft(draft, false)) onSchedule(draft);
  };
  const handleActivateEntry = () => {
    const draft = entryDraft();
    if (validateEntryDraft(draft, true)) onActivate(draft);
  };
  const handleScheduleExit = () => {
    const draft = exitDraft();
    if (validateExitDraft(draft)) onScheduleExit(draft);
  };
  const handleActivateExit = () => {
    setError("");
    onActivateExit({ scheduledAt: Date.now(), note: exitNote.trim() });
  };
  const authorizedRoomEntryLabels = roomEntryDepartmentIdsForArea(view.area)
    .map((departmentId) => departmentLabelFor(departmentId))
    .join(", ") || "Yetkili departman yok";

  return (
    <div className="app-modal-overlay hotel-operation-entry-overlay" role="presentation" onClick={onClose}>
      <section className="app-modal hotel-operation-entry-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <header className="app-modal-header">
          <div className="app-modal-title-row">
            <span className="app-modal-title-icon">
              {modalIcon}
            </span>
            <div>
              <span className="app-modal-eyebrow">{view.floor.name || defaultFloorName(view.floor.level)}</span>
              <h3 className="app-modal-title" id={titleId}>{modalTitle}</h3>
            </div>
          </div>
          <button type="button" className="app-modal-close" onClick={onClose} aria-label={closeLabel}>
            <X size={18} />
          </button>
        </header>
        <form className="app-modal-body hotel-operation-entry-form" onSubmit={(event) => {
          event.preventDefault();
          if (hasOpenEntry) {
            handleScheduleExit();
          } else {
            handleScheduleEntry();
          }
        }}>
          <label className="form-group ui-form-compact">
            <span className="form-label">Oda</span>
            <input className="form-control" value={view.area.label} readOnly />
          </label>
          {hasOpenEntry ? (
            <>
              <div className="hotel-operation-entry-authority" aria-label="Tanımlı misafir girişi">
                <span>Tanımlı misafir girişi</span>
                <strong>{formatScheduledEntryDate(view.roomEntry?.activatedAt ?? view.roomEntry?.scheduledAt ?? Date.now())}</strong>
                <small>{view.roomEntry?.activatedAt ? "Anında misafir girişi yapıldı" : "Saatli misafir giriş planı"}</small>
              </div>
              <label className="form-group ui-form-compact">
                <span className="form-label">Planlanan misafir çıkış tarihi ve saati</span>
                <input className="form-control" type="datetime-local" value={exitScheduledAt} onChange={(event) => setExitScheduledAt(event.target.value)} required />
              </label>
              <label className="form-group hotel-operation-entry-note">
                <span className="form-label">Misafir çıkış notu</span>
                <textarea className="form-control" rows={3} value={exitNote} onChange={(event) => setExitNote(event.target.value)} placeholder="Misafir çıkış notu" />
              </label>
            </>
          ) : (
            <>
              <label className="form-group ui-form-compact">
                <span className="form-label">Misafir adı</span>
                <input className="form-control" value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Misafir adı" />
              </label>
              <label className="form-group ui-form-compact">
                <span className="form-label">Planlanan misafir giriş tarihi ve saati</span>
                <input className="form-control" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required />
              </label>
              <label className="form-group ui-form-compact">
                <span className="form-label">Planlanan misafir çıkış tarihi ve saati</span>
                <input className="form-control" type="datetime-local" value={plannedExitAt} onChange={(event) => setPlannedExitAt(event.target.value)} />
              </label>
              <div className="hotel-operation-entry-authority" aria-label="Misafir girişi yetkilendirme bilgisi">
                <span>İK tanımlı yetki</span>
                <strong>{authorizedRoomEntryLabels}</strong>
                <small>Misafir giriş/çıkışını yalnız bu departman yönetebilir.</small>
              </div>
              <label className="form-group hotel-operation-entry-note">
                <span className="form-label">Misafir giriş notu</span>
                <textarea className="form-control" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Misafir giriş notu" />
              </label>
            </>
          )}
          {error ? <div className="hotel-operation-entry-error">{error}</div> : null}
          <div className="modal-actions hotel-operation-entry-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Vazgeç</button>
            <button type="submit" className="btn btn-secondary">{hasOpenEntry ? "Misafir Çıkışını Planla" : "Misafir Girişini Planla"}</button>
            <button type="button" className="btn btn-primary hotel-operation-entry-now" onClick={hasOpenEntry ? handleActivateExit : handleActivateEntry}>
              {hasOpenEntry ? <LogOut size={14} /> : <LogIn size={14} />}
              {hasOpenEntry ? "Misafir çıkışını yap" : "Misafir girişini yap"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AreaDetailModal({ onClose, view }: { onClose: () => void; view: AreaView }) {
  const titleId = `hotel-operation-detail-${view.key}`;

  return (
    <div className="app-modal-overlay hotel-operation-detail-overlay" role="presentation" onClick={onClose}>
      <section className="app-modal hotel-operation-detail-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <header className="app-modal-header">
          <div className="app-modal-title-row">
            <span className="app-modal-title-icon">
              {isMeetingArea(view.area) ? <CalendarDays size={20} /> : <Home size={20} />}
            </span>
            <div>
              <span className="app-modal-eyebrow">{view.floor.name || defaultFloorName(view.floor.level)}</span>
              <h3 className="app-modal-title" id={titleId}>{view.area.label} Detayları</h3>
            </div>
          </div>
          <button type="button" className="app-modal-close" onClick={onClose} aria-label="Detay penceresini kapat">
            <X size={18} />
          </button>
        </header>
        <div className="app-modal-body hotel-operation-detail-body">
          <div className="hotel-operation-detail-grid">
            <DetailMetric label="Durum" value={view.status.label} tone={view.status.tone} />
            <DetailMetric label="Açık kayıt" value={String(view.issueCards.length)} tone={view.issueCards.length ? "attention" : "vacant"} />
            <DetailMetric label="Aktivite" value={String(view.activities.length)} tone="meeting" />
          </div>

          <section className="hotel-operation-detail-section">
            <h4>Plan ve Not</h4>
            <div className="hotel-operation-detail-plan">
              {view.guestPlan ? <p><Clock size={14} /> {view.guestPlan}</p> : null}
              {view.meetingPlan ? <p><CalendarDays size={14} /> {view.meetingPlan.time} · {view.meetingPlan.needs}</p> : null}
              {!view.guestPlan && !view.meetingPlan ? <p>Misafir girişi veya toplantı planı yok.</p> : null}
            </div>
          </section>

          <section className="hotel-operation-detail-section">
            <h4>Alan Aktiviteleri</h4>
            {view.activities.length ? (
              <div className="hotel-operation-activity-list">
                {view.activities.map((activity) => (
                  <article className={`hotel-operation-activity-row ${activity.risk}`} key={activity.id}>
                    <span className="hotel-operation-issue-label">{activity.sourceLabel}</span>
                    <div>
                      <strong>{activity.title}</strong>
                      <small>{activity.detail || "Detay notu yok"}</small>
                    </div>
                    <div>
                      <small>Sorumlu</small>
                      <span>{activity.owner || "Atama bekliyor"}</span>
                    </div>
                    <div>
                      <small>Hedef</small>
                      <span>{activity.due}</span>
                    </div>
                    <div>
                      <small>Durum</small>
                      <span>{activity.status}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="app-modal-empty">Bu oda veya alan için açık aktivite yok.</div>
            )}
          </section>

          {view.issueCards.length ? (
            <section className="hotel-operation-detail-section">
              <h4>Bekleyen Kartlar</h4>
              <div className="hotel-operation-issue-list expanded">
                {view.issueCards.map((issue) => (
                  <span key={issue.id} className={`hotel-operation-issue-card ${issue.risk}`}>
                    <span className="hotel-operation-issue-label">{issue.label}</span>
                    <strong>{issue.title}</strong>
                    <small>{issue.detail}</small>
                    <small>{issue.due}</small>
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function DetailMetric({ label, tone, value }: { label: string; tone: string; value: string }) {
  return (
    <div className={`hotel-operation-detail-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function areaViewFor(
  floor: HotelFloorRecord,
  area: HotelFloorAreaRecord,
  records: OperationalRecord[],
  jobs: JobRecord[],
  departmentLabelFor: (departmentId: string) => string,
  departmentShortCodeFor: (departmentId: string) => string,
  roomEntry?: ScheduledRoomEntry,
  nowMs = Date.now()
): AreaView {
  const areaRecords = recordsForArea(area, records);
  const areaJobs = activeJobsForArea(area, jobs);
  const baseStatus = statusForArea(area, areaRecords, areaJobs, departmentLabelFor);
  const status = isRoomEntryActive(roomEntry, nowMs)
    ? { label: "Dolu", tone: "occupied" as const }
    : baseStatus;

  return {
    key: areaKeyFor(floor, area),
    floor,
    area,
    status,
    issueCards: issueCardsForArea(areaRecords, areaJobs, departmentLabelFor, departmentShortCodeFor),
    meetingPlan: meetingPlanForArea(area, areaRecords, areaJobs),
    guestPlan: guestPlanForArea(area, status, areaRecords, areaJobs, roomEntry, nowMs),
    records: areaRecords,
    jobs: areaJobs,
    activities: activityItemsForArea(areaRecords, areaJobs, departmentLabelFor, departmentShortCodeFor),
    roomEntry
  };
}

function activityItemsForArea(
  records: OperationalRecord[],
  jobs: JobRecord[],
  departmentLabelFor: (departmentId: string) => string,
  departmentShortCodeFor: (departmentId: string) => string
): AreaActivity[] {
  const jobActivities = jobs.map((job) => ({
    id: `job-activity-${job.id}`,
    sourceLabel: departmentRouteLabelForJob(job, departmentShortCodeFor),
    title: job.title,
    detail: job.description || job.tags,
    owner: [departmentLabelFor(job.departmentId), job.assignee].filter(Boolean).join(" · "),
    due: targetDateLabel(job.due),
    status: job.status,
    risk: job.priority === "Urgent" || job.slaRisk ? "urgent" : job.priority === "High" || job.status === "Delayed" ? "high" : "normal"
  } satisfies AreaActivity));

  const recordActivities = records
    .filter((record) => shouldShowOperationalRecordForArea(record, jobs) && (!isVacantStatus(record.status) || Boolean(record.detail || record.meta)))
    .map((record) => ({
      id: `record-activity-${record.id}`,
      sourceLabel: issueLabelForStatus(record.status),
      title: record.status,
      detail: record.detail || record.meta,
      owner: record.owner,
      due: targetDateLabel(record.due),
      status: record.status,
      risk: record.risk
    } satisfies AreaActivity));

  return [...jobActivities, ...recordActivities];
}

function noteSummaryForArea(view: AreaView) {
  const leadIssue = view.issueCards[0];
  const kind = normalizedAreaKind(view.area);
  if (view.meetingPlan) return `${view.meetingPlan.time} planı var. İhtiyaç: ${view.meetingPlan.needs}`;
  if (view.status.tone === "occupied") return view.guestPlan;
  if (leadIssue) return `${leadIssue.label} bekliyor: ${leadIssue.title}.`;
  if (view.status.tone === "department") return `${view.status.departmentLabel || "Departman"} üzerinde işlemde.`;
  if (kind === "ROOM") return "Oda boş, açık aksiyon görünmüyor.";
  if (kind === "SALON") return "Salon hazır, etkinlik veya aksiyon beklemiyor.";
  if (kind === "DEPARTMENT_AREA") return "Departman alanı hazır, açık aksiyon görünmüyor.";
  return "Alan hazır, açık aksiyon görünmüyor.";
}

function areaKeyFor(floor: HotelFloorRecord, area: HotelFloorAreaRecord) {
  return `${floor.level}-${area.id}-${area.label}`;
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
  const kind = normalizedAreaKind(area);

  if (kind === "ROOM" && (statusText.includes("dolu") || jobs.some((job) => job.guestImpact && !isDepartmentWorkJob(job)))) {
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

  if (kind === "SALON") {
    return { label: "Salon", tone: "meeting" };
  }

  if (kind === "DEPARTMENT_AREA") {
    return { label: "Departman Alanı", tone: "department" };
  }

  if (kind === "GENERAL_AREA") {
    return { label: "Alan", tone: "area" };
  }

  return { label: "Boş", tone: "vacant" };
}

function issueCardsForArea(
  records: OperationalRecord[],
  jobs: JobRecord[],
  departmentLabelFor: (departmentId: string) => string,
  departmentShortCodeFor: (departmentId: string) => string
): AreaIssueCard[] {
  const jobCards = jobs.map((job) => ({
    id: `job-${job.id}`,
    label: departmentRouteLabelForJob(job, departmentShortCodeFor),
    title: job.title,
    detail: `${issueLabelForJob(job)} · ${departmentLabelFor(job.departmentId)}`,
    due: targetDateLabel(job.due, true),
    risk: job.priority === "Urgent" || job.slaRisk ? "urgent" : job.priority === "High" || job.status === "Delayed" ? "high" : "normal"
  } satisfies AreaIssueCard));
  const recordCards = records
    .filter((record) => shouldShowOperationalRecordForArea(record, jobs) && !isVacantStatus(record.status) && !record.status.includes("Tamamlandı"))
    .map((record) => ({
      id: `record-${record.id}`,
      label: issueLabelForStatus(record.status),
      title: record.status,
      detail: record.meta || record.detail,
      due: targetDateLabel(record.due, true),
      risk: record.risk
    } satisfies AreaIssueCard));
  return [...jobCards, ...recordCards];
}

function shouldShowOperationalRecordForArea(record: OperationalRecord, jobs: JobRecord[]) {
  if (!jobs.length) return true;
  return !jobs.some((job) => operationalRecordMatchesJob(record, job));
}

function operationalRecordMatchesJob(record: OperationalRecord, job: JobRecord) {
  const recordText = searchableOperationText(record.title, record.meta, record.detail, record.status);
  const jobText = searchableOperationText(job.title, job.description, job.tags, job.room, job.location, job.locationDetail);
  const recordPhrases = [record.meta, record.detail, operationAreaLabelFromRecord(record.title)]
    .map((value) => searchableOperationText(value))
    .filter((phrase) => phrase.length >= 6);
  const jobPhrases = [job.title, job.description]
    .map((value) => searchableOperationText(value))
    .filter((phrase) => phrase.length >= 6);

  return recordPhrases.some((phrase) => jobText.includes(phrase)) || jobPhrases.some((phrase) => recordText.includes(phrase));
}

function guestPlanForArea(
  area: HotelFloorAreaRecord,
  status: AreaStatus,
  records: OperationalRecord[],
  jobs: JobRecord[],
  roomEntry?: ScheduledRoomEntry,
  nowMs = Date.now()
) {
  if (normalizedAreaKind(area) !== "ROOM") return "";
  if (roomEntry) {
    if (isRoomStayExited(roomEntry, nowMs)) return "";
    const guestLabel = roomEntry.guestName ? `Misafir · ${roomEntry.guestName}` : "";
    const exitLabel = roomEntry.exitScheduledAt ? `Misafir çıkış planı · ${formatScheduledEntryDate(roomEntry.exitScheduledAt)}` : "";
    if (isRoomEntryActive(roomEntry, nowMs)) return [exitLabel, guestLabel].filter(Boolean).join(" · ");
    return [`Planlanan misafir girişi · ${formatScheduledEntryDate(roomEntry.scheduledAt)}`, exitLabel, guestLabel].filter(Boolean).join(" · ");
  }
  const guestImpactJob = jobs.find((job) => job.guestImpact && !isDepartmentWorkJob(job));
  if (status.tone === "occupied") {
    const scheduleValue = records[0]?.due || guestImpactJob?.due;
    if (!scheduleValue?.trim()) return "Misafir var";
    const sourceText = [
      scheduleValue,
      records[0]?.meta,
      records[0]?.detail,
      guestImpactJob?.description
    ].filter(Boolean).join(" ");
    const time = findTime(sourceText);
    const day = dateOrDayLabel(scheduleValue);
    return `Misafir var · misafir girişi ${time ? `${day} ${time}` : day}`;
  }
  if (status.tone === "department") return "";
  return "Misafir giriş planı yok";
}

function meetingPlanForArea(area: HotelFloorAreaRecord, records: OperationalRecord[], jobs: JobRecord[]): MeetingPlan | null {
  if (!isMeetingArea(area)) return null;
  const jobSource = jobs[0];
  const recordSource = records[0];
  if (!jobSource && !recordSource) return null;
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

function departmentRouteLabelForJob(job: JobRecord, departmentShortCodeFor: (departmentId: string) => string) {
  const target = departmentShortCodeFor(job.departmentId);
  const source = job.createdByDepartmentId
    ? departmentShortCodeFor(job.createdByDepartmentId)
    : target;
  return source === target ? source : `${source} > ${target}`;
}

function departmentAbbreviationFor(departmentId: string, departmentLabelFor: (departmentId: string) => string) {
  const fixed: Record<string, string> = {
    executive: "GM",
    hr: "IK",
    technical: "TK",
    housekeeping: "HK",
    frontOffice: "OB",
    security: "GUV",
    spa: "SPA",
    sales: "SAT",
    fnb: "F&B"
  };
  if (fixed[departmentId]) return fixed[departmentId];
  const label = departmentLabelFor(departmentId).trim();
  const parts = label
    .replace(/&/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length > 1) {
    return parts.map((part) => part[0]).join("").slice(0, 3).toLocaleUpperCase("tr-TR");
  }
  return (label || departmentId).replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ]/g, "").slice(0, 3).toLocaleUpperCase("tr-TR");
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
  return normalizedAreaKind(area) === "SALON";
}

function operationAreaLabelFromRecord(title: string) {
  return title.replace(/^Oda\s+/i, "").trim();
}

function floorPlanAreaKey(label: string) {
  return label.trim().toLocaleLowerCase("tr-TR");
}

function searchableOperationText(...values: Array<string | undefined>) {
  return values
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function defaultFloorName(level: number) {
  if (level === 0) return "L Zemin Kat";
  if (level > 0) return `${level}. Kat`;
  return `${level}. Kat`;
}

function isRoomEntryActive(entry: ScheduledRoomEntry | undefined, nowMs: number) {
  return Boolean(entry && !isRoomStayExited(entry, nowMs) && (entry.activatedAt || entry.scheduledAt <= nowMs));
}

function hasRoomEntryDefined(entry: ScheduledRoomEntry | undefined, nowMs = Date.now()) {
  return Boolean(entry && !isRoomStayExited(entry, nowMs));
}

function isRoomStayExited(entry: ScheduledRoomEntry | undefined, nowMs: number) {
  return Boolean(entry && (entry.exitActivatedAt || (entry.exitScheduledAt && entry.exitScheduledAt <= nowMs)));
}

function nextWholeHourTimestamp() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date.getTime();
}

function datetimeLocalValueForDate(timestamp: number) {
  const date = new Date(timestamp);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function timestampForDatetimeLocal(value: string, fallback: number) {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? fallback : parsed;
}

function formatScheduledEntryDate(timestamp: number) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
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

function targetDateLabel(value?: string, includePrefix = false) {
  if (!value?.trim()) return includePrefix ? "Hedef tanımlı değil" : "Tanımlı değil";
  const dateLabel = formatBoardDate(value);
  return includePrefix ? `Hedef ${dateLabel}` : dateLabel;
}
