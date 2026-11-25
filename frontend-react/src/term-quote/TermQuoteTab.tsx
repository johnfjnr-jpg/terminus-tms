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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TermPricingView } from '../term-pricing/TermPricingView'
import { UnsavedStrip } from '../ui/UnsavedStrip'
import { useShell } from '../ShellContext'
import { VersionList } from '../versions/VersionList'
import { formFromInput, inputFromForm } from '../term-pricing/form'
import type { TermQuoteForm } from '../term-pricing/form'
import { issueView, reasonPrompt, versionWhen, versionLabel } from '../versions/model'
import type { DealVersion } from '../versions/model'
import type { VersionSeam } from '../versions/VersionCardHost'
import { pricingMethodOf, PRICING_METHOD_LABELS } from '../../../src/lib/pricing-method.js'
import { CLOSED_WON_PRICING_REFUSAL, WON_STAGE } from '../../../src/lib/pricing-keys.js'
import { buildParams } from '../../../src/lib/term-pricing-settings.js'
import { priceTermVersion, settingsChanged, whatMoved, whatMovedSentence, centsMoney, termQuoteValue, TERM_PRODUCTS } from '../../../src/lib/term-quote.js'

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

// ── L3: A TERM ROW'S FIGURE LINE ─────────────────────────────────────────
//
// A submitted version's FROZEN Base TCV (spec 14.6), read from the list
// route's `ask` (L4). A draft's Base TCV priced on the settings stored WITH IT,
// through priceTermVersion's submitted branch, which prices on the version's
// own `rates.params` (the as-saved figure the reopened notice already uses),
// labelled "as saved" because today's settings may price it differently.
export function termRowFigure(v: DealVersion): string {
  if (v.status === 'issued') return `Base TCV ${money(v.ask?.baseTcv ?? null)}`
  const stored = v.rates?.params ?? null
  const tcv = stored ? priceTermVersion({ ...v, status: 'issued' }, null).tcv : null
  return `Base TCV ${money(tcv)} as saved`
}

export function TermVersionCard({ versions, workingLabel, approvedLabel, seam, api, oppId, onDone, onRestore }: {
  versions: DealVersion[], workingLabel: string | null, approvedLabel: string | null
  seam: VersionSeam, api: Api, oppId: string, onDone: () => void
  /** L5: the host's Restore, which rejects with the refusal's sentence (L6). */
  onRestore: (id: string) => Promise<void>
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
      {/* L1, L2: the shared list, this record's TERM versions only, inside
          this card so a refused Restore reaches this card's feedback line
          (L6). No ids: both tabs are mounted at once. */}
      <div className="tq-version-list" data-testid="tq-versions">
        <VersionList versions={versions.filter((v) => v.kind === 'term_quote')} pending={window.oppPendingPricingApproval?.() ?? null}
          rowTestId="tq-version-row" figureOf={termRowFigure}
          onRestore={async (id) => { setFeedback(null); await onRestore(id) }}
          onRefused={(text) => setFeedback({ text, ok: false })} />
      </div>
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

// ── B: AFTER A RESTORE (TQ_RESTORE, spec 14.9) ───────────────────────────
//
// Ruling B, in its words: shown when the restored version's stored settings
// differ from today's in any value (14.5's comparison, never a timestamp), for
// drafts and submitted versions alike. <saved> is the restored inputs priced
// on the version's OWN settings; <today> the same inputs on today's; the
// difference and the plain-words list are the reopened notice's own builders.
export function RestoredBanner({ label, inputs, storedParams, todayParams }: {
  label: string, inputs: Record<string, unknown>, storedParams: unknown, todayParams: unknown
}) {
  if (!storedParams || !todayParams || !settingsChanged(storedParams, todayParams)) return null
  const savedTcv = (termQuoteValue(inputs, storedParams) as { tcv: number | null }).tcv
  const todayTcv = (termQuoteValue(inputs, todayParams) as { tcv: number | null }).tcv
  const d = savedTcv !== null && todayTcv !== null ? Math.round((todayTcv - savedTcv) * 100) : null
  const diff = d === null ? '--' : `${d >= 0 ? '+' : '-'}${centsMoney(BigInt(Math.abs(d)))}`
  return (
    <div className="tq-status tq-status-warn" role="status" data-testid="tq-restored">
      <div className="tq-status-body">
        {`Restored from ${label}. It was priced at ${money(savedTcv)} on its own settings; today's settings price it at ${money(todayTcv)} (${diff}). `
          + `What moved: ${whatMovedSentence(whatMoved(storedParams, todayParams))}. Save changes to keep it as your working quote.`}
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
  // A newly SAVED quote (after a version, or a reload) is taken into the
  // screen only when the screen holds no unsaved edit of its own. The host was
  // first keyed on the record's revision, so ANY reload that moved the
  // revision (a Reference save, the issue route's own revision) remounted the
  // tab from the saved quote and silently discarded typed changes; the click
  // probe found it (K8). It is keyed on the record alone now.
  const lastSaved = useRef(saved)
  useEffect(() => {
    if (lastSaved.current === saved) return
    const unsaved = JSON.stringify(inputFromForm(form)) !== lastSaved.current
    lastSaved.current = saved
    if (!unsaved) setForm(formFromInput(payload.termQuote as Record<string, unknown>))
  }, [saved])
  // ── S: WHAT COUNTS AS AN UNSAVED EDIT (TQ_RESTORE, spec 14.9) ──────────
  //
  // The seam's `dirty` above says a record holding NO termQuote is unsaved, on
  // purpose: Save version must write the opening values first. That is the
  // wrong question for the strip and the leave guard, which ask whether the
  // PERSON changed anything. Their baseline is the record's saved quote, or,
  // on a record holding none, the form the tab opened with. A save made here
  // moves the baseline at once (`savedNow`), before the reload lands.
  const shell = useShell()
  const [savedNow, setSavedNow] = useState<string | null>(null)
  useEffect(() => { setSavedNow(null) }, [saved])
  const opening = savedNow ?? (payload.termQuote ? saved : JSON.stringify(inputFromForm(formFromInput(undefined as never))))
  const current = JSON.stringify(inputFromForm(form))
  const edited = !pm.won && pm.method === 'term_quote' && current !== opening
  const editedRef = useRef(edited)
  editedRef.current = edited
  // G1: on the shell's one leave guard, asked at the moment of leaving.
  useEffect(() => shell.registerDirtySource('term_quote', () => editedRef.current), [shell])
  const [stripSaving, setStripSaving] = useState(false)
  const [stripError, setStripError] = useState<string | null>(null)
  const saveChanges = async () => {
    setStripSaving(true); setStripError(null)
    try {
      const quote = inputFromForm(form)
      const r = await patch(opp.id, { payload: { termQuote: quote } })
      if (!r.ok) { setStripError((r.data as { error?: string } | undefined)?.error ?? 'The term quote could not be saved.'); return }
      setSavedNow(JSON.stringify(quote))
      setRestored(null)
      reload()
    } finally { setStripSaving(false) }
  }
  // L5 and B: what was restored, so the banner can name it. Cleared when the
  // tab goes back to the saved quote or saves the restored one.
  const [restored, setRestored] = useState<{ label: string, inputs: Record<string, unknown>, storedParams: unknown } | null>(null)
  const resetToSaved = () => {
    setStripError(null)
    setRestored(null)
    setForm(formFromInput((savedNow ? JSON.parse(savedNow) : payload.termQuote) as Record<string, unknown>))
  }

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

  // ── L5, L6, R2, R3: RESTORE INTO THE TERM QUOTE TAB ───────────────────
  //
  // The route only READS (measured, Phase 0 P5), and this writes nothing
  // either: the inputs go into the tab through the seam's populateForm, and
  // the strip then says they are unsaved. Over unsaved edits it asks the one
  // dialogue first, as Commercials does. Every refusal REJECTS with its
  // sentence, which the card shows (L6); Keep editing leaves the promise
  // unsettled, which is "nothing happened".
  const onRestore = (versionId: string): Promise<void> => {
    const go = async () => {
      const r = await api('POST', `/api/deal-sheet-versions/${versionId}/restore`)
      if (!r.ok) throw new Error((r.data as { error?: string } | undefined)?.error ?? 'That version could not be restored.')
      const d = r.data as { kind?: string, label?: string, inputs?: Record<string, unknown> }
      if (d.kind !== 'term_quote') throw new Error(`${d.label ?? 'That version'} is a Commercials version, so it cannot be restored into the term quote.`)
      seam.populateForm(d.inputs ?? {})
      const row = versions.find((v) => v.id === versionId)
      setRestored({ label: d.label ?? (row ? versionLabel(row) ?? '' : ''), inputs: d.inputs ?? {}, storedParams: row?.rates?.params ?? null })
    }
    if (edited) return new Promise<void>((resolve, reject) => { shell.confirmDiscard(() => { go().then(resolve, reject) }) })
    return go()
  }

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
              seam={seam} api={api} oppId={opp.id} onDone={after} onRestore={onRestore} />
            {/* V4: the banner sits UNDER THE VERSION CARD, above the steps
                (artboard 2). It was first rendered inside the view, below the
                step tabs; the 1240 capture showed it there. */}
            {/* B: after a Restore the restored notice speaks for the tab; the
                reopened-draft notice is for the case with no restore and is
                otherwise unchanged. */}
            {restored
              ? <RestoredBanner label={restored.label} inputs={restored.inputs} storedParams={restored.storedParams} todayParams={todayParams} />
              : termDraft ? <ReopenedDraftBanner draft={termDraft} storedParams={storedParams} todayParams={todayParams} /> : null}
            {/* S: the Commercials strip, reused, under the version card and
                its notices and above the steps, as Commercials puts it above
                the sheet a person is editing. */}
            {edited ? <UnsavedStrip onReset={resetToSaved} onSave={() => { void saveChanges() }} saving={stripSaving} /> : null}
            {stripError ? <p className="msg-error" role="alert" data-testid="tq-strip-error">{stripError}</p> : null}
            <TermPricingView navToken={navToken} bound={{ value: form, onChange: setForm }} />
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
