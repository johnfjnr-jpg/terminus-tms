// ── ROUND 7 PHASE 1a: THE TEST BED SURFACE'S DATA AND WRITES ────────────
//
// The panel does not fetch, save, or know about routes. This holds those.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TestBedPanel } from './TestBedPanel'
import { PAYLOAD_ONLY_KEYS, CLIENT_BUYER_ROLES, type TestBedSource } from './descriptors'
import { createPreviewRunner } from './costPreview'
import { useShell } from '../ShellContext'
import type { LookupOption } from '../field-row/types'
import { NotesHistory } from '../contact/NotesHistory'
import { note, prepend, type Note } from '../contact/notes'
import { StageTabs, type StageTabsDeps } from './StageTabs'
import { UseCasesList } from './UseCasesList'
import { DERIVE_ROUTE, UNITS_ROUTE, type Unit } from './units'
import { SCORE_ROUTE, type Criterion } from './scoring'
import type { ScoreEntry } from './scoreReason'
import type { Stage } from './stageLoad'
import { InstallSection } from './InstallSection'
import { CustomerDocsPanel } from './CustomerDocsPanel'
import { HistoryPanel } from './HistoryPanel'
import { INSTALLER_ROUTE, type AccountOption, type Installer } from './installer'
import { TECH_TEAM_ROUTE, type ContactOption } from './techTeam'
import { validityOf, validationMessage, VALIDATION_OWNER, type NumericField } from './validation'
import { CUSTOMER_DOCS_ROUTE, customerDocRoute, type CustomerDoc } from './customerDocs'
import type { InstallNote } from './installNotes'
import { HISTORY_ROUTE, type HistoryEntry } from './history'

/**
 * V7: the numeric fields the validation banner speaks for.
 *
 * Declared from the descriptor list rather than typed a second time would be
 * better still; these three are the integer counts, which are the only fields
 * whose `integer` rule the vanilla asserts.
 */
const NUMERIC_FIELDS: NumericField[] = [
  { key: 'safesightCameras', label: 'SafeSight cameras', integer: true },
  { key: 'airQualitySensors', label: 'Air quality sensors', integer: true },
  { key: 'hemirSensors', label: 'HEMIR sensors', integer: true },
]

interface BedLike {
  id: string
  status?: string
  payload?: Record<string, unknown>
  buyer_contacts?: Array<{ role?: string, contact_id?: string, name?: string }>
  installer?: Installer | null
  account_id?: string | null
  account?: { id?: string } | null
  latest_revision_number?: number | null
  costBreakdown?: unknown
}

/**
 * ── THE SAVE, PER THE FIXED VANILLA SHAPE ───────────────────────────────
 *
 * Only-dirty, through one PATCH, carrying the revision as a precondition. This
 * is the construction Round 38 deleted by accident and Phase 0b restored: for
 * three rounds `payloadUpdate` was referenced and declared nowhere, so every
 * save threw and wrote nothing.
 *
 * `estCostPerUnit` and `indicativeCost` are payload keys and NOT rows, so they
 * can never be dirty and never appear here - which is the point of separating
 * the render list from the save list.
 */
export function buildPayload(changes: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(changes)) {
    if (k.startsWith('buyer-')) continue // its own route, not this payload
    if ((PAYLOAD_ONLY_KEYS as readonly string[]).includes(k)) continue
    out[k] = v
  }
  return out
}

export function TestBedHost({ bed }: { bed: BedLike }) {
  const shell = useShell()
  const [record, setRecord] = useState<BedLike>(bed)
  const [staff, setStaff] = useState<string[]>([])
  const [contacts, setContacts] = useState<LookupOption[]>([])
  const [preview, setPreview] = useState<unknown | null>(null)
  const [feedback, setFeedback] = useState<{ text: string | null, html?: string | null, ok: boolean } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [units, setUnits] = useState<Unit[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [scoring, setScoring] = useState<Record<string, Criterion[]>>({})
  const [seriesByKey, setSeriesByKey] = useState<Record<string, ScoreEntry[]>>({})
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [installerContacts, setInstallerContacts] = useState<ContactOption[]>([])
  const [customerDocs, setCustomerDocs] = useState<CustomerDoc[]>([])
  const [history, setHistory] = useState<{ entries: HistoryEntry[], failed: boolean }>(
    { entries: [], failed: false })
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => { setRecord(bed) }, [bed])

  // The stage list and the units, both of which the tab shell needs before a
  // stage tab can decide whether it is terminal (P4).
  useEffect(() => {
    let live = true
    void shell.api<Stage[]>('GET', '/api/stages?record_type=test_bed').then((r) => {
      if (live && r.ok && Array.isArray(r.data)) setStages(r.data)
    })
    return () => { live = false }
  }, [shell])

  const loadUnits = useCallback(async () => {
    const r = await shell.api<Unit[]>('GET', UNITS_ROUTE(bed.id))
    if (r.ok && Array.isArray(r.data)) setUnits(r.data)
  }, [shell, bed.id])

  useEffect(() => { void loadUnits() }, [loadUnits])

  // I7: `accountsCache` is a module-scope `let` in app.js and unreachable from
  // a bundle, so the surface fetches its own. The same ruling terminusStaffCache
  // already forced.
  useEffect(() => {
    let live = true
    void shell.api<AccountOption[]>('GET', '/api/accounts').then((r) => {
      if (live && r.ok && Array.isArray(r.data)) setAccounts(r.data)
    })
    return () => { live = false }
  }, [shell])

  // E1: the tech team comes from the INSTALLER's Account, which is a different
  // Account from the record's own - so this is a second contacts fetch, not a
  // reuse of the buyer one.
  const installerAccountId = (record.installer as { id?: string } | null)?.id ?? null
  useEffect(() => {
    let live = true
    if (!installerAccountId) { setInstallerContacts([]); return }
    void shell.api<ContactOption[]>(
      'GET', `/api/accounts/${installerAccountId}/contacts`).then((r) => {
      if (live && r.ok && Array.isArray(r.data)) setInstallerContacts(r.data)
    })
    return () => { live = false }
  }, [shell, installerAccountId])

  const loadCustomerDocs = useCallback(async () => {
    const r = await shell.api<CustomerDoc[]>('GET', CUSTOMER_DOCS_ROUTE(bed.id))
    setCustomerDocs(r.ok && Array.isArray(r.data) ? r.data : [])
  }, [shell, bed.id])
  useEffect(() => { void loadCustomerDocs() }, [loadCustomerDocs])

  useEffect(() => {
    let live = true
    void shell.api<{ entries?: HistoryEntry[] }>('GET', HISTORY_ROUTE(bed.id)).then((r) => {
      if (!live) return
      setHistory(r.ok ? { entries: r.data?.entries ?? [], failed: false }
        : { entries: [], failed: true })
    })
    return () => { live = false }
  }, [shell, bed.id])

  // The surface fetches its own staff: `terminusStaffCache` is a module-scope
  // `let` in app.js that no bundle can read. Round 5's ruling, applied again.
  useEffect(() => {
    let live = true
    void shell.api<Array<{ name: string }>>('GET', '/api/terminus-staff').then((r) => {
      if (live && r.ok && Array.isArray(r.data)) setStaff(r.data.map((s) => s.name))
    })
    return () => { live = false }
  }, [shell])

  useEffect(() => {
    let live = true
    const accountId = record.account?.id
    if (!accountId) return
    void shell.api<Array<{ id: string, payload?: { name?: string } }>>(
      'GET', `/api/accounts/${accountId}/contacts`).then((r) => {
      if (live && r.ok && Array.isArray(r.data)) {
        setContacts(r.data.map((c) => ({ id: c.id, name: c.payload?.name ?? c.id })))
      }
    })
    return () => { live = false }
  }, [shell, record.account?.id])

  const source: TestBedSource = useMemo(() => ({
    payload: record.payload ?? {}, staff,
  }), [record, staff])

  const buyers = useMemo(() => {
    const out: Record<string, string> = {}
    for (const role of CLIENT_BUYER_ROLES) {
      out[role] = (record.buyer_contacts ?? []).find((c) => c.role === role)?.contact_id ?? ''
    }
    return out
  }, [record])

  const load = useCallback(async () => {
    const r = await shell.api<BedLike>('GET', `/api/test-beds/${bed.id}`)
    if (r.ok && r.data) setRecord(r.data)
  }, [shell, bed.id])

  // ── THE COST PREVIEW, with its ordering guard. C1-C9 ─────────────────
  const runner = useRef(createPreviewRunner(
    async (body) => shell.api('POST', '/api/test-beds/calculate', body),
    (data) => setPreview(data),
  ))

  const onDraftsChange = useCallback((next: Record<string, string>) => {
    setDrafts(next)
    runner.current.schedule(next, record.payload ?? {})
  }, [record.payload])

  useEffect(() => () => { runner.current.cancel() }, [])

  // V6/V7: validity is derived from the live drafts, and it GATES the save.
  const invalid = useMemo(() => validityOf(drafts, NUMERIC_FIELDS), [drafts])
  const invalidMessage = validationMessage(invalid)

  const onSave = async (changes: Record<string, string>) => {
    // V2: refused before any request, and the message says WHICH field and WHY.
    if (invalidMessage) return
    setFeedback(null)
    const payload = buildPayload(changes)
    if (!Object.keys(payload).length) return
    const r = await shell.api<{ error?: string, revision_number?: number }>(
      'PATCH', `/api/test-beds/${bed.id}`, {
        payload,
        expected_revision: Number.isInteger(record.latest_revision_number)
          ? record.latest_revision_number : null,
      })
    if (!r.ok) {
      // ONE RENDERER for the stale sentence, and the shell owns it: a surface
      // wording its own drops the reload control the shell's carries.
      const html = r.status === 409 ? shell.staleWriteHtml(bed.id) : null
      setFeedback({
        text: html ? null : (r.data?.error
          ?? (r.status === 409
            ? 'This Test Bed changed since the screen loaded. Reload before saving.'
            : 'Failed to save.')),
        html, ok: false,
      })
      return
    }
    setFeedback({ text: 'Saved.', html: null, ok: true })
    await load()
  }

  const notes = (record.payload?.notes as Note[] | undefined) ?? []

  /**
   * The whole-list write the use cases and the exit tick both need.
   *
   * ONE writer, because both are a record PATCH carrying the revision as the
   * precondition, and two would be Verification 20's shape on the save path.
   */
  const patchPayload = useCallback(async (payload: Record<string, unknown>) => {
    const r = await shell.api<{ error?: string }>('PATCH', `/api/test-beds/${bed.id}`, {
      payload,
      expected_revision: Number.isInteger(record.latest_revision_number)
        ? record.latest_revision_number : null,
    })
    if (!r.ok) {
      setFeedback({
        text: r.status === 409
          ? 'This Test Bed changed since the screen loaded. Reload before saving.'
          : (r.data?.error ?? 'Failed to save.'),
        html: null, ok: false,
      })
      if (r.status === 409) await load()
      return false
    }
    await load()
    return true
  }, [shell, bed.id, record.latest_revision_number, load])

  const stageDeps: StageTabsDeps = useMemo(() => ({
    stages,
    documents: (stage) => shell.api(
      'GET', `/api/test-beds/${bed.id}/document-requirements?stage=${encodeURIComponent(stage)}`),
    criteria: (stage) => shell.api(
      'GET', `/api/records/${bed.id}/exit-criteria?stage=${encodeURIComponent(stage)}`),
    approvals: () => shell.api('GET', `/api/records/${bed.id}/stage-approvals`),
    scoringCriteria: (stage) => scoring[stage] ?? [],
    series: (key) => seriesByKey[key] ?? [],
    onTick: (payload) => { void patchPayload(payload) },
    onRecordScores: (drafts, reasons) => {
      void (async () => {
        const entries = Object.entries(drafts).map(([criterion_key, score]) => ({
          criterion_key, score: Number(score), reason: reasons[criterion_key] ?? null,
        }))
        const r = await shell.api<{ error?: string, series?: Record<string, ScoreEntry[]> }>(
          'POST', SCORE_ROUTE(bed.id), { entries })
        if (!r.ok) {
          setFeedback({ text: r.data?.error ?? 'Failed to record scores.', html: null, ok: false })
          return
        }
        if (r.data?.series) setSeriesByKey(r.data.series)
        await load()
      })()
    },
    onDeriveUnits: async () => {
      const r = await shell.api('POST', DERIVE_ROUTE(bed.id), {})
      if (r.ok) await loadUnits()
    },
    unitDeps: {
      patch: (unitId, field, value, expectedRevision) => shell.api(
        'PATCH', `/api/units/${unitId}`,
        { payload: { [field]: value }, expected_revision: expectedRevision }),
      unitById: (unitId) => units.find((u) => u.id === unitId),
      onUnit: (unit) => setUnits((us) => us.map(
        (u) => (u.id === (unit as Unit).id ? (unit as Unit) : u))),
    },
  }), [shell, bed.id, stages, scoring, seriesByKey, units, patchPayload, load, loadUnits])

  const installSectionNode = (
    <InstallSection
      installer={record.installer ?? null}
      ownAccountId={record.account_id ?? record.account?.id ?? null}
      accounts={accounts}
      installerContacts={installerContacts}
      linkedTechTeam={(record.buyer_contacts ?? [])
        .find((c) => c.role === 'Test Bed Tech Team')?.contact_id ?? null}
      notes={record.payload?.installNotes as InstallNote[] | undefined}
      author={shell.currentUserEmail()}
      now={() => new Date().toISOString()}
      onSetInstaller={async (accountId) => {
        const r = await shell.api<{ cleared_tech_team?: boolean }>(
          'PATCH', INSTALLER_ROUTE(bed.id), { installer_account_id: accountId })
        if (!r.ok) return null
        await load()
        return r.data ?? {}
      }}
      onSetTechTeam={async (contactId) => {
        const r = await shell.api('POST', TECH_TEAM_ROUTE(bed.id), { contact_id: contactId })
        if (r.ok) await load()
      }}
      onWriteNotes={(next) => patchPayload({ installNotes: next })} />)

  const customerDocsNode = (
    <CustomerDocsPanel docs={customerDocs}
      onAdd={async (name, url) => {
        const r = await shell.api('POST', CUSTOMER_DOCS_ROUTE(bed.id), { name, url })
        if (!r.ok) return false
        await loadCustomerDocs()
        return true
      }}
      onRemove={async (docId) => {
        const r = await shell.api('DELETE', customerDocRoute(bed.id, docId))
        if (r.ok) await loadCustomerDocs()
      }} />)

  const useCasesNode = (
    <UseCasesList useCases={record.payload?.useCases as string[] | undefined}
      onWrite={(next) => patchPayload({ useCases: next })} />)

  return (
    <div data-testid="testbed-host">
      <StageTabs
        payload={record.payload ?? {}}
        units={units}
        landing={null}
        fresh
        currentStage={record.status ?? ''}
        nextStage={null}
        deps={stageDeps}
        installSection={installSectionNode}
        commercials={null}
        reference={<TestBedPanel
        source={source}
        contacts={contacts}
        buyers={buyers}
        onSave={(c) => { void onSave(c) }}
        onDirtyChange={setDirty}
        onDraftsChange={onDraftsChange}
        costBreakdown={
          <div data-testid="tb-cost-breakdown"
            className={preview ? 'tb-cost-unsaved' : undefined}>
            {/* C4: the marker says these figures come from UNSAVED drafts. A
                preview is not a save, and the screen must be able to say so. */}
            {preview ? <span data-testid="tb-cost-preview-marker">Unsaved figures</span> : null}
          </div>}
        notes={
          <NotesHistory
            notes={notes}
            hasDirtyEdits={dirty}
            onConfirmDiscard={(proceed) => { shell.confirmDiscard(proceed) }}
            resetKey={bed.id}
            onAdd={async (text) => {
              const r = await shell.api<{ error?: string }>('PATCH', `/api/test-beds/${bed.id}`, {
                payload: {
                  notes: prepend(note(text, shell.currentUserEmail(), new Date().toISOString()), notes),
                },
                expected_revision: Number.isInteger(record.latest_revision_number)
                  ? record.latest_revision_number : null,
              })
              if (!r.ok) { if (r.status === 409) await load(); return false }
              await load()
              return true
            }} />}
          useCases={useCasesNode}
          customerDocs={customerDocsNode}
          history={<HistoryPanel entries={history.entries} failed={history.failed} />} />} />
      {/* V5: OWNED, so it cannot clear a message that is not its own, and a
          server save error cannot clear this one either. */}
      {invalidMessage
        ? <div data-testid="tb-save-feedback" className="msg-error"
            data-owner={VALIDATION_OWNER}>{invalidMessage}</div>
        : feedback
        ? (feedback.html
          ? <div data-testid="tb-save-feedback" className="msg-error"
              dangerouslySetInnerHTML={{ __html: feedback.html }} />
          : <div data-testid="tb-save-feedback" className={feedback.ok ? 'msg-ok' : 'msg-error'}>
              {feedback.text}
            </div>)
        : null}
    </div>
  )
}
