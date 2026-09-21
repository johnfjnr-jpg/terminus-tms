// ── R1 and L6: THE HEADER AND THE READ-ONLY BANNER ──────────────────────
//
// W1, 2026-09-10, adds the design of record on top of what was already here:
//   title, then the stats strip, then the chevron. (The summary that sat beside
//   the title is removed by R3, TEST_BED_WALK_2_BRIEF.md, 2026-09-17.)
// The order is top to bottom exactly as ruled.
import { useEffect, type ReactNode } from 'react'
import { headerOf, OWNERSHIP_REFUSAL_TEXT } from './viewLoad'
import { headerStats } from './headerStats'

const CHEVRON_ID = 'tb-chevron-strip'
const CHEVRON_WRAP_ID = 'tb-chevron-wrap'
const CHEVRON_POPUP_ID = 'tb-chevron-popup'

export function ViewHeader({ record, readOnly, titleAction, band, onBack }: {
  record: {
    /** AUDIT L10: the hover popup asks `/records/:id/exit-criteria`. */
    id?: string
    status?: string
    payload?: Record<string, unknown> & { name?: string, client_organisation?: string }
  } | null
  readOnly: boolean
  /**
   * W5: the record-level action that belongs beside the title.
   *
   * A SLOT, not a component. `ConvertPanel` needs the host's convert route,
   * its navigate and its per-record key, and none of that is the header's
   * business - so the host goes on owning it and this only says where it
   * renders. Passing the record down instead would give the header a second
   * reason to know about routes.
   */
  titleAction?: ReactNode
  /**
   * THE RECORD BAND: Summary, Notes, the follow-up task. Rendered between
   * the title and the stats strip, which is the order John ruled and the
   * order these things mean: they describe the RECORD, like the strip and
   * the chevron below them, rather than belonging to any one tab.
   *
   * A SLOT HERE IS WHAT MAKES THE POSITION HARD TO LOSE. The previous
   * attempt put the band at the top of the Reference PANEL and reported it
   * as delivered; nothing could tell, because every check asked whether the
   * band was intact and none asked where it sat. It can only drift back now
   * by somebody deleting this slot.
   */
  band?: ReactNode
  /**
   * R4: BACK TO TEST BEDS, restored. The static button was destroyed when
   * createRoot cleared the view (audit L11), taking app.js's listener with it.
   * It goes through the shell's own navigation, which the host supplies.
   */
  onBack?: () => void
}) {
  const { name, client } = headerOf(record)
  const payload = record?.payload ?? {}
  const { cells, hardware } = headerStats(payload)
  const status = record?.status
  const recordId = record?.id ? String(record.id) : ''

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
      wireChevronHover?: (o: { wrapId: string, popupId: string, recordId: string }) => void
    }
    void (async () => {
      const stages = await w.fetchStages?.('test_bed')
      // A stale answer from the previous record must not paint this one.
      if (cancelled || !stages?.length) return
      w.renderChevronStrip?.(CHEVRON_ID, status, stages)
      // AUDIT L10. Wired AFTER the strip is painted, because the handler is
      // delegated from the wrapper and the items must exist to be hovered.
      // The helper re-points `wrap.dataset.recordId` on every call and guards
      // its own listener, which is what makes it safe to call per record.
      if (recordId) {
        w.wireChevronHover?.({
          wrapId: CHEVRON_WRAP_ID, popupId: CHEVRON_POPUP_ID, recordId,
        })
      }
    })()
    return () => { cancelled = true }
  }, [status, recordId])

  return (
    <div data-testid="tb-view-header">
      {/* R4: THE VANILLA'S BUTTON, IN THE VANILLA'S PLACE: the first thing in
          the header, above the title, `btn-text` with the vanilla's id. The id
          is what keeps it alive on somebody else's record: the door exempts
          `[id^="btn-back-"]` as navigation. It is reproduced inside the mount
          container createRoot clears, so it cannot collide with the static
          markup's copy (disposed in no-duplicate-ids.test.mjs). */}
      {onBack
        ? <button type="button" className="btn-text" id="btn-back-testbeds"
            data-testid="tb-back" onClick={onBack}>Back to test beds</button>
        : null}
      {/* TITLE LARGE. R3 (TEST_BED_WALK_2_BRIEF.md, ruled 2026-09-17): NO
          SUMMARY BESIDE IT. The summary renders once, as the editable field on
          the record band; the read-only copy that sat here was a duplicate.

          W1: THE ACCOUNT NAME IS ON THE TITLE'S OWN LINE, not under it. The
          two sit in a baseline-aligned flex row, which is what "bottom
          aligned to the title" means for two different type sizes: their
          boxes have different bottoms and their text sits on one line.

          W5: THE RECORD ACTION IS THE THIRD CELL, pushed right, which is the
          Opportunity's own `.detail-head` arrangement rather than a new one. */}
      <div className="tb-header-row" data-testid="tb-header-row">
        <div className="tb-header-title" data-testid="tb-header-title">
          <h2 data-testid="tb-detail-name">{name}</h2>
          {/* `.tb-header-client` exists to zero `.sub`'s 32px bottom margin,
              which was invisible while this sat on a line of its own and
              becomes a hole in the row the moment it does not. */}
          <p className="tb-header-client sub" data-testid="tb-detail-client">{client}</p>
        </div>

        {titleAction
          ? <div className="tb-header-action" data-testid="tb-header-action">{titleAction}</div>
          : null}
      </div>

      {/* THE RECORD BAND, DIRECTLY UNDER THE TITLE AND ABOVE THE STRIP. */}
      {band}

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

      {/* ── THE CHEVRON, below the strip ──────────────────────────────────
          AUDIT L10: the POPUP IS A SIBLING OF THE STRIP, inside a wrapper,
          and the reason is recorded at the Opportunity's own copy and at the
          retired vanilla's: `.chevron-strip` has `overflow: hidden` and every
          `.chevron-item` carries a clip-path, so a popup rendered inside
          either would be clipped away entirely. The wrapper is the
          positioning context AND the hover target, so moving the pointer from
          a chevron into the popup does not read as leaving.

          The strip was rendered bare here, with no wrap and no popup, so the
          per-stage hover detail and its blocking list existed on the
          Opportunity and nowhere on the Test Bed. `wireChevronHover` is
          record-type agnostic - it asks `/records/:id/exit-criteria` - so
          this needed the markup and the call, not a second implementation. */}
      <div id={CHEVRON_WRAP_ID} className="chevron-wrap" data-testid="tb-chevron-wrap">
        <div id={CHEVRON_ID} className="chevron-strip" data-testid="tb-chevron-strip" />
        <div id={CHEVRON_POPUP_ID} className="chevron-popup hidden"
          data-testid="tb-chevron-popup" />
      </div>

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
