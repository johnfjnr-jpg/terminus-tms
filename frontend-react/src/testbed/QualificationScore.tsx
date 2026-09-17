// ── L2: THE REFERENCE TAB'S QUALIFICATION SCORE CARD ─────────────────────
//
// `tb-score-summary` appeared ZERO times in the React tree: dropped at the
// swap and never rebuilt. Restored from the vanilla's own renderer.
//
// ── Q5: IT READS THE RECORD PAYLOAD, NOT `seriesByKey` ───────────────────
//
// The obvious wiring is wrong and would have shipped an empty card. The host's
// `seriesByKey` is populated ONLY by the response to `POST /scores`
// (`TestBedHost.tsx`), so on a fresh page load it is `{}` - and a card reading
// it would print `Not scored` against every criterion on a fully scored
// record, which is indistinguishable from a correctly empty one.
//
// The scores live in the record's PAYLOAD, one array per criterion key, which
// is where the vanilla read them and where `src/lib/score-entry.js` writes
// them.
//
// ── DISPLAY ONLY, AND THAT IS THE POINT ──────────────────────────────────
//
// No control of any kind. The card's whole job is to say WHERE scoring
// happens, and the sub-line is the half that makes the route evident without
// giving this card a second way to do it. A control here would be a second
// writer of a value the stage tabs own (Verification 20).
import type { ScoreEntry } from './scoreReason'
import type { Criterion } from './scoring'

/**
 * THE ONE REDUCER, 2.2 and C9: a criterion's series from the RECORD PAYLOAD,
 * oldest first, ordered by `at`.
 *
 * Both renderers take it: this card, and the stage panel's scoring card. The
 * panel used to read `seriesByKey`, filled only by a POST response, so history
 * read empty on a scored record after every reload (audit B2).
 *
 * Ordered by `at` rather than trusting array order, which is the vanilla's
 * `tbScoreSeries`. Entries with no `at` sort first and lose, which is the
 * right way round: an entry that cannot say when it happened must not
 * outrank one that can.
 */
export function orderedSeries(
  payload: Record<string, unknown> | undefined, key: string,
): ScoreEntry[] {
  return byAt(seriesFromPayload(payload, key))
}

/** The ONE ordering both readers go through. */
function byAt(series: readonly ScoreEntry[]): ScoreEntry[] {
  return [...series].sort((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? '')))
}

/** The CURRENT entry: the last of an ordered series. */
export function currentEntry(series: readonly ScoreEntry[]): ScoreEntry | null {
  if (!Array.isArray(series) || series.length === 0) return null
  const sorted = byAt(series)
  return sorted[sorted.length - 1] ?? null
}

/** The raw series for one criterion, from the record payload, in stored order. */
export function seriesFromPayload(
  payload: Record<string, unknown> | undefined, key: string,
): ScoreEntry[] {
  const raw = payload?.[key]
  return Array.isArray(raw) ? raw as ScoreEntry[] : []
}

export function QualificationScore({ criteria, payload }: {
  criteria: readonly Criterion[]
  payload?: Record<string, unknown>
}) {
  if (!criteria.length) {
    return (
      <p className="empty-state" data-testid="tb-score-summary-empty">
        No scoring criteria configured.
      </p>
    )
  }
  return (
    <div data-testid="tb-score-summary">
      {criteria.map((c) => {
        const current = currentEntry(orderedSeries(payload, c.criterion_key))
        return (
          <div className="tb-score-sum-row" key={c.criterion_key}
            data-criterion={c.criterion_key}
            data-testid={`tb-score-sum-${c.criterion_key}`}>
            <span className="tb-score-name">{c.name ?? c.criterion_key}</span>
            <span className={current
              ? 'tb-score-value'
              : 'tb-score-value tb-score-value--none'}>
              {current && current.value !== undefined ? String(current.value) : 'Not scored'}
            </span>
            {/* The stage the CURRENT score was recorded at. This is the half
                that makes the route evident without a control: it names the
                tab the person should go to. */}
            {current?.stage
              ? <span className="tb-score-sum-where">{current.stage}</span>
              : null}
          </div>)
      })}
    </div>
  )
}
