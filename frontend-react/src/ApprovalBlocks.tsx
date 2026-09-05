import { Row } from './ApprovalRow'
import {
  money, pts, label, productLabel, fmtVal, isoDate, signedMoney, plusMoney,
  NBSP, MIDDOT, ARROW,
} from './approval-format'
import type {
  Ask, Moved, Target, Exposure, CostBasis, NotRecordedRow, BridgeStep,
} from './approval-types'

// ── 1. The ask ───────────────────────────────────────────────────────────
export function AskBlock({ ask }: { ask: Ask }) {
  const v = ask.version
  return (
    <>
      <p style={{ fontSize: '1.05rem', marginBottom: 14 }}>{ask.sentence}</p>
      {v ? (
        <Row
          left="Version"
          right={<>{v.label} <span className="pg-item-note" style={{ display: 'inline' }}>{v.status}</span></>}
          note={`Taken from revision ${v.revisionNumber} by ${v.author ?? 'unknown author'}`}
        />
      ) : null}
      {v?.reason ? (
        <div style={{ margin: '14px 0 18px' }}>
          <p className="label" style={{ marginBottom: 6 }}>Stated reason for this version</p>
          <p style={{ maxWidth: '70ch' }}>{v.reason}</p>
        </div>
      ) : null}
      <Row left="Contract net" right={`$${money(ask.contractNet)}`} />
      <Row left="Total cost" right={`$${money(ask.totalCost)}`} />
      <Row left="Achieved margin" right={`${ask.achievedMargin.toFixed(2)}%`} />
      <Row left="Term" right={`${ask.months} months`} />
      <Row left="Units" right={String(ask.units)} />
    </>
  )
}

// A step can move ten keys at once and ten "from -> to" clauses in note-sized
// text is a wall that says less than a count does. Three named, then a count;
// the full list stays in the title attribute, so nothing is lost.
const CHANGE_CAP = 3
function ChangeNote({ step }: { step: BridgeStep }) {
  const all = step.changes.map((c) => `${label(c.key)}: ${fmtVal(c.from)} ${ARROW} ${fmtVal(c.to)}`)
  const shown = all.slice(0, CHANGE_CAP).join(` ${MIDDOT} `)
  const rest = all.length - CHANGE_CAP
  return <span title={all.join(' | ')}>{shown}{rest > 0 ? ` ${MIDDOT} and ${rest} more` : ''}</span>
}

// The target block applies whether or not there is a baseline, so it renders
// under both branches below rather than inside one of them.
function TargetBlock({ target }: { target: Target }) {
  return (
    <>
      {target.movedSentence ? (
        <p className="msg-warning" style={{ marginBottom: 10 }}>
          {target.movedSentence}
          <span className="pg-item-note" style={{ display: 'block' }}>
            The same change appears as a step in the bridge below.
            That is not double counting: the step says what it did to the margin, this says what the margin is now measured against.
          </span>
        </p>
      ) : null}
      <Row
        left="Against target"
        right={`${target.gapPoints >= 0 ? 'above' : 'below'} by ${Math.abs(target.gapPoints).toFixed(2)} pts`}
        note={`Achieved ${target.achieved.toFixed(2)}% against target ${target.provenance ? target.provenance.sentence : `${target.target}%`}`}
      />
      {target.linesBelowTarget.map((l) => (
        <Row key={l.key} left={label(l.key)} right={`${l.pct}%`}
          note={`${l.gapPoints.toFixed(0)} points below the deal's own target`} />
      ))}
    </>
  )
}

// ── 2. What moved it ─────────────────────────────────────────────────────
//
// FOUR HONESTY STATES, and they are not mutually exclusive. A bridge can be
// non-comparable AND fail to reconcile, and both must be said:
//
//   comparable === false  the caveat: a baseline with no cost basis priced its
//                         lines at zero, so this is not a comparison of two
//                         priced deals and must not be read as one.
//   reconciles === true   the display rounding, stated AS rounding, and only
//                         when there is any.
//   reconciles === false  an error naming the unaccounted points and the
//                         tolerance, telling the approver not to rely on it.
//   unexplained !== 0     its own error. A movement no step claims is a
//                         different fault from a rounding leftover, so it is a
//                         different sentence.
//
// A bridge that always adds up is telling an approver nothing.
export function MovedBlock({ moved, target }: { moved: Moved; target: Target }) {
  if (!moved.bridge) {
    // A STATED ABSENCE, NOT A GAP. A blank block reads as a rendering failure.
    return (
      <>
        <p style={{ marginBottom: 14 }}>{moved.absence}</p>
        <TargetBlock target={target} />
      </>
    )
  }

  const b = moved.bridge
  const base = moved.baseline

  return (
    <>
      {moved.caveat ? <p className="msg-error" style={{ marginBottom: 14 }}>{moved.caveat}</p> : null}
      <p className="pg-item-note" style={{ marginBottom: 10 }}>
        Against {base?.label}, approved at revision {base?.revisionNumber}
        {base?.approvedAt ? ` on ${isoDate(base.approvedAt)}` : ''}.
      </p>

      <Row
        left={<strong>Opening</strong>}
        right={<><strong>{b.opening.marginPoints.toFixed(2)}%</strong>{` ${NBSP} $${money(b.opening.contractNet)}`}</>}
        note={`${base?.label}, as approved`}
        cls="appr-frame"
      />

      {b.steps.length
        ? b.steps.map((s, i) => (
          <Row key={`${s.label}-${i}`} left={s.label}
            right={`${pts(s.marginPoints)} ${NBSP} ${plusMoney(s.contractNet)}`}
            note={<ChangeNote step={s} />} />
        ))
        : <p className="pg-item-note">Nothing has changed since that version was approved.</p>}

      {b.reconciliation.reconciles
        ? (b.displayRounding
          ? <Row left="Rounding"
              right={`${b.displayRounding >= 0 ? '+' : ''}${b.displayRounding.toFixed(2)} pts`}
              note="The figures above are shown to two decimals and the exact ones are not. This is that difference, not a change in the deal." />
          : null)
        // NOT PRINTED AS ROUNDING. A leftover bigger than two-decimal display
        // can produce is an error wearing rounding's label.
        : (
          <p className="msg-error">
            This bridge does not reconcile. The steps leave
            {' '}{b.displayRounding.toFixed(2)} points unaccounted for, against a rounding tolerance of
            {' '}{b.reconciliation.tolerance}. Do not rely on the figures below; report this.
          </p>
        )}

      <Row
        left={<strong>Closing</strong>}
        right={<><strong>{b.closing.marginPoints.toFixed(2)}%</strong>{` ${NBSP} $${money(b.closing.contractNet)}`}</>}
        note={`Total movement ${pts(b.total.marginPoints)}`}
        cls="appr-frame appr-frame-close"
      />

      {Math.abs(b.unexplained) > 1e-6 ? (
        <p className="msg-error">{b.unexplained.toFixed(4)} points are unexplained. The bridge does not reconcile; do not rely on it.</p>
      ) : null}

      {b.unassignedKeys.length ? (
        <p className="msg-warning">Changed and not accounted for by any step: {b.unassignedKeys.join(', ')}.</p>
      ) : null}

      <p className="pg-item-note" style={{ marginTop: 12 }}>{moved.order}</p>
      <TargetBlock target={target} />
    </>
  )
}

// ── 3. Exposures ─────────────────────────────────────────────────────────
export function ExposuresBlock({ exposures }: { exposures: Exposure[] }) {
  return (
    <>
      <p className="pg-item-note" style={{ marginBottom: 10 }}>
        Money at risk, not the percentages that produced it.
        A percentage is an input; the input screen already shows it.
      </p>
      {exposures.map((e) => (
        <Row key={e.key} left={e.label}
          right={<>{signedMoney(e.amount)} <span className="pg-item-note" style={{ display: 'inline' }}>{e.bornByTerminus ? 'borne by Terminus' : 'not borne'}</span></>}
          note={`${e.basis}. ${e.note}`} />
      ))}
    </>
  )
}

// ── 4. Cost basis and its age ────────────────────────────────────────────
export function CostBasisBlock({ costBasis }: { costBasis: CostBasis }) {
  const c = costBasis
  return (
    <>
      <p className="pg-item-note" style={{ marginBottom: 10 }}>
        Resolved as at {c.asOf}. {c.asOfRule}
        {' '}A deal is only as current as its stalest input, so the oldest is first.
      </p>
      {c.products.map((p) => (
        <Row key={p.product}
          left={<>{productLabel(p.product)}{p.band === 'stale' ? <> <span className="tag">stale</span></> : p.band === 'ageing' ? <> <span className="tag">ageing</span></> : null}</>}
          right={p.ageDays == null ? 'undated' : `${p.ageDays} days old`}
          note={`${p.batchLabel ?? 'unlabelled batch'}, effective ${isoDate(p.effectiveFrom) || 'unknown'}. ${p.bandMeaning ?? ''}`} />
      ))}
      {c.missingDetail.length
        ? c.missingDetail.map((m) => (
          <p key={m.product} className={m.inUse ? 'msg-error' : 'pg-item-note'}>
            No current Base Cost batch for {productLabel(m.product)}.
            {' '}{m.inUse
              ? `This deal carries ${m.units} of them, so those lines priced at ZERO cost. That is an absent cost, not a free product, and the margin on this page is higher than the deal will achieve.`
              : 'This deal carries none of them, so nothing on this page is affected by it.'}
          </p>
        ))
        : <p className="pg-item-note">Every product this deal uses has a current cost basis.</p>}
    </>
  )
}

// ── 5. What is not recorded ──────────────────────────────────────────────
export function NotRecordedBlock({ rows }: { rows: NotRecordedRow[] }) {
  if (!rows.length) {
    return <p className="pg-item-note">Every field on this deal was set by a person. Nothing is running on a default.</p>
  }
  return (
    <>
      <p className="pg-item-note" style={{ marginBottom: 10 }}>
        Every assumption being approved, with where it came from.
        A default is shown as a value and its provenance, never as a blank.
      </p>
      {rows.map((r) => (
        <Row key={r.key} left={label(r.key)} right={r.sentence ?? '--'} note={r.note} />
      ))}
    </>
  )
}
