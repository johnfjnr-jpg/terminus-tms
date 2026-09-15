import { formatTimestamp } from '../../../src/lib/format-dates.js'
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
  // `whenText`, not `when`: this field holds DISPLAY TEXT that has already
  // been through the formatter, and a name reading as a timestamp invites
  // exactly the raw render R7 exists to stop. The census asked about it and
  // the name was the thing that was wrong.
  id: string, whenText: string, action: string, actor: string, detail: string
}

/**
 * H3: the notice is PART OF THE CAPABILITY, not decoration, and it renders
 * above the empty state as well as above the table - a record with no history
 * still has to say what this panel is.
 */
// R3 CORRECTED THIS SENTENCE RATHER THAN LEAVING IT TO ROT. It said every
// entry was raw and undecided, which stopped being true for one action the
// moment field changes got a wording. A hardcoded claim about configuration
// has a shelf life, and this is the round that changed the configuration.
export const HISTORY_NOTICE = 'Field changes are written and worded by the server. '
  + 'For every other action these are raw audit entries, unedited: what they should say, '
  + 'how entries should be grouped, and which of them belong here at all are not decided yet.'

/**
 * H2: THE ORDER IS THE SERVER'S. The route orders by timestamp descending and
 * this preserves it rather than re-imposing one - a client sort would be a
 * second reader of the ordering rule (Verification 20).
 *
 * H5: four columns, and an EMPTY detail object renders as nothing rather than
 * as `{}`, which reads as data that is not there.
 */
/**
 * R3: THE SENTENCE IS COMPOSED HERE, FROM THE STRUCTURED CHANGE.
 *
 * The route records `{city: {from: 'Kuala Lumpur', to: 'Jakarta'}}` and this
 * turns it into prose. The split matters: what is STORED is data, so it can be
 * queried, re-worded, or translated later without rewriting history, and the
 * client can never author it. The Contact surface used to store the sentence
 * itself, which froze one wording into the record for ever.
 *
 * `null` means NOT RECORDED, one way, matching what the screens say about an
 * absent value. A reader never has to know whether a field was missing,
 * undefined or an empty string (Verification 20's absence clause).
 */
const shown = (v: unknown) => {
  if (v === null || v === undefined || v === '') return 'not recorded'
  return typeof v === 'object' ? JSON.stringify(v) : String(v)
}

export function changeSentences(
  changes: Record<string, { from?: unknown, to?: unknown }>,
  labelOf: (key: string) => string = (k) => k,
): string {
  return Object.entries(changes)
    .map(([k, c]) => `${labelOf(k)} changed from ${shown(c?.from)} to ${shown(c?.to)}.`)
    .join(' ')
}

export function historyRows(
  entries: readonly HistoryEntry[],
  labelOf?: (key: string) => string,
): HistoryRow[] {
  return entries.map((e, i) => {
    const changes = (e.detail as { changes?: Record<string, { from?: unknown, to?: unknown }> } | null)?.changes
    // COMPOSED ONLY WHERE THERE IS SOMETHING TO COMPOSE. Every other action
    // keeps the raw render, because H3's notice is still true of them: what
    // they should say is not decided.
    const detail = changes && Object.keys(changes).length
      ? changeSentences(changes, labelOf)
      : (e.detail && Object.keys(e.detail).length ? JSON.stringify(e.detail) : '')
    return {
      id: e.id ?? String(i),
      whenText: formatTimestamp(e.timestamp),
      action: e.action ?? '',
      actor: String(e.actor_id ?? '').slice(0, 8),
      detail,
    }
  })
}

/** H4: singular-aware, because "1 entries" is the kind of thing people notice. */
export const historyCount = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}.`

export const HISTORY_ROUTE = (id: string) => `/api/records/${id}/history`
