// ── R2 (WITH R1): THE COMPLETION SURFACE IS PANELS, NOT A LIST ───────────
//
// The previous version rendered one input per key the SERVER named as
// blocking. That was the right answer to the last round's R1 - the list came
// from `computeBlocking` through exit-criteria and was proven equal to it -
// and it carried a defect the list shape makes inevitable:
//
//   `address2` IS NOT IN THE QUALIFY GATE'S FOURTEEN FIELDS.
//
// Correctly: a lead can qualify without a Line 2. But TEN OF FOURTEEN live
// contacts carry one, and a surface that renders only what blocks can never
// offer it. So a person completing an address there could not enter the
// second line at all.
//
// R1 and R2 are therefore ONE FIX, and special-casing address2 into the
// blocking list would have been the wrong half of it.
//
// ── WHAT REPLACES IT ─────────────────────────────────────────────────────
//
// The same three panels the card already shows and edits: contact fields, the
// address panel, the summary. Every field is present and prefilled from the
// record; the ones the SERVER says are blocking are marked. The gate is still
// the only thing that decides whether the lead may move - this surface asks
// the server again after saving rather than deciding for itself.
//
// ── CARD-LOCAL ──────────────────────────────────────────────────────────
//
// Everything here is from `leads/`: leadFields, LeadFieldInput. Phase 0
// measured that nothing outside that folder imports them, so frozen Lead
// Detail is untouched by construction rather than by care.
import { useMemo, useRef, useState } from 'react'
import { useShell } from '../ShellContext'
import { CONTACT_FIELDS, ADDRESS_FIELDS, type LeadField } from './leadFields'
import { LeadFieldInput } from './LeadFieldInput'
import { Panel } from '../ui/Panel'
import { AccountSection, type AccountRef } from './AccountSection'

type Blocking = { field?: string, label?: string, message?: string }

export function QualifyCompletion({
  leadId, blocking, current, industries, sources, regions, onComplete, onCancel, onRefresh,
  mode = 'complete', account, parentRecordId, accountActions, saveLabel, onSaveChanges,
}: {
  leadId: string
  blocking: Blocking[]
  current: Record<string, unknown>
  industries: Array<{ id: string, name: string }>
  sources: string[]
  regions: string[]
  onComplete: () => void
  onCancel: () => void
  /**
   * R3: the PARENT's one refresh path. Reloads the record and re-reads the
   * server's blocking list, returning it. This component does not keep its
   * own copy of either - Phase 0 measured what happens when it tries: the
   * markers were open-time, the values were open-time, and only the count
   * was fresh. Three vintages on one panel.
   */
  onRefresh: () => Promise<Blocking[]>
  /**
   * R3: TWO ENTRY MODES, ONE SURFACE.
   *
   * `complete` is what Qualify opens: the "please complete missing data"
   * framing and a marker on every field the SERVER says is blocking.
   *
   * `view` is the record's detail view: the same fields, the same editing,
   * NO framing and NO markers. Phase 0 measured that the component already
   * renders every field with zero markers when `blocking` is empty - so
   * this is a mode flag and an entry, not a second surface.
   */
  mode?: 'complete' | 'view'
  /**
   * R6: THE ACCOUNT AS THE ROUTE RESOLVED IT. Not an accounts list to
   * search: `GET /contacts` and `GET /contacts/:id` both resolve
   * `parent_record_id` through one helper, so this surface reads the
   * SAME derivation the list does and cannot disagree with it.
   */
  account?: AccountRef | null
  /** R2: `records.parent_record_id`, the one source. Absent for a lead. */
  parentRecordId?: string | null
  accountActions?: React.ReactNode
  saveLabel?: string
  /**
   * THE HOST'S OWN SAVE, when it has one - and the contact surface does.
   *
   * WITHOUT THIS THE SWAP LOSES AN AUDIT TRAIL. `ContactHost.onSave` writes
   * ONE Notes History entry per save session - "Job Title changed from X to
   * Y. City changed from A to B." - through the shared notes writer. This
   * component's own save just PATCHes the payload, so routing the contact's
   * fields through it would have deleted that trail silently: no test on
   * the shared surface could have noticed, because the surface never had
   * the behaviour to lose.
   *
   * Verification 49's clause one layer deeper than a component census
   * reaches: a capability can live in a SAVE PATH, and a census of what a
   * screen RENDERS cannot see it.
   *
   * Given, this component hands over the changed values and does not write.
   * Omitted, the card behaves exactly as before - leads are untouched, and
   * whether a lead edit should also leave a note is a product question this
   * round does not answer.
   */
  onSaveChanges?: (changes: Record<string, string>) => Promise<void> | void
}) {
  const shell = useShell()
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  // R3 SAYS "no missing markers WHEN NOTHING IS MISSING", which an empty
  // blocking list already delivers. The first version of this suppressed
  // markers in view mode ALWAYS - stronger than the requirement, and it
  // deleted the contact screen's qualification tinting, which four tests
  // caught. The mode governs the FRAMING; the server's list governs the
  // marks, in both modes.
  const missing = useMemo(
    () => new Set(blocking.map((b) => b.field).filter(Boolean) as string[]),
    [blocking])

  const summaryRequired = missing.has('summary')
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))
  const valueFor = (k: string) => values[k] ?? str(current[k])
  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }))
  const dirty = Object.keys(values).some((k) => values[k] !== str(current[k]))

  // ── R4: ROUTED THROUGH THE SHELL ────────────────────────────────────
  //
  // This rendered its own `lead-card-col-title` heading per group, and the
  // conformance gate PASSED it - the gate's shell test was a list of three
  // class names and this used none of them. Verification 19 inside the gate
  // built to enforce Verification 19.
  //
  // THE TESTID IS PRESERVED, not derived. Six probe files address this
  // surface's hooks, and last round measured what a silent rename costs:
  // six timeouts that read like product defects.
  const group = (title: string, fields: LeadField[]) => (
    <Panel
      name={`complete-${title.toLowerCase().replace(/\s+/g, '-')}`}
      title={title}
      testid={`lead-complete-${title.toLowerCase().replace(/\s+/g, '-')}-${leadId}`}
      className="lead-complete-group">
      <div className="lead-complete-grid">
        {fields.map((f) => (
          <div className="lead-complete-cell" key={f.key}>
            <label htmlFor={`lead-fix-${f.key}-${leadId}`}>
              {f.label}
              {missing.has(f.key)
                ? <span className="nlg-required" data-testid={`lead-needs-${f.key}-${leadId}`}> *</span>
                : null}
            </label>
            <LeadFieldInput
              field={f}
              value={valueFor(f.key)}
              onChange={(v) => set(f.key, v)}
              industries={industries}
              sources={sources}
              regions={regions}
              testid={`lead-fix-${f.key}-${leadId}`} />
          </div>
        ))}
      </div>
    </Panel>
  )

  const save = async () => {
    if (inFlight.current || !dirty) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      // industry_id is a REAL COLUMN on `records`, not a payload key, and the
      // PATCH route takes it at the top level. Sending it inside `payload`
      // would write a key the gate never reads.
      const payload: Record<string, string> = {}
      let industryId: string | undefined
      for (const [k, v] of Object.entries(values)) {
        if (v === str(current[k])) continue
        if (k === 'industry_id') industryId = v
        else payload[k] = v.trim()
      }
      const body: Record<string, unknown> = {}
      if (Object.keys(payload).length) body.payload = payload
      if (industryId) body.industry_id = industryId

      if (onSaveChanges) {
        // The host owns the write, and with it the change-note trail.
        const changed: Record<string, string> = {}
        for (const [k, v] of Object.entries(values)) {
          if (v === str(current[k])) continue
          changed[k] = v
        }
        await onSaveChanges(changed)
        setValues({})
        return
      }
      const r = await shell.api<{ error?: string }>('PATCH', `/api/contacts/${leadId}`, body)
      if (!r.ok) { setError(r.data?.error ?? 'Could not save.'); return }

      // ── R1 + R4: ONE SAVE-THEN-REFRESH, AND THE ORDER IS THE FIX ───────
      //
      // The previous version fetched exactly this and used only its LENGTH,
      // for the message. So the fresh answer was already in hand and thrown
      // away, which is why the count was right while the markers were wrong.
      //
      // It now goes through the parent's one refresh path, which reloads the
      // RECORD first and then re-reads the blocking list. Clearing the local
      // drafts afterwards is then safe: the fields fall back to a payload
      // that is fresh, instead of to the open-time one that was empty.
      const left = await onRefresh()
      setValues({})
      if (left.length) {
        setError(`Saved. ${left.length} still to complete.`)
        return
      }
      onComplete()
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <div className="lead-qualify-step lead-complete-surface" data-testid={`lead-incomplete-${leadId}`}>
      {mode === 'complete'
        ? <p className="eyebrow">Please complete missing data</p>
        : null}
      <div data-testid={`lead-missing-${leadId}`}>
        {group('Contact details', CONTACT_FIELDS)}
        {group('Address details', ADDRESS_FIELDS)}

        {/* R2: contact-only, decided by the RECORD rather than by a flag.
            A lead has no `parent_record_id` and the section renders
            nothing at all. */}
        <AccountSection
          parentRecordId={parentRecordId}
          account={account}
          actions={accountActions}
          testid={`lead-account-${leadId}`} />

        {/* ── R3: THE PANEL IS MARKED. IT IS NOT POINTED AT ──────────────
            Summary is still edited on the card's own Summary panel, not
            here: two editors of one field with independent drafts meant
            whichever saved last won silently.
            
            What changed is how this surface SAYS so. It used to render a
            heading plus the sentence "Summary is required. Complete it in
            the Summary panel below." - an instruction about where to go.
            R3: do not point, just mark. The asterisk now lives on the real
            Summary panel's own title, through the shell's `required`
            affordance, so the eye lands on the thing that can satisfy it.

            The marker's testid is carried over unchanged: two probes
            address it. */}
        {null}
      </div>
      {error ? <p className="msg-error" data-testid={`lead-fix-error-${leadId}`}>{error}</p> : null}
      {/* R4: the estate's own footer row, not a class of this surface's.
          These actions are SURFACE-scoped - one Save for three panels - so
          they are the modal-footer shape rather than a panel's header line,
          and `form-actions` is the class the estate already declares for
          exactly that. Reusing it beats minting `lead-complete-actions`,
          which the widened gate correctly flagged. */}
      <div className="form-actions">
        <button type="button" className="btn-primary"
          data-testid={`lead-fix-save-${leadId}`}
          disabled={busy || !dirty}
          onClick={() => { void save() }}>
          {busy ? 'Saving...' : (saveLabel ?? 'Save and continue')}
        </button>
        <button type="button" className="btn-ghost"
          data-testid={`lead-incomplete-close-${leadId}`}
          onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
