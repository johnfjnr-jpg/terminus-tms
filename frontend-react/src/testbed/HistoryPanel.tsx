// ── H: REVISION HISTORY ─────────────────────────────────────────────────
import { historyRows, historyCount, HISTORY_NOTICE, type HistoryEntry } from './history'

export function HistoryPanel({ entries, failed }: {
  entries: readonly HistoryEntry[]
  failed?: boolean
}) {
  // H6: a failed load says so, and does NOT render the notice - there is
  // nothing to caveat.
  if (failed) {
    return <p className="empty-state" data-testid="tb-history-block">Unable to load history.</p>
  }

  const rows = historyRows(entries)
  return (
    <div data-testid="tb-history-block">
      {/* H3: the notice renders above the empty state as well as above the
          table, so a record with no history still says what this panel is. */}
      <p className="sub" data-testid="tb-history-notice">{HISTORY_NOTICE}</p>
      {rows.length
        ? (
          <>
            <p className="sub" data-testid="tb-history-count">{historyCount(rows.length)}</p>
            <table className="tb-units-table tb-history-table">
              <thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Detail</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} data-testid={`tb-history-row-${r.id}`}>
                    <td><span>{r.when}</span></td>
                    <td><span>{r.action}</span></td>
                    <td><span>{r.actor}</span></td>
                    <td className="tb-history-detail"><span>{r.detail}</span></td>
                  </tr>))}
              </tbody>
            </table>
          </>)
        : <p className="empty-state" data-testid="tb-history-empty">
            No history recorded for this record.</p>}
    </div>
  )
}
