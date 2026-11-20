// ── THE TERM QUOTE TAB ON THE OPPORTUNITY (TERM_QUOTES V1 to V6) ─────────
//
// Built to the approved mockup, prototypes/term-quote-tab.html (six
// artboards, John 2026-11-20). Every departure from it is named where it is
// made, with its reason, and listed in the round report.
//
// THE SEAM IS THE INTERFACE (VersionCardHost, Round 4 Phase 2). The term
// version card is handed a SECOND seam implementation, `termQuoteSeam`, and
// never reaches into the view: it asks the seam to freeze the quote (save the
// record's termQuote) and posts what the seam returns.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { TermPricingView } from '../term-pricing/TermPricingView'
import { formFromInput, inputFromForm } from '../term-pricing/form'
import type { TermQuoteForm } from '../term-pricing/form'
import { issueView, reasonPrompt, versionWhen, versionLabel } from '../versions/model'
import type { DealVersion } from '../versions/model'
import type { VersionSeam } from '../versions/VersionCardHost'
import { pricingMethodOf, PRICING_METHOD_LABELS } from '../../../src/lib/pricing-method.js'
import { CLOSED_WON_PRICING_REFUSAL, WON_STAGE } from '../../../src/lib/pricing-keys.js'
import { buildParams } from '../../../src/lib/term-pricing-settings.js'
import { priceTermVersion, settingsChanged, whatMoved, whatMovedSentence, centsMoney, TERM_PRODUCTS } from '../../../src/lib/term-quote.js'

type Method = 'term_quote' | 'commercials'
type ApiResult = { ok: boolean, status?: number, data?: unknown }
export type Api = (method: string, path: string, body?: unknown) => Promise<ApiResult>
export type Patch = (id: string, body: unknown) => Promise<ApiResult>

export interface TermOpp {
  id: string
  status: string
  payload?: Record<string, unknown>
  working_version?: string | null
  approved_version?: string | null
  won_version?: { id: string, kind: Method, label: string, inputs: Record<string, unknown> | null, ask: Record<string, unknown> | null, basis?: string | null } | null
}

const money = (n: number | null | undefined) => (n === null || n === undefined ? '--'
  : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

// ── V2: THE PRICING METHOD SELECTOR, ON BOTH PRICING TABS ────────────────

export function PricingMethodBar({ method, disabled, busy, onChoose, note }: {
  method: Method, disabled?: boolean, busy?: boolean, onChoose: (m: Method) => void, note?: string | null
}) {
  return (
    <div className="pm-bar" data-testid="pm-bar">
      <div className="pm-bar-left">
        <span className="label" id="pm-label">Pricing method</span>
        <div className="view-toggle" role="radiogroup" aria-labelledby="pm-label">
          {(['term_quote', 'commercials'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={method === m}
              className={method === m ? 'active' : ''} data-testid={`pm-${m}`}
              disabled={disabled || busy} onClick={() => { if (m !== method) onChoose(m) }}>{PRICING_METHOD_LABELS[m]}</button>
          ))}
        </div>
      </div>
      {note ? <span className="pg-item-note" data-testid="pm-note">{note}</span> : null}
    </div>
  )
}

// Artboard 3's line and switching note. The mockup draws the Commercials tab
// on a term-priced deal; the Term quote tab on a Commercials-priced deal is
// its mirror, worded the same way (a departure the mockup does not show).
export function InactiveCard({ inUse }: { inUse: Method }) {
  const other: Method = inUse === 'term_quote' ? 'commercials' : 'term_quote'
  const how = other === 'commercials' ? 'bottom-up' : 'as a term quote'
  const kept = inUse === 'term_quote' ? 'The term quote' : 'The Commercials pricing'
  return (
    <section className="pg-card pm-inactive" data-testid="pm-inactive">
      <p className="pm-inactive-head">{`Not in use. This deal is priced by ${PRICING_METHOD_LABELS[inUse]}.`}</p>
      <p className="pg-item-note">
        {`To price it ${how} instead, choose ${PRICING_METHOD_LABELS[other]} above. ${kept} stays saved, so you can switch back. `
          + 'Whichever method you submit next becomes a new major version, and approval starts again.'}
      </p>
    </section>
  )
}

/** The bar and, when its method is not in use, the inactive line: what a pricing tab opens with. */
export function usePricingMethod(opp: TermOpp, patch: Patch, reload: () => void) {
  const method = pricingMethodOf(opp.payload ?? {}) as Method
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const choose = async (m: Method) => {
    setBusy(true); setError(null)
    try {
      const r = await patch(opp.id, { payload: { pricingMethod: m } })
      if (!r.ok) { setError((r.data as { error?: string } | undefined)?.error ?? 'The pricing method could not be changed.'); return }
      reload()
    } finally { setBusy(false) }
  }
  return { method, busy, error, choose, won: opp.status === WON_STAGE }
}

// ── V3: THE TERM VERSION CARD, ON THE SECOND SEAM ────────────────────────

export function termQuoteSeam({ form, saved, opp, patch, setForm }: {
  form: TermQuoteForm, saved: string, opp: TermOpp, patch: Patch, setForm: (f: TermQuoteForm) => void
}): VersionSeam & { kind: 'term_quote' } {
  const current = () => inputFromForm(form) as unknown as Record<string, unknown>
  const dirty = () => JSON.stringify(current()) !== saved
  return {
    kind: 'term_quote',
    // Saving a version saves the record's working inputs first, the same
    // single act the Commercials seam makes (Round 38: save-then-version).
    async freezeCurrentState() {
      const payload = current()
      if (dirty()) {
        const r = await patch(opp.id, { payload: { termQuote: payload } })
        if (!r.ok) throw new Error((r.data as { error?: string } | undefined)?.error ?? 'The term quote could not be saved.')
      }
      return { payload, contractorMilestones: [], catalogRates: {} }
    },
    hasUnsavedChanges: dirty,
    readContractorMilestones: () => [],
    populateForm: (inputs) => setForm(formFromInput(inputs)),
    recompute: () => null,
  }
}

export function TermVersionCard({ versions, workingLabel, approvedLabel, seam, api, oppId, onDone }: {
  versions: DealVersion[], workingLabel: string | null, approvedLabel: string | null
  seam: VersionSeam, api: Api, oppId: string, onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<null | 'save' | 'issue'>(null)
  const [feedback, setFeedback] = useState<{ text: string, ok: boolean } | null>(null)
  const prompt = reasonPrompt(versions.length)
  const issue = issueView(versions)
  const latest = versions[0] ?? null

  const save = async () => {
    if (!reason.trim()) { setFeedback({ text: prompt.refusal, ok: false }); return }
    setBusy('save'); setFeedback(null)
    try {
      const frozen = await seam.freezeCurrentState()
      const r = await api('POST', `/api/opportunities/${oppId}/deal-sheet-versions`, {
        kind: 'term_quote', inputs: frozen.payload, reason,
        expected_revision: window.getOppLoadedRevision?.() ?? null,
      })
      if (!r.ok) { setFeedback({ text: (r.data as { error?: string } | undefined)?.error ?? 'The version could not be saved.', ok: false }); return }
      setReason('')
      onDone()
    } catch (e) {
      setFeedback({ text: (e as Error).message, ok: false })
    } finally { setBusy(null) }
  }
  const submit = async () => {
    const highest = versions.find((v) => v.status === 'issued')?.major ?? 0
    const draft = versions.find((v) => v.status === 'draft' && v.major === highest)
    if (!draft) return
    setBusy('issue'); setFeedback(null)
    try {
      const r = await api('POST', `/api/deal-sheet-versions/${draft.id}/issue`)
      if (!r.ok) { setFeedback({ text: (r.data as { error?: string } | undefined)?.error ?? 'The version could not be submitted for approval.', ok: false }); return }
      onDone()
    } finally { setBusy(null) }
  }

  return (
    <section className="pg-card tq-version" data-testid="tq-version">
      <div className="tq-version-figs">
        <div>
          <div className="label">Working version</div>
          <div data-testid="tq-working">{workingLabel ?? 'None'}
            {latest ? <span className="pg-item-note" style={{ display: 'inline' }}>{` · ${latest.status === 'issued' ? 'Submitted' : 'Draft'} · saved ${versionWhen(latest)}`}</span> : null}
          </div>
        </div>
        <div><div className="label">Approved version</div><div data-testid="tq-approved">{approvedLabel ?? 'None'}</div></div>
      </div>
      <div className="tq-version-actions">
        <button type="button" className="btn-secondary" data-testid="tq-save" disabled={!!busy}
          onClick={() => { void save() }}>{busy === 'save' ? 'Saving...' : 'Save version'}</button>
        <button type="button" className="btn-primary" data-testid="tq-submit" disabled={!!busy || issue.disabled} title={issue.title}
          onClick={() => { void submit() }}>{busy === 'issue' ? 'Submitting...' : issue.label}</button>
      </div>
      {/* DEPARTURE from artboard 1, which draws no reason box: a version's
          reason is required by the database and read by the approval page
          (Verification 22), so the card asks for it in the version card's own
          words (reasonPrompt), as the Commercials card does. */}
      <label className="tq-version-reason">
        <span className="label">{prompt.label}</span>
        <textarea rows={2} data-testid="tq-reason" placeholder={prompt.placeholder} value={reason}
          onChange={(e) => setReason(e.target.value)} />
      </label>
      {feedback ? <p className={feedback.ok ? 'msg-success' : 'msg-error'} data-testid="tq-feedback" role="alert">{feedback.text}</p> : null}
    </section>
  )
}

// ── V4: THE REOPENED DRAFT ───────────────────────────────────────────────

export function ReopenedDraftBanner({ draft, storedParams, todayParams }: {
  draft: DealVersion & { inputs?: Record<string, unknown> }, storedParams: unknown, todayParams: unknown
}) {
  if (!storedParams || !todayParams || !settingsChanged(storedParams, todayParams)) return null
  const asIssued = { ...draft, status: 'issued', rates: { params: storedParams } }
  const savedTcv = priceTermVersion(asIssued, todayParams).tcv
  const todayTcv = priceTermVersion({ ...draft, status: 'draft', rates: { params: storedParams } }, todayParams).tcv
  const label = versionLabel(draft) ?? ''
  const diff = savedTcv !== null && todayTcv !== null ? Math.round((todayTcv - savedTcv) * 100) : null
  const moved = whatMovedSentence(whatMoved(storedParams, todayParams))
  return (
    <div className="tq-status tq-status-warn" role="status" data-testid="tq-reopened">
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{`⚠ Settings changed since ${label} was saved`}</div>
      <div className="tq-status-body">
        {`This quote now prices on today's Settings. ${label} was saved at Base TCV `}
        <span data-testid="tq-reopened-saved">{money(savedTcv)}</span>{'; today it prices at '}
        <span data-testid="tq-reopened-today">{money(todayTcv)}</span>
        {diff !== null ? <>{' ('}<span data-testid="tq-reopened-diff">{`${diff >= 0 ? '+' : '-'}${centsMoney(BigInt(Math.abs(diff)))}`}</span>{')'}</> : null}
        {'. What moved: '}<span data-testid="tq-reopened-moved">{moved}</span>
        {'. Save a version to keep today\'s figures, or submit it as it stands.'}
      </div>
    </div>
  )
}

// ── V6: CLOSED WON ───────────────────────────────────────────────────────

export function WonPanel({ won }: { won: TermOpp['won_version'] }) {
  const ask = (won?.ask ?? {}) as { baseTcv?: number, margin?: string, months?: number }
  const units = (won?.inputs?.units ?? {}) as Record<string, number>
  return (
    <>
      <div className="tq-status tq-status-won" role="status" data-testid="tq-won">
        <b>{CLOSED_WON_PRICING_REFUSAL}</b>
        <span className="tq-status-body">
          {won ? ` Won version ${won.label}. No new version can be saved or submitted.` : ' No new version can be saved or submitted.'}
        </span>
      </div>
      {won && won.kind === 'term_quote' ? (
        <>
          <div className="tq-won-grid">
            <section className="pg-card">
              <p className="pg-card-title">Units · read only</p>
              {TERM_PRODUCTS.map((p) => (
                <label key={p.key} className="tq-line"><span className="label">{p.label}</span>
                  <input className="tp-num" value={String(units[p.key] ?? 0)} disabled readOnly data-testid={`tq-won-units-${p.key}`} /></label>
              ))}
            </section>
            <section className="pg-card" data-testid="tq-won-version">
              <p className="pg-card-title">{`Won version ${won.label}`}</p>
              <div className="tq-line"><span className="label">Term</span><span>{`${won.inputs?.termMonths ?? '--'} months`}</span></div>
              <div className="tq-line"><span className="label">Payment basis</span><span>{won.basis ?? '--'}</span></div>
              <div className="tq-line"><span className="label">Base TCV</span><span data-testid="tq-won-base">{money(ask.baseTcv)}</span></div>
              <div className="tq-line"><span className="label">Margin</span><span>{ask.margin ? `${ask.margin}%` : '--'}</span></div>
            </section>
          </div>
          <p className="pg-item-note">Figures shown are the won version&apos;s frozen figures, not a live reprice.</p>
        </>
      ) : null}
    </>
  )
}

// ── THE HOST ─────────────────────────────────────────────────────────────

export function TermQuoteHost({ opp, api, patch, reload, navToken }: {
  opp: TermOpp, api: Api, patch: Patch, reload: () => void, navToken: number
}) {
  const payload = opp.payload ?? {}
  const pm = usePricingMethod(opp, patch, reload)
  const [form, setForm] = useState<TermQuoteForm>(() => formFromInput(payload.termQuote as Record<string, unknown>))
  // What the RECORD holds. A record with no termQuote holds nothing, so the
  // screen's opening values are unsaved and Save version writes them first;
  // comparing them with themselves read "saved" and versioned a quote the
  // record never held (found by the tab's own test).
  const saved = useMemo(() => (payload.termQuote
    ? JSON.stringify(inputFromForm(formFromInput(payload.termQuote as Record<string, unknown>))) : 'null'), [payload.termQuote])
  const [versions, setVersions] = useState<DealVersion[]>([])
  const [todayParams, setTodayParams] = useState<unknown>(null)
  const [storedParams, setStoredParams] = useState<unknown>(null)

  const loadVersions = useCallback(async () => {
    const r = await api('GET', `/api/opportunities/${opp.id}/deal-sheet-versions`)
    setVersions(r.ok && Array.isArray(r.data) ? r.data as DealVersion[] : [])
  }, [api, opp.id])
  useEffect(() => { void loadVersions() }, [loadVersions, navToken])
  useEffect(() => {
    void (async () => {
      const r = await api('GET', '/api/term-pricing')
      const d = r.data as { settings?: Record<string, unknown>, costs?: Record<string, unknown> } | undefined
      setTodayParams(r.ok && d?.settings && d?.costs ? buildParams(d.settings as never, d.costs as never) : null)
    })()
  }, [api, navToken])

  // The reopened draft: the working version, when it is a term DRAFT. Its
  // stored settings come from the row itself (the list does not carry rates).
  const latest = versions[0] ?? null
  const termDraft = latest && latest.kind === 'term_quote' && latest.status === 'draft' ? latest : null
  useEffect(() => {
    if (!termDraft) { setStoredParams(null); return }
    void (async () => {
      const r = await api('GET', `/api/deal-sheet-versions/${termDraft.id}`)
      setStoredParams(r.ok ? ((r.data as { rates?: { params?: unknown } } | undefined)?.rates?.params ?? null) : null)
    })()
  }, [api, termDraft?.id])

  const seam = termQuoteSeam({ form, saved, opp, patch, setForm })
  const after = () => { void loadVersions(); reload() }

  return (
    <div data-testid="tq-tab">
      <div className="pm-host">
        <PricingMethodBar method={pm.method} disabled={pm.won} busy={pm.busy} onChoose={(m) => { void pm.choose(m) }}
          note={pm.method === 'term_quote' && !pm.won ? 'Default for new deals' : null} />
        {pm.error ? <p className="msg-error" role="alert" data-testid="pm-error">{pm.error}</p> : null}
      </div>
      {pm.won ? <WonPanel won={opp.won_version ?? null} />
        : pm.method !== 'term_quote' ? <InactiveCard inUse={pm.method} />
        : (
          <>
            <TermVersionCard versions={versions} workingLabel={opp.working_version ?? null} approvedLabel={opp.approved_version ?? null}
              seam={seam} api={api} oppId={opp.id} onDone={after} />
            <TermPricingView navToken={navToken} bound={{
              value: form,
              onChange: setForm,
              banner: termDraft ? <ReopenedDraftBanner draft={termDraft} storedParams={storedParams} todayParams={todayParams} /> : null,
            }} />
          </>
        )}
    </div>
  )
}

/** The Commercials tab's half of V2: the same bar, and the inactive line when Term quote is in use. */
export function CommercialsMethodHost({ opp, patch, reload }: { opp: TermOpp, patch: Patch, reload: () => void }) {
  const pm = usePricingMethod(opp, patch, reload)
  // V2: "the inactive tab shows only" the line. The pane's other content is
  // the vanilla shell's and the Commercials panel's, so it is hidden by one
  // attribute on this host's own pane, read by one CSS rule.
  useEffect(() => {
    const pane = document.getElementById('opp-tab-commercial')
    if (pane) pane.setAttribute('data-pricing-inactive', String(pm.method !== 'commercials'))
  }, [pm.method])
  return (
    <>
      <PricingMethodBar method={pm.method} disabled={pm.won} busy={pm.busy} onChoose={(m) => { void pm.choose(m) }} />
      {pm.error ? <p className="msg-error" role="alert">{pm.error}</p> : null}
      {pm.method !== 'commercials' ? <InactiveCard inUse={pm.method} /> : null}
    </>
  )
}
