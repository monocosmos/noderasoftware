"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ClipboardList, Download, PenLine, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";

type MeterTrackingSession = {
  departmentId: string;
  moduleAccess?: Record<string, boolean>;
};

type DepartmentTableColumn = {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "time" | "status";
};

type DepartmentTableRow = {
  id: string;
  values: Record<string, string>;
  note: string;
  createdAt: string;
  updatedAt: string;
};

type DepartmentTableRecord = {
  id: string;
  departmentId: string;
  departmentName: string;
  slug: string;
  title: string;
  description: string;
  columns: DepartmentTableColumn[];
  showInMenu: boolean;
  enabled: boolean;
  canConfigure: boolean;
  canEditRows: boolean;
  rows: DepartmentTableRow[];
  createdAt: string;
  updatedAt: string;
};

type MeterTrackingPageProps = {
  session: MeterTrackingSession;
  setAlert: (value: string) => void;
};

type ApiRequestOptions = RequestInit & { timeoutMs?: number };

const STORAGE_TOKEN = "hotelops.api.token";
const SESSION_TOKEN = "hotelops.api.session-token";

function apiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window === "undefined") return "http://127.0.0.1:4000";
  if (window.location.port === "3000") return `${window.location.protocol}//${window.location.hostname}:4000`;
  return "/api";
}

function storedApiToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_TOKEN) || window.sessionStorage.getItem(SESSION_TOKEN) || "";
}

async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const { timeoutMs = 12000, ...requestOptions } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(requestOptions.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  const token = storedApiToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...requestOptions,
      headers,
      credentials: "include",
      signal: options.signal ?? controller.signal
    });
  } catch {
    throw new Error("NETWORK_ERROR");
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `API_REQUEST_FAILED_${response.status}`);
  }

  return await response.json() as T;
}

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function monthStartInputValue(offsetMonths = 0) {
  const today = new Date();
  const date = new Date(today.getFullYear(), today.getMonth() + offsetMonths, 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthInputValue() {
  return monthStartInputValue().slice(0, 7);
}

function daysInMonthValue(month: string) {
  const [yearPart, monthPart] = month.split("-");
  const year = Number(yearPart);
  const monthNumber = Number(monthPart);
  if (!year || !monthNumber) return 31;
  return new Date(year, monthNumber, 0).getDate();
}

function meterTrackingColumns(month: string): DepartmentTableColumn[] {
  const dayCount = daysInMonthValue(month);
  return [
    { id: "sayac", label: "Sayaç", type: "text" },
    { id: "birim", label: "Birim", type: "text" },
    ...Array.from({ length: dayCount }, (_, index) => ({
      id: `gun-${index + 1}`,
      label: String(index + 1),
      type: "number" as const
    }))
  ];
}

function departmentTableInputType(type: DepartmentTableColumn["type"]) {
  if (type === "number") return "number";
  if (type === "date") return "date";
  if (type === "time") return "time";
  return "text";
}

function excelCell(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadExcelWorkbook(filename: string, sections: Array<{ title: string; headers: string[]; rows: Array<Array<unknown>> }>) {
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body>${sections.map((section) => `
    <h2>${excelCell(section.title)}</h2>
    <table border="1">
      <thead><tr>${section.headers.map((header) => `<th>${excelCell(header)}</th>`).join("")}</tr></thead>
      <tbody>${section.rows.map((row) => `<tr>${row.map((cell) => `<td>${excelCell(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `).join("<br />")}</body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function EmptyState({ description, title }: { description: string; title: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><ClipboardList size={24} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="empty-state">
          <div className="empty-icon"><ShieldCheck size={24} /></div>
          <h3>Yetki gerekli</h3>
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
}

export function MeterTrackingPage({ session, setAlert }: MeterTrackingPageProps) {
  const [table, setTable] = useState<DepartmentTableRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingRow, setSavingRow] = useState(false);
  const [month, setMonth] = useState(() => monthInputValue());
  const [meterSeedText, setMeterSeedText] = useState("Elektrik Ana Sayaç\nSu Ana Sayaç\nDoğalgaz Ana Sayaç");
  const [newMeterName, setNewMeterName] = useState("");
  const [newMeterUnit, setNewMeterUnit] = useState("");
  const [editingRowId, setEditingRowId] = useState("");
  const [editingRowDraft, setEditingRowDraft] = useState<Record<string, string>>({});
  const [editingRowNote, setEditingRowNote] = useState("");
  const canEdit = session.departmentId === "technical" && session.moduleAccess?.featureMeterTrackingEdit === true;
  const columns = table?.columns ?? meterTrackingColumns(month);

  const loadMeterTracking = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest<{ item: DepartmentTableRecord | null }>("/meter-tracking");
      setTable(response.item);
    } catch {
      setAlert("Sayaç takibi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [setAlert]);

  useEffect(() => {
    if (session.departmentId !== "technical") {
      setLoading(false);
      return;
    }
    void loadMeterTracking();
  }, [loadMeterTracking, session.departmentId]);

  if (session.departmentId !== "technical") {
    return <AccessDenied message="Sayaç Takibi yalnızca teknik departman kullanıcıları için açılır." />;
  }

  const rowValuesFromDraft = (values: Record<string, string>) => (
    Object.fromEntries(columns.map((column) => [column.id, (values[column.id] ?? "").trim()]))
  );

  const replaceRow = (row: DepartmentTableRow) => {
    setTable((current) => current ? { ...current, rows: current.rows.map((item) => (item.id === row.id ? row : item)) } : current);
  };

  const addLocalRow = (row: DepartmentTableRow) => {
    setTable((current) => current ? { ...current, rows: [row, ...current.rows] } : current);
  };

  const createTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || savingTemplate) return;
    const templateColumns = meterTrackingColumns(month);
    const meterNames = meterSeedText
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!meterNames.length && !table) {
      setAlert("En az bir sayaç adı girin.");
      return;
    }

    setSavingTemplate(true);
    try {
      const response = await apiRequest<{ item: DepartmentTableRecord }>("/meter-tracking", {
        method: "PUT",
        body: JSON.stringify({
          title: `Sayaç Takibi ${month}`,
          description: `${month} dönemi teknik sayaç takip şablonu`,
          columns: templateColumns
        })
      });
      let nextTable = response.item;
      if (!table && meterNames.length) {
        const createdRows = await Promise.all(meterNames.map((name) => (
          apiRequest<{ item: DepartmentTableRow }>("/meter-tracking/rows", {
            method: "POST",
            body: JSON.stringify({ values: { sayac: name, birim: "" }, note: "" })
          })
        )));
        nextTable = { ...nextTable, rows: createdRows.map((item) => item.item) };
      }
      setTable(nextTable);
      setAlert(table ? "Aylık sayaç şablonu güncellendi." : "Sayaç takibi şablonu oluşturuldu.");
    } catch {
      setAlert("Sayaç şablonu kaydedilemedi.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const addMeterRow = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!table || !canEdit || savingRow) return;
    const meterName = newMeterName.trim();
    if (!meterName) {
      setAlert("Sayaç adı girin.");
      return;
    }
    setSavingRow(true);
    try {
      const response = await apiRequest<{ item: DepartmentTableRow }>("/meter-tracking/rows", {
        method: "POST",
        body: JSON.stringify({ values: { sayac: meterName, birim: newMeterUnit.trim() }, note: "" })
      });
      addLocalRow(response.item);
      setNewMeterName("");
      setNewMeterUnit("");
      setAlert("Sayaç satırı eklendi.");
    } catch {
      setAlert("Sayaç satırı eklenemedi.");
    } finally {
      setSavingRow(false);
    }
  };

  const startEditRow = (row: DepartmentTableRow) => {
    setEditingRowId(row.id);
    setEditingRowDraft(Object.fromEntries(columns.map((column) => [column.id, row.values[column.id] ?? ""])));
    setEditingRowNote(row.note);
  };

  const saveRow = async (rowId: string) => {
    if (!table || !canEdit) return;
    try {
      const response = await apiRequest<{ item: DepartmentTableRow }>(`/meter-tracking/rows/${encodeURIComponent(rowId)}`, {
        method: "PATCH",
        body: JSON.stringify({ values: rowValuesFromDraft(editingRowDraft), note: editingRowNote.trim() })
      });
      replaceRow(response.item);
      setEditingRowId("");
      setEditingRowDraft({});
      setEditingRowNote("");
      setAlert("Sayaç satırı güncellendi.");
    } catch {
      setAlert("Sayaç satırı güncellenemedi.");
    }
  };

  const deleteRow = async (rowId: string) => {
    if (!table || !canEdit || !window.confirm("Sayaç satırı silinsin mi?")) return;
    try {
      await apiRequest<{ ok: boolean }>(`/meter-tracking/rows/${encodeURIComponent(rowId)}`, { method: "DELETE" });
      setTable({ ...table, rows: table.rows.filter((row) => row.id !== rowId) });
      setAlert("Sayaç satırı silindi.");
    } catch {
      setAlert("Sayaç satırı silinemedi.");
    }
  };

  const exportMeterTracking = () => {
    if (!table) return;
    downloadExcelWorkbook(`nodera-sayac-takibi-${month}.xls`, [{
      title: table.title,
      headers: [...table.columns.map((column) => column.label), "Not", "Güncelleme"],
      rows: table.rows.map((row) => [
        ...table.columns.map((column) => row.values[column.id] ?? ""),
        row.note,
        formatDateTime(row.updatedAt)
      ])
    }]);
  };

  return (
    <div className="ui-list-stack department-table-page">
      <div className="card">
        <div className="card-header">
          <span>
            <span className="card-title">Sayaç Takibi</span>
            <span className="ui-meta">{loading ? "Yükleniyor" : table ? `${table.rows.length} sayaç / ${table.columns.length} kolon` : "Şablon yok"}</span>
          </span>
          <div className="ui-cluster-end">
            {table && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={exportMeterTracking}>
                <Download size={13} /> Exceli İndir
              </button>
            )}
            <span className={`badge ${canEdit ? "badge-completed" : "badge-pending"}`}>
              {canEdit ? "Düzenlenebilir" : "Görüntüleme"}
            </span>
          </div>
        </div>
        <form className="card-body ui-body-form" onSubmit={createTemplate}>
          <div className="form-row">
            <label className="form-group ui-form-compact">
              <span className="form-label">Ay</span>
              <input type="month" className="form-control" value={month} onChange={(event) => setMonth(event.target.value)} disabled={!canEdit} />
            </label>
            <div className="form-group ui-form-compact">
              <span className="form-label">Oluşacak gün sayısı</span>
              <div className="module-helper">{daysInMonthValue(month)} günlük şablon</div>
            </div>
          </div>
          {!table && (
            <label className="form-group ui-form-compact">
              <span className="form-label">Başlangıç sayaçları</span>
              <textarea className="form-control" rows={4} value={meterSeedText} onChange={(event) => setMeterSeedText(event.target.value)} disabled={!canEdit} />
            </label>
          )}
          {canEdit ? (
            <div className="ui-cluster-end">
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingTemplate}>
                <Save size={13} /> {savingTemplate ? "Kaydediliyor" : table ? "Aylık Şablonu Güncelle" : "Şablonu Oluştur"}
              </button>
            </div>
          ) : (
            <div className="module-helper">Bu formu görüntüleyebilirsiniz. Yazma ve düzenleme yetkisi İnsan Kaynakları tarafından verilir.</div>
          )}
        </form>
      </div>

      {table ? (
        <div className="card">
          <div className="card-header">
            <span>
              <span className="card-title">{table.title}</span>
              <span className="ui-meta">{table.description || "Teknik departman sayaç formu"}</span>
            </span>
          </div>
          <div className="card-body ui-list-stack">
            {canEdit && (
              <form className="department-table-row-form" onSubmit={addMeterRow}>
                <label className="department-table-field">
                  <span>Sayaç adı</span>
                  <input className="form-control" value={newMeterName} onChange={(event) => setNewMeterName(event.target.value)} />
                </label>
                <label className="department-table-field">
                  <span>Birim</span>
                  <input className="form-control" value={newMeterUnit} onChange={(event) => setNewMeterUnit(event.target.value)} placeholder="kWh, m3" />
                </label>
                <button type="submit" className="btn btn-primary btn-sm department-table-row-submit" disabled={savingRow}>
                  <Plus size={13} /> {savingRow ? "Ekleniyor" : "Sayaç Ekle"}
                </button>
              </form>
            )}
            <div className="table-scroll department-table-scroll">
              <table className="data-table department-data-table">
                <thead>
                  <tr>
                    {table.columns.map((column) => (
                      <th key={column.id}>{column.label}</th>
                    ))}
                    <th>Not</th>
                    <th>Güncelleme</th>
                    {canEdit && <th>İşlem</th>}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.length ? table.rows.map((row) => {
                    const editing = editingRowId === row.id;
                    return (
                      <tr key={row.id}>
                        {table.columns.map((column) => (
                          <td key={column.id}>
                            {editing ? (
                              <input
                                className="form-control form-control-sm"
                                type={departmentTableInputType(column.type)}
                                value={editingRowDraft[column.id] ?? ""}
                                onChange={(event) => setEditingRowDraft((current) => ({ ...current, [column.id]: event.target.value }))}
                              />
                            ) : (
                              row.values[column.id] || "-"
                            )}
                          </td>
                        ))}
                        <td>
                          {editing ? (
                            <input className="form-control form-control-sm" value={editingRowNote} onChange={(event) => setEditingRowNote(event.target.value)} maxLength={2000} />
                          ) : (
                            row.note || "-"
                          )}
                        </td>
                        <td>{formatDateTime(row.updatedAt)}</td>
                        {canEdit && (
                          <td>
                            <div className="td-actions">
                              {editing ? (
                                <>
                                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveRow(row.id)}>
                                    <Save size={13} /> Kaydet
                                  </button>
                                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingRowId("")}>
                                    Vazgeç
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEditRow(row)}>
                                    <PenLine size={13} /> Düzenle
                                  </button>
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => void deleteRow(row.id)}>
                                    <Trash2 size={13} /> Sil
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={table.columns.length + (canEdit ? 3 : 2)}>
                        <div className="ui-empty-inline">Sayaç satırı yok.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          title={loading ? "Sayaç takibi yükleniyor" : "Sayaç şablonu yok"}
          description={canEdit ? "Ay seçip başlangıç sayaçlarını girerek ilk şablonu oluşturabilirsiniz." : "Teknik müdür veya İK tarafından yetkilendirilen kullanıcı şablonu oluşturabilir."}
        />
      )}
    </div>
  );
}
