// ── M: THE DOCUMENTS PANEL ──────────────────────────────────────────────
import { documentRows, type DocRequirements } from './documents'

export function DocumentsPanel({ data, onConfirm, onSaveUrl }: {
  data: DocRequirements
  onConfirm: (name: string) => void
  onSaveUrl: (name: string, url: string) => void
}) {
  const rows = documentRows(data)
  // M8: an empty configuration is this stage's ANSWER, not a failure, and the
  // caller has already marked the panel settled by the time this renders.
  if (!rows.length) {
    return <p className="empty-state" data-testid="tb-docs-empty">
      No documents configured for this stage.</p>
  }
  return (
    <div data-testid="tb-docs-rows">
      {rows.map((r) => (
        <div className="tb-doc-row" key={r.key} data-testid={`tb-doc-${r.key}`}>
          <div className="tb-doc-head">
            <span className="tb-doc-name">{r.name}</span>
            <span className={`doc-status ${r.statusClass}`}
              data-testid={`tb-doc-status-${r.key}`}>{r.statusLabel}</span>
          </div>
          <div className="tb-doc-actions">
            <input type="text" className="tb-doc-url" placeholder="Document URL"
              defaultValue={r.url} data-testid={`tb-doc-url-${r.key}`}
              onBlur={(e) => { if (e.target.value !== r.url) onSaveUrl(r.name, e.target.value) }} />
            {/* M4 and M5 say DIFFERENT things: one has no gate rule, the other
                has already passed it. A blank in both places would hide the
                misalignment M2 exists to make visible. */}
            {r.confirm === 'not-gated'
              ? <span className="tb-doc-nogate" data-testid={`tb-doc-nogate-${r.key}`}>Not gated</span>
              : r.confirm === 'offer'
                ? <button type="button" className="btn-sm"
                    data-testid={`tb-doc-confirm-${r.key}`}
                    onClick={() => onConfirm(r.name)}>Confirm</button>
                : null}
          </div>
          <div className="tb-doc-feedback" data-testid={`tb-doc-fb-${r.key}`} />
        </div>))}
    </div>
  )
}
