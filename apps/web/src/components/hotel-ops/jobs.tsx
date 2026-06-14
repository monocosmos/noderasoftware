import { MessageSquareText, X } from "lucide-react";

export function JobNoteComposer({
  noteDraft,
  noteSubmitting,
  onChange,
  onClose,
  onSubmit
}: {
  noteDraft: string;
  noteSubmitting: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <div className="app-modal-overlay note-composer-overlay" role="presentation" onClick={onClose}>
      <section className="app-modal note-composer-modal" role="dialog" aria-modal="true" aria-labelledby="noteComposerTitle" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-header">
          <div className="app-modal-title-row">
            <span className="app-modal-title-icon">
              <MessageSquareText size={19} />
            </span>
            <div>
              <div className="app-modal-eyebrow">İş notu</div>
              <h2 id="noteComposerTitle" className="app-modal-title">Not Ekle</h2>
            </div>
          </div>
          <button type="button" className="app-modal-close" onClick={onClose} aria-label="Not penceresini kapat" disabled={noteSubmitting}>
            <X size={15} />
          </button>
        </div>
        <div className="app-modal-body note-composer-body">
          <textarea
            className="form-control note-composer-input"
            value={noteDraft}
            onChange={(event) => onChange(event.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="Notunuzu yazın"
            autoFocus
          />
        </div>
        <div className="app-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={noteSubmitting}>Vazgeç</button>
          <button type="button" className="btn btn-primary" onClick={() => void onSubmit()} disabled={noteSubmitting || !noteDraft.trim()}>
            <MessageSquareText size={15} /> {noteSubmitting ? "Kaydediliyor" : "Kaydet"}
          </button>
        </div>
      </section>
    </div>
  );
}
