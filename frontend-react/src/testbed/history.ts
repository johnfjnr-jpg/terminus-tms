// ── H: REVISION HISTORY ─────────────────────────────────────────────────
//
// H1: raw audit entries from GET /api/records/:id/history.
export interface HistoryEntry {
  id?: string
  timestamp?: string
  action?: string
  actor_id?: string
  detail?: Record<string, unknown> | null
}

export interface HistoryRow {
  id: string, when: string, action: string, actor: string, detail: string
}

/**
 * H3: the notice is PART OF THE CAPABILITY, not decoration, and it renders
 * above the empty state as well as above the table - a record with no history
 * still has to say what this panel is.
 */
export const HISTORY_NOTICE = 'Raw audit entries, unedited. What each action should say, '
  + 'how entries should be grouped, and which of them belong here at all are not decided yet.'

/**
 * H2: THE ORDER IS THE SERVER'S. The route orders by timestamp descending and
 * this preserves it rather than re-imposing one - a client sort would be a
 * second reader of the ordering rule (Verification 20).
 *
 * H5: four columns, and an EMPTY detail object renders as nothing rather than
 * as `{}`, which reads as data that is not there.
 */
export function historyRows(entries: readonly HistoryEntry[]): HistoryRow[] {
  return entries.map((e, i) => ({
    id: e.id ?? String(i),
    when: String(e.timestamp ?? '').slice(0, 16).replace('T', ' '),
    action: e.action ?? '',
    actor: String(e.actor_id ?? '').slice(0, 8),
    detail: e.detail && Object.keys(e.detail).length ? JSON.stringify(e.detail) : '',
  }))
}

/** H4: singular-aware, because "1 entries" is the kind of thing people notice. */
export const historyCount = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}.`

export const HISTORY_ROUTE = (id: string) => `/api/records/${id}/history`
