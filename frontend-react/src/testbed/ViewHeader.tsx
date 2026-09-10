// ── R1 and L6: THE HEADER AND THE READ-ONLY BANNER ──────────────────────
//
// W1, 2026-09-10, adds the design of record on top of what was already here:
//   title with the summary beside it, then the stats strip, then the chevron.
// The order is top to bottom exactly as ruled.
import { useEffect } from 'react'
import { headerOf, OWNERSHIP_REFUSAL_TEXT } from './viewLoad'
import { headerStats } from './headerStats'

const CHEVRON_ID = 'tb-chevron-strip'

export function ViewHeader({ record, readOnly }: {
  record: {
    status?: string
    payload?: Record<string, unknown> & { name?: string, client_organisation?: string }
  } | null
  readOnly: boolean
}) {
  const { name, client } = headerOf(record)
  const payload = record?.payload ?? {}
  const { cells, hardware } = headerStats(payload)
  const status = record?.status

  // ── THE CHEVRON RUNS THE TEST BED'S OWN STAGES ──────────────────────
  //
  // REUSED, not reimplemented. `renderChevronStrip(elementId, currentStage,
  // stages)` already takes its stages AS DATA and `fetchStages(recordType)` is
  // already parameterised, so the Opportunity's chevron becomes the Test Bed's
  // by passing 'test_bed'. Measured in Phase 0 rather than assumed.
  //
  // In an effect because the renderer writes into a container this tree owns,
  // and that container only exists once React has painted it.
  useEffect(() => {
    if (!status) return
    let cancelled = false
    const w = window as unknown as {
      fetchStages?: (t: string) => Promise<Array<Record<string, unknown>>>
      renderChevronStrip?: (id: string, stage: string, stages: Array<Record<string, unknown>>) => void
    }
    void (async () => {
      const stages = await w.fetchStages?.('test_bed')
      // A stale answer from the previous record must not paint this one.
      if (cancelled || !stages?.length) return
      w.renderChevronStrip?.(CHEVRON_ID, status, stages)
    })()
    return () => { cancelled = true }
  }, [status])

  return (
    <div data-testid="tb-view-header">
      {/* TITLE LARGE, SUMMARY TO ITS RIGHT. The summary keeps its element even
          when empty, for the reason the client line already does: the title
          must not move when one record has a summary and the next does not. */}
      <div className="tb-header-row" data-testid="tb-header-row">
        <div className="tb-header-title">
          <h2 data-testid="tb-detail-name">{name}</h2>
          <p className="sub" data-testid="tb-detail-client">{client}</p>
        </div>
        <p className="tb-header-summary sub" data-testid="tb-header-summary">
          {typeof payload.summary === 'string' ? payload.summary : ''}
        </p>
      </div>

      {/* THE STRIP. Five cells in the order of record. */}
      <div className="stats-grid stats-grid--testbed" data-testid="tb-header-stats">
        {cells.map((c) => (
          <div key={c.label}>
            <span className="label">{c.label}</span>
            {c.label === 'Hardware'
              ? (
                // R3: NAMES ABOVE NUMBERS, and R12: HEMIR only when it carries
                // data. One cell, however many types it holds.
                <div className="tb-hardware" data-testid="tb-hardware">
                  {hardware.map((h) => (
                    <span className="tb-hardware-item" key={h.type}>
                      <span className="tb-hardware-name">{h.type}</span>
                      <span className="stat-value">{h.count}</span>
                    </span>
                  ))}
                </div>)
              : (
                // R10's READ side: computed at render, nothing stored, no flag.
                <div
                  className={`stat-value${c.overdue ? ' stat-value--overdue' : ''}`}
                  data-testid={`tb-stat-${c.label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
                  data-overdue={c.overdue ? 'true' : undefined}
                  title={c.overdue ? 'Past its contracted end date' : undefined}
                >{c.value}</div>)}
          </div>
        ))}
      </div>

      {/* THE CHEVRON, below the strip. */}
      <div id={CHEVRON_ID} className="chevron-strip" data-testid="tb-chevron-strip" />

      {/* L6: the banner is the only PER-VIEW part. The class, the value and the
          stylesheet rule are shared with the Opportunity; the banners differ
          only because they sit in different documents. */}
      <div data-testid="tb-readonly-banner">
        {readOnly
          ? (
            <div className="freeze-banner" data-testid="tb-readonly-banner-body">
              <p className="label">Read only &middot; another user&apos;s record</p>
              {/* L7: view-not-edit, not access-denied. RLS is the boundary;
                  this stops work that will be refused. */}
              <p>{OWNERSHIP_REFUSAL_TEXT}</p>
            </div>)
          : null}
      </div>
    </div>
  )
}
