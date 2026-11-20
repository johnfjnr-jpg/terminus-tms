// ── THE APPROVAL PAGE FOR A TERM VERSION (TERM_QUOTES V5, CF2, CF3) ──────
//
// Artboards 4 and 5 of prototypes/term-quote-tab.html. Every figure here is
// the SERVER's (src/lib/approval-page.js assembleTermPage, frozen at
// submission by buildFrozenFigures); this file formats and lays out, and
// computes nothing (Verification 20: a display surface never invents its own
// read).

export interface TermChip { ok: boolean, text: string }
export interface CashFlowCardData {
  peakFunding: { amount: string, month: number, text: string } | null
  noFundingNeed: string | null
  paybackText: string
  paybackSub: string
  factoring: { on: boolean, text: string | null, cost: string | null, treatment: string | null }
}
export interface TermAsk {
  kind: 'term_quote'
  baseTcv: number | null
  margin: string | null
  profit: number | null
  chips: TermChip[]
  cashFlow: CashFlowCardData | null
  sentence: string
  settingsChanged?: boolean
  movedSinceVersion?: string | null
}
export interface ChangedRow { key: string, label: string, before: string, after: string, changed: boolean, delta: string | null }
export interface MethodSide { label: string, method: string, measure: string, figure: number | null, summary?: string, chips?: TermChip[] }
export interface MethodChanged { sentence: string, explanation: string, lastApproved: MethodSide, underReview: MethodSide }

const money = (n: number | null | undefined) => (n === null || n === undefined ? '--'
  : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

export function Chips({ chips }: { chips: TermChip[] }) {
  return (
    <div className="tq-chips" data-testid="tq-chips">
      {chips.map((c) => (
        <span key={c.text} className={`tq-chip${c.ok ? '' : ' tq-chip-flag'}`}>{c.ok ? '✓ ' : '⚑ '}{c.text}</span>
      ))}
    </div>
  )
}

export function TermAskBlock({ ask, frozen }: { ask: TermAsk, frozen: boolean }) {
  const cf = ask.cashFlow
  return (
    <div data-testid="tq-ask">
      <div className="tq-ask-figs">
        <div><div className="label">Base TCV</div><div className="tq-big" data-testid="tq-ask-base">{money(ask.baseTcv)}</div></div>
        <div><div className="label">Margin</div><div className="tq-big" data-testid="tq-ask-margin">{ask.margin ? `${ask.margin}%` : '--'}</div></div>
        <div><div className="label">Profit</div><div className="tq-big" data-testid="tq-ask-profit">{money(ask.profit)}</div></div>
      </div>
      <Chips chips={ask.chips ?? []} />
      {ask.movedSinceVersion ? <p className="pg-item-note" style={{ marginTop: 12 }}>{ask.movedSinceVersion}</p> : null}
      {cf ? (
        <section className="pg-card" style={{ marginTop: 16 }} data-testid="tq-cashflow">
          <p className="pg-card-title">Cash flow{frozen ? ' · frozen at submission' : ''}</p>
          <div className="tq-cashflow">
            <div>
              <div className="label">Peak funding need</div>
              <div data-testid="tq-cf-peak">{cf.peakFunding ? cf.peakFunding.text : cf.noFundingNeed}</div>
            </div>
            <div>
              <div className="label">Month of payback</div>
              <div data-testid="tq-cf-payback">{cf.paybackText}</div>
              <div className="pg-item-note">{cf.paybackSub}</div>
            </div>
            <div data-testid="tq-cf-factoring">
              {cf.factoring.on ? (
                <>
                  <div className="label">Factoring cost</div>
                  <div>{cf.factoring.cost}</div>
                  <div className="pg-item-note">{cf.factoring.treatment}</div>
                </>
              ) : <div className="label">{cf.factoring.text}</div>}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

export function WhatChangedBlock({ baselineLabel, underReviewLabel, rows, note }: {
  baselineLabel: string, underReviewLabel: string, rows: ChangedRow[], note: string
}) {
  return (
    <div data-testid="tq-changed">
      <table className="tp-table tq-changed">
        <thead><tr><th>Input</th><th>{`${baselineLabel} approved`}</th><th>{`${underReviewLabel} under review`}</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.changed ? 'tq-chg' : 'tq-same'} data-testid={`tq-changed-${r.key}`} data-changed={String(r.changed)}>
              <td>{r.label}</td><td>{r.before}</td><td>{r.after}</td>
              <td>{r.changed ? (r.delta ?? 'changed') : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="pg-item-note" style={{ marginTop: 10 }}>{note}</p>
    </div>
  )
}

export function MethodChangedBlock({ m }: { m: MethodChanged }) {
  const side = (s: MethodSide, review: boolean) => (
    <section className="pg-card" data-testid={review ? 'tq-method-review' : 'tq-method-approved'}>
      <p className="pg-card-title">{`${review ? 'Under review' : 'Last approved'} · ${s.label} · ${s.method}`}</p>
      <div className="label">{s.measure}</div>
      <div className="tq-big">{money(s.figure)}</div>
      {s.summary ? <p className="pg-item-note" style={{ marginTop: 8 }}>{s.summary}</p> : null}
      {s.chips?.length ? <Chips chips={s.chips} /> : null}
    </section>
  )
  return (
    <div data-testid="tq-method-changed">
      <div className="tq-status tq-status-warn" role="status">
        <b>{`⚠ ${m.sentence}`}</b> <span className="tq-status-body">{m.explanation}</span>
      </div>
      <div className="tq-method-grid">{side(m.lastApproved, false)}{side(m.underReview, true)}</div>
    </div>
  )
}
