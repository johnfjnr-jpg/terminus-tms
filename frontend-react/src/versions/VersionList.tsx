import { useState } from 'react'
import { rangeView, versionLabel, versionAuthor, versionWhen, approvalLine, trackLine, EMPTY_STATE } from './model'
import type { DealVersion, PendingApproval } from './model'

// ── THE VERSION LIST: range toggle, rows, Restore ────────────────────────
//
// TQ_RESTORE L1 (John, 2026-11-25): extracted from VersionCard UNCHANGED so
// the Term quote tab renders the same list. The Commercials card passes its
// ids (`ids`), which app.js and the stylesheet reach by; the Term quote tab
// passes none, because both tabs are mounted at once and an id is unique.
//
// WHAT THE CALLER DECIDES, and the list does not:
// - WHICH versions (L2): each tab hands over its own kind;
// - the row's figure line (L3): `figureOf` replaces "N sections recorded" on
//   a term row; absent, the Commercials line renders as it always did;
// - whether Restore is offered (W): never on a Closed Won deal, either tab;
// - what a refusal says and where (L6): `onRestore` REJECTS with the sentence,
//   and the list hands it to `onRefused`, never to an unawaited promise.
export function VersionList({
  versions, pending, onRestore, onRefused, canRestore = true, figureOf, ids = false, rowTestId,
}: {
  versions: DealVersion[]
  pending: PendingApproval | null
  onRestore(id: string): Promise<void> | void
  onRefused(message: string): void
  canRestore?: boolean
  figureOf?: (v: DealVersion) => string
  ids?: boolean
  rowTestId?: string
}) {
  const [range, setRange] = useState<number | 'all'>(5)
  const view = rangeView(versions, range)
  const restore = async (id: string) => {
    try { await onRestore(id) } catch (err) { onRefused((err as Error).message || 'That version could not be restored.') }
  }
  return (
    <>
      <div className="pg-card-head">
        <p className="pg-card-title">Versions</p>
        <div className={`view-toggle${view.toggleHidden ? ' hidden' : ''}`} id={ids ? 'deal-version-range' : undefined}>
          {([5, 10, 'all'] as const).map((r) => (
            <button key={String(r)} data-range={String(r)} type="button"
              className={String(range) === String(r) ? 'active' : ''}
              onClick={() => setRange(r)}>{r === 'all' ? 'All' : `Last ${r}`}</button>
          ))}
        </div>
      </div>

      <p className={`pg-item-note${view.noteHidden ? ' hidden' : ''}`}
        id={ids ? 'deal-version-range-note' : undefined}>{view.note}</p>

      <div id={ids ? 'deal-version-list' : undefined}>
        {view.shown.length === 0
          ? <p className="pg-item-note">{EMPTY_STATE}</p>
          : view.shown.map((v) => {
            const sections = v.sections ?? []
            const track = trackLine(v, pending)
            const approval = approvalLine(v)
            return (
              <div className="ds-row" key={v.id} data-testid={rowTestId} data-version-id={v.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="ds-label">{versionLabel(v)}
                    {' '}
                    {/* ── R-L4: THREE STATES ON SCREEN, ONE DB WORD ────────
                        John's ruling 2026-09-29. The DB still stores `issued`
                        and nothing about that changes; what a person reads does.

                        A promoted version is AWAITING APPROVAL until every
                        track has signed, and APPROVED once they have. The word
                        "issued" is reserved for the future logged
                        customer-send event, so it appears nowhere on screen.

                        The approval state comes from the row the server already
                        sends, which `approvalLine` below reads for its own
                        sentence, so the badge and the line cannot disagree.
                        L7: the lowercase spelling stays, on both tabs. */}
                    <span className="pg-item-note" style={{ display: 'inline' }}>
                      {v.status !== 'issued'
                        ? 'draft'
                        : v.approval?.state === 'approved' ? 'approved' : 'awaiting approval'}
                    </span>
                  </div>
                  <div className="pg-item-note">{v.reason}</div>
                  <div className="pg-item-note">{versionAuthor(v)} &middot; {versionWhen(v)}</div>
                  {approval ? <div className="pg-item-note">{approval}</div> : null}
                  {track ? <div className="pg-item-note">{track}</div> : null}
                  {figureOf
                    ? <div className="pg-item-note" data-testid={rowTestId ? `${rowTestId.replace(/-row$/, '')}-figure` : undefined}>{figureOf(v)}</div>
                    : (
                      <div className="pg-item-note" title={sections.join(', ')}>
                        {sections.length} section{sections.length === 1 ? '' : 's'} recorded
                      </div>
                    )}
                </div>
                {/* W (TQ_RESTORE, superseding W6 "every row, in every state"):
                    on a Closed Won deal nothing can be restored into a form
                    that cannot be saved, so Restore is not offered. Every
                    other state keeps it on every row. */}
                {canRestore ? (
                  <div className="ds-value">
                    <button className="btn-text" type="button"
                      data-restore-version={v.id}
                      onClick={() => { void restore(v.id) }}>Restore</button>
                  </div>
                ) : null}
              </div>
            )
          })}
      </div>
    </>
  )
}
