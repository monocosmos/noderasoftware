import { ClipboardList, ShieldCheck } from "lucide-react";

export function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-item">
      <div className="info-label">{label}</div>
      <div className="info-value">{value}</div>
    </div>
  );
}

export function EmptyState({ description, title }: { description: string; title: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><ClipboardList size={24} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function AccessDenied({ message }: { message: string }) {
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
