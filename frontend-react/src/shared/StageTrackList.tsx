// ── THE STAGE TRACK LIST, SHARED ────────────────────────────────────────
//
// A9: the vanilla's buildStageTrackListHtml serves the Opportunity too. This
// component is consumed by the Test Bed host now; THE OPPORTUNITY'S
// CONSUMPTION IS A FOLLOW-ON RE-POINT, recorded in the round report rather than
// duplicated here.
import { stageTracks, type StageEntry } from './stageTracks'

export function StageTrackList({ stage, recordType, superseded, onApprove, testId }: {
  stage: StageEntry | undefined
  recordType: string
  superseded: boolean
  onApprove: (track: string) => void
  testId: string
}) {
  const list = stageTracks(stage, recordType, superseded)

  if (list.kind !== 'rows') {
    return <p className="empty-state" data-testid={`${testId}-${list.kind}`}>{list.text}</p>
  }

  return (
    <div data-testid={testId}>
      {list.rows.map((r) => (
        <div key={r.track}
          className={`sa-approval-row${r.approved ? ' approved' : ''}${r.clickable ? ' clickable' : ''}`}
          data-testid={`${testId}-${r.track}`}
          onClick={r.clickable ? () => onApprove(r.track) : undefined}>
          <span className="ring-radio-ring"><span className="ring-radio-dot" /></span>
          <div>
            <div className="sa-approval-role">{r.role}</div>
            <div className="sa-approval-meta">{r.meta}</div>
          </div>
        </div>))}
    </div>
  )
}
