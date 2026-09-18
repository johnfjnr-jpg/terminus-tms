// ── THE UNITS PANE ──────────────────────────────────────────────────────
//
// Round 7 Phase 2b. The rendering surface for the S capability's logic, which
// Phase 1b built and nothing imported.
//
// Three sub-tabs BY TYPE, not one per unit, which the vanilla's own comment
// argues at the markup: 24 tabs wrap to three rows of subordinate labels, and
// reaching the last unit costs 23 arrow presses where a list costs one scroll.
import { useMemo, useRef, useState } from 'react'
import {
  COUNT_KEY_TO_UNIT_TYPE, COUNT_KEY_FOR_UNIT_TYPE, UNIT_TYPE_FOR_TAB_KEY, unitShortfall,
  unitsForTab, countIsLocked, UNIT_STATES, DERIVE_ROUTE, type Unit,
} from './units'
import { createUnitQueues, type QueueDeps } from './unitQueue'

const TYPE_TABS = Object.entries(UNIT_TYPE_FOR_TAB_KEY).map(([key, type]) => ({ key, type }))

export function UnitsPane({ payload, units, deps, onDerive, onCorrectCount }: {
  payload: Record<string, unknown>
  units: readonly Unit[]
  deps: Omit<QueueDeps, 'onRowState'>
  onDerive: () => Promise<void>
  /** L2: the count correction, sent as the vanilla sent it. Resolves to an error, or null. */
  onCorrectCount?: (countKey: string, count: string, reason: string) => Promise<string | null>
}) {
  const [tab, setTab] = useState(TYPE_TABS[0].key)
  const [rowState, setRowState] = useState<Record<string, string>>({})
  const [deriving, setDeriving] = useState(false)
  const [ccCount, setCcCount] = useState('')
  const [ccReason, setCcReason] = useState('')
  const [ccBusy, setCcBusy] = useState(false)
  const [ccError, setCcError] = useState<string | null>(null)

  // ── ONE QUEUE SET, READING THE LATEST DEPS THROUGH A REF ───────────────
  //
  // The queue instance must live for the life of the pane, or every row gets a
  // fresh chain and Q1's per-row serialisation is lost. But it used to CAPTURE
  // the first render's deps, and `unitById` is how Q3 reads the revision to
  // expect - so after one accepted save the queue kept offering the revision
  // that save had already consumed.
  //
  // Invisible while the row had ONE field: a single blur is a single write.
  // Phase 3 gave the row four, and the live probe read
  // `200:serialNumber | 409:latitude | 409:longitude | 200:state`, with the row
  // saying "Someone else changed this unit" to a person editing alone.
  // Architecture 8: an unchanged path meeting a new demand.
  //
  // The ref is the same remedy StageTabs uses for the stage loader, for the same
  // reason: a stable instance, current dependencies.
  const depsRef = useRef(deps)
  depsRef.current = deps
  const queues = useRef(createUnitQueues({
    patch: (unitId, field, value, expected) => depsRef.current.patch(unitId, field, value, expected),
    unitById: (unitId) => depsRef.current.unitById(unitId),
    onUnit: (unit) => depsRef.current.onUnit(unit),
    onRowState: (unitId, state) => setRowState((s) => ({ ...s, [unitId]: state.message })),
  }))

  const shortfall = useMemo(() => unitShortfall(payload, units), [payload, units])
  const shown = unitsForTab(tab, units)

  return (
    <div data-testid="tb-units-pane">
      <p className="sub" data-testid="tb-units-sub">
        {shortfall.total} planned, {units.length} built
        {shortfall.missing > 0 ? `, ${shortfall.missing} to derive` : ''}
      </p>

      <div className="sub-tabs" role="tablist" data-testid="tb-units-subtabs">
        {TYPE_TABS.map((t) => (
          // `detail-tab sub-tab` is the estate's PAIR, and SubTabs.tsx uses both.
          // With `sub-tab` alone these rendered as browser-default buttons, and
          // `.sub-tab.active` sets colour WHITE, so the open tab's label was white
          // on a white button: invisible, and visible only in a screenshot
          // (Verification 7's fourth axis, a class whose rules name only what it
          // adds).
          <button key={t.key} type="button" role="tab"
            aria-selected={t.key === tab}
            className={t.key === tab ? 'detail-tab sub-tab active' : 'detail-tab sub-tab'}
            data-testid={`tb-units-tab-${t.key}`}
            onClick={() => setTab(t.key)}>{t.type}</button>))}
      </div>

      <div data-testid="tb-units-list">
        {shown.length
          ? shown.map((u) => (
            <div className="data-row tb-unit-row" key={u.id} data-testid={`tb-unit-${u.id}`}>
              <span className="tb-unit-type">{u.type}</span>
              {/* L4: the vanilla's row, by capability rather than by markup: the
                  index, then the three text fields, then the state select, then
                  this row's own feedback. Each saves ALONE through the queue, so
                  a body never carries a field the person did not touch.

                  B4, Phase 2: the field is `serialNumber`, which is what the row
                  carries and what the route accepts. It read and wrote `serial`,
                  a key neither side has, so the box was always empty and every
                  save stored nothing. */}
              <span className="tb-unit-index" data-testid={`tb-unit-index-${u.id}`}>{u.index ?? ''}</span>
              <input type="text" data-testid={`tb-unit-serial-${u.id}`} placeholder="Not recorded"
                defaultValue={String(u.serialNumber ?? '')}
                onBlur={(e) => { void queues.current.write(u.id, 'serialNumber', e.target.value) }} />
              <input type="text" data-testid={`tb-unit-latitude-${u.id}`} inputMode="decimal" placeholder="Latitude"
                defaultValue={String(u.latitude ?? '')}
                onBlur={(e) => { void queues.current.write(u.id, 'latitude', e.target.value) }} />
              <input type="text" data-testid={`tb-unit-longitude-${u.id}`} inputMode="decimal" placeholder="Longitude"
                defaultValue={String(u.longitude ?? '')}
                onBlur={(e) => { void queues.current.write(u.id, 'longitude', e.target.value) }} />
              <select data-testid={`tb-unit-state-select-${u.id}`} aria-label="Unit state"
                defaultValue={String(u.state ?? 'Planned')}
                onChange={(e) => { void queues.current.write(u.id, 'state', e.target.value) }}>
                {UNIT_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <span data-testid={`tb-unit-state-${u.id}`}>{rowState[u.id] ?? ''}</span>
            </div>))
          : <p className="empty-state" data-testid="tb-units-empty">
              No {UNIT_TYPE_FOR_TAB_KEY[tab]} units yet.</p>}
      </div>

      {/* ── L2: CORRECTING A LOCKED COUNT, PER OPEN TYPE ─────────────────
          The vanilla's own control (test-bed-detail.js:3239-3281) and its own
          reasoning: a type with slots has a count that is locked, and the way
          out is a new count WITH a reason, because "the count is a plan before
          installation and a record after it". Offered only for a type that has
          units, because a type with none has an ordinary editable count on
          Commercials. Apply waits for both boxes; the server refuses a
          reasonless correction anyway (400), and this is the affordance. */}
      {shown.length && onCorrectCount
        ? (
          <div data-testid="tb-units-correct">
            <p className="label">Correct the {UNIT_TYPE_FOR_TAB_KEY[tab]} count</p>
            <p className="sub" data-testid="tb-cc-explain">
              {shown.length} {UNIT_TYPE_FOR_TAB_KEY[tab]} unit{shown.length === 1 ? '' : 's'} now.
              The count is a plan before installation and a record after it.
              Correcting one is recorded with your reason.
            </p>
            <input type="text" data-testid="tb-cc-count" inputMode="numeric" placeholder="New count"
              value={ccCount} disabled={ccBusy} onChange={(e) => setCcCount(e.target.value)} />
            <input type="text" data-testid="tb-cc-reason" placeholder="Why is the count wrong?"
              value={ccReason} disabled={ccBusy} onChange={(e) => setCcReason(e.target.value)} />
            <button type="button" className="btn-sm" data-testid="tb-cc-apply"
              disabled={ccBusy || !ccCount.trim() || !ccReason.trim()}
              onClick={async () => {
                setCcBusy(true); setCcError(null)
                try {
                  const err = await onCorrectCount(
                    COUNT_KEY_FOR_UNIT_TYPE[UNIT_TYPE_FOR_TAB_KEY[tab]], ccCount.trim(), ccReason.trim())
                  if (err) { setCcError(err); return }
                  setCcCount(''); setCcReason('')
                } finally { setCcBusy(false) }
              }}>Apply</button>
            {ccError ? <p className="msg-error" data-testid="tb-cc-feedback">{ccError}</p> : null}
          </div>)
        : null}

      {/* S2: the gap between a count and its units, and the correction offered
          for it. Per TYPE, because that is the grain the correction has. */}
      <div data-testid="tb-units-correction">
        {shortfall.missing > 0
          ? (
            <>
              <p className="empty-state" data-testid="tb-units-correction-text">
                {shortfall.missing} unit{shortfall.missing === 1 ? '' : 's'} planned
                and not yet created.
              </p>
              <button type="button" data-testid="tb-units-derive"
                disabled={deriving}
                onClick={async () => {
                  setDeriving(true)
                  try { await onDerive() } finally { setDeriving(false) }
                }}>Create the missing units</button>
            </>)
          : null}
      </div>
    </div>
  )
}

/** S4: a count whose units exist may no longer be edited, and the row SAYS so. */
export function LockedCounts({ payload, units }: {
  payload: Record<string, unknown>
  units: readonly Unit[]
}) {
  const locked = Object.keys(COUNT_KEY_TO_UNIT_TYPE).filter((k) => countIsLocked(k, units))
  if (!locked.length) return null
  return (
    <p className="sub" data-testid="tb-count-locked">
      {locked.length} count{locked.length === 1 ? '' : 's'} locked: units exist.
      {' '}{locked.map((k) => `${COUNT_KEY_TO_UNIT_TYPE[k]} ${Number(payload[k]) || 0}`).join(', ')}
    </p>
  )
}

export { DERIVE_ROUTE }
