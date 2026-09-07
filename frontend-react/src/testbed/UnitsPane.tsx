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
  COUNT_KEY_TO_UNIT_TYPE, UNIT_TYPE_FOR_TAB_KEY, unitShortfall, unitsForTab,
  countIsLocked, DERIVE_ROUTE, type Unit,
} from './units'
import { createUnitQueues, type QueueDeps } from './unitQueue'

const TYPE_TABS = Object.entries(UNIT_TYPE_FOR_TAB_KEY).map(([key, type]) => ({ key, type }))

export function UnitsPane({ payload, units, deps, onDerive }: {
  payload: Record<string, unknown>
  units: readonly Unit[]
  deps: Omit<QueueDeps, 'onRowState'>
  onDerive: () => Promise<void>
}) {
  const [tab, setTab] = useState(TYPE_TABS[0].key)
  const [rowState, setRowState] = useState<Record<string, string>>({})
  const [deriving, setDeriving] = useState(false)

  // ONE queue set for the life of the pane. Rebuilding it per render would give
  // every row a fresh chain and Q1's per-row serialisation would be lost.
  const queues = useRef(createUnitQueues({
    ...deps,
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
          <button key={t.key} type="button" role="tab"
            aria-selected={t.key === tab}
            className={t.key === tab ? 'sub-tab active' : 'sub-tab'}
            data-testid={`tb-units-tab-${t.key}`}
            onClick={() => setTab(t.key)}>{t.type}</button>))}
      </div>

      <div data-testid="tb-units-list">
        {shown.length
          ? shown.map((u) => (
            <div className="data-row" key={u.id} data-testid={`tb-unit-${u.id}`}>
              <span>{u.type}</span>
              <input data-testid={`tb-unit-serial-${u.id}`}
                defaultValue={String((u as { serial?: string }).serial ?? '')}
                onBlur={(e) => { void queues.current.write(u.id, 'serial', e.target.value) }} />
              <span data-testid={`tb-unit-state-${u.id}`}>{rowState[u.id] ?? ''}</span>
            </div>))
          : <p className="empty-state" data-testid="tb-units-empty">
              No {UNIT_TYPE_FOR_TAB_KEY[tab]} units yet.</p>}
      </div>

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
