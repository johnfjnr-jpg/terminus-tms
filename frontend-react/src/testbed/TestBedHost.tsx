// ── ROUND 7 PHASE 1a: THE TEST BED SURFACE'S DATA AND WRITES ────────────
//
// The panel does not fetch, save, or know about routes. This holds those.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TestBedPanel } from './TestBedPanel'
import { PAYLOAD_ONLY_KEYS, testBedDescriptors, type TestBedSource } from './descriptors'
import { useFieldRows } from '../field-row/useFieldRows'
import { CommercialsCards } from './CommercialsCards'
import { EditBar } from '../field-row/EditBar'
// R2: THE SAME COMPONENT THE CONTACT SURFACE USES, imported rather than
// rebuilt. A second follow-up panel would be two renderers of one idea, and
// the two would agree today (Verification 20).
import { FollowUpTask } from '../contact/FollowUpTask'
import { createPreviewRunner } from './costPreview'
import { CostBreakdownCards } from './CostBreakdownCards'
import { QualificationScore, orderedSeries } from './QualificationScore'
import { isBreakdown, type TestBedCostBreakdown } from './costBreakdown'
import { useShell } from '../ShellContext'
import type { LookupOption } from '../field-row/types'
import { NotesHistory } from '../contact/NotesHistory'
import { note, prepend, type Note } from '../contact/notes'
import { StageTabs, type StageTabsDeps } from './StageTabs'
import { UseCasesList } from './UseCasesList'
import { DERIVE_ROUTE, UNITS_ROUTE, type Unit } from './units'
import {
  SCORE_ROUTE, MEASURABILITY_ROUTE, criteriaForStage, recordScoresInOrder, recordMeasurability,
  type Criterion,
} from './scoring'
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
import { DocumentsPanel } from './DocumentsPanel'
import { ClosedRecordPanel } from './ClosedRecordPanel'
import { StageTrackList } from '../shared/StageTrackList'
import { DOCUMENTS_ROUTE, type DocRequirements } from './documents'
import { LIFECYCLE_ROUTE, type Lifecycle } from './closedPanel'
import { nextStageFor } from './tabModel'
import type { StageEntry } from '../shared/stageTracks'
import { ViewHeader } from './ViewHeader'
import { TestBedBand } from './TestBedBand'
import { createArrivalFlags, notMine } from './viewLoad'
import { ConvertPanel } from './ConvertPanel'
import { CONVERT_ROUTE } from './convert'
import { completeDocumentRoute, confirmBody, saveUrlBody } from './stageDocuments'
import { attemptTick } from './exitCriteria'
import { BuyerLinks } from './BuyerLinks'
import { linkBuyer, BUYER_CONTACTS_ROUTE } from './buyers'

const STALE = 'This Test Bed changed since the screen loaded. Reload before saving.'

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
  owner_id?: string | null
  payload?: Record<string, unknown>
  buyer_contacts?: Array<{ role?: string, contact_id?: string, name?: string }>
  installer?: Installer | null
  account_id?: string | null
  account?: { id?: string } | null
  latest_revision_number?: number | null
  // L1: WAS `unknown`, AND THAT WAS THE WHOLE DEFECT IN ONE WORD.
  //
  // `GET /api/test-beds/:id` has always carried this - live-recomputed from
  // the stored payload at `src/routes/test-beds.js:419` - and nothing has ever
  // read it. Typed now, from the engine's own return rather than from a guess.
  costBreakdown?: TestBedCostBreakdown
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
  // L1: the SECOND `unknown`. The preview is the same shape as the stored
  // breakdown, because both come from `buildTestBedCostBreakdown` over the
  // same engine - which is why a preview and a save can never disagree about
  // arithmetic, only about inputs.
  const [preview, setPreview] = useState<TestBedCostBreakdown | null>(null)
  const [feedback, setFeedback] = useState<{ text: string | null, html?: string | null, ok: boolean } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [units, setUnits] = useState<Unit[]>([])
  const [stages, setStages] = useState<Stage[]>([])

  // L2: EVERY test_bed criterion, not the per-stage subset. The card lists
  // them all and says which stage each score was recorded at, so a per-stage
  // list would show a person only what the stage they are on happens to ask.
  const [allCriteria, setAllCriteria] = useState<Criterion[]>([])
  // ── L4: THE OPEN REFERENCE PANE LIVES HERE, NOT IN THE PANEL ──────────
  //
  // `TestBedPanel` unmounts on every tab switch and would take this with it.
  // The host outlives the tabs, which is R1's reasoning for the draft store
  // applied unchanged.
  //
  // IT MUST STILL RESET BETWEEN RECORDS. `main.tsx` re-renders this tree
  // rather than remounting it, so a plain `useState` would follow the user
  // to the next Test Bed and open a pane that is empty on it. Keyed on the
  // record id, which is the same trap `useState(prop)` fell into on Contact.
  const [refPane, setRefPane] = useState('useCases')
  const [paneRecord, setPaneRecord] = useState(bed.id)
  if (paneRecord !== bed.id) { setPaneRecord(bed.id); setRefPane('useCases') }
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [installerContacts, setInstallerContacts] = useState<ContactOption[]>([])
  const [customerDocs, setCustomerDocs] = useState<CustomerDoc[]>([])
  const [history, setHistory] = useState<{ entries: HistoryEntry[], failed: boolean }>(
    { entries: [], failed: false })
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [lifecycle, setLifecycle] = useState<{ data: Lifecycle | null, failed: boolean }>(
    { data: null, failed: false })
  const [loadFailed, setLoadFailed] = useState(false)

  // L1/L2/R5: ONE machine for the arrival and landing flags, held across
  // re-renders. The shell re-renders this view rather than mounting a new one,
  // so a ref is what makes "spend it once" mean once.
  const flags = useRef(createArrivalFlags())
  // C3: the last URL typed per document, so a confirm can carry it. Kept in a
  // ref rather than state: nothing renders from it and a re-render per
  // keystroke would remount the row.
  const docUrls = useRef<Record<string, string>>({})
  // F: bumped after any write that can change what a stage panel shows. It
  // also supersedes the vanilla's `applyConfirmedApproval`, which mutated the
  // approved row's classes and text in place - rendering from the reloaded
  // state does the same three things and has no equivalent of that function's
  // own gap, where it located the row by matching role TEXT and so silently
  // did nothing for a version-scoped row whose label is not its track name.
  const [stageRefresh, setStageRefresh] = useState(0)
  const refreshStage = useCallback(() => { setStageRefresh((n) => n + 1) }, [])
  const [arrival, setArrival] = useState<{ fresh: boolean, landing: string | null }>(
    () => ({ fresh: true, landing: null }))

  useEffect(() => { setRecord(bed) }, [bed])

  // The stage list and the units, both of which the tab shell needs before a
  // stage tab can decide whether it is terminal (P4).
  useEffect(() => {
    let live = true
    // THE ROUTE IS stage-definitions, NOT stages. Written as `/api/stages` and
    // caught by the live walk: the fetch 404'd, `stages` stayed empty, and the
    // terminal check - which reads the LAST stage by sort order - could never
    // be true, so the Closed tab rendered the ordinary panels. Session 1 made
    // the same mistake with the document routes. A request shaped by what the
    // reader wanted rather than by what the server has.
    void shell.api<Stage[]>(
      'GET', '/api/stage-definitions?record_type=test_bed').then((r) => {
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
    // R4: THE SAME DEAD ROUTE. `GET /api/accounts/:id/contacts` is a 404 and
    // is declared nowhere, so the tech-team picker was empty for exactly the
    // same reason as the buyer lookups - two callers of a route that was never
    // built. Verification 41's enumeration: a superseded or fabricated route
    // is found by listing its callers, not by fixing the one that was
    // reported.
    void shell.api<Array<ContactOption & { parent_record_id?: string | null }>>(
      'GET', '/api/contacts').then((r) => {
      if (live && r.ok && Array.isArray(r.data)) {
        setInstallerContacts(r.data.filter((c) => c.parent_record_id === installerAccountId))
      }
    })
    return () => { live = false }
  }, [shell, installerAccountId])

  // ── L2: THE SCORING CRITERIA, FETCHED ONCE ─────────────────────────────
  //
  // Not per record and not per stage: the criteria are CONFIGURATION for the
  // record type, which is why the vanilla's `ensureTbScoringCriteria` cached
  // them for the life of the page.
  //
  // ONE FETCH, TWO READERS: this card and, since Round A Phase 2.1, the stage
  // panel, which filters it by each criterion's own stage rows. The host's
  // `scoring` state that was meant to feed the panel was never set by anything
  // and is removed (audit B2).
  useEffect(() => {
    let live = true
    void shell.api<Criterion[]>('GET', '/api/scoring-criteria?record_type=test_bed')
      .then((r) => {
        if (live && r.ok && Array.isArray(r.data)) setAllCriteria(r.data)
      })
    return () => { live = false }
  }, [shell])

  const loadCustomerDocs = useCallback(async () => {
    const r = await shell.api<CustomerDoc[]>('GET', CUSTOMER_DOCS_ROUTE(bed.id))
    setCustomerDocs(r.ok && Array.isArray(r.data) ? r.data : [])
  }, [shell, bed.id])
  useEffect(() => { void loadCustomerDocs() }, [loadCustomerDocs])

  useEffect(() => {
    let live = true
    void shell.api<{ entries?: HistoryEntry[] }>('GET', HISTORY_ROUTE(bed.id)).then((r) => {
      if (!live) return
      // Array.isArray, not `?? []`. A response of `[]` has an `entries`
      // property - Array.prototype.entries, a FUNCTION - so the nullish
      // fallback never fires and the panel gets a function to map over. Found
      // by a suite hang rather than by reading.
      setHistory(r.ok && Array.isArray(r.data?.entries)
        ? { entries: r.data.entries, failed: false }
        : { entries: [], failed: !r.ok })
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

  // ── R4: THE BUYER LOOKUPS HAD TWO STACKED FAULTS, AND EITHER ALONE HID
  //    THE OTHER ─────────────────────────────────────────────────────────
  //
  // 1. IT READ THE WRONG KEY. `GET /api/test-beds` answers `account_id` and
  //    `account_name` as FLAT COLUMNS and never an `account` OBJECT, so
  //    `record.account?.id` was undefined on 10 of 10 live beds and this
  //    effect returned before fetching anything. Verification 20 at its
  //    sharpest: line 389 of THIS FILE already reads
  //    `record.account_id ?? record.account?.id`, so the correct reader was
  //    four hundred lines away the whole time.
  //
  // 2. THE ROUTE DOES NOT EXIST. `GET /api/accounts/:id/contacts` answers
  //    404 and is declared nowhere in `src/routes`. Fixing the key alone
  //    would have left the dropdown empty and LOOKING fixed - V47's clause,
  //    a request shaped by what the reader wanted.
  //
  // The link is `parent_record_id` on the contact, which is the one source
  // Round B established for exactly this question, so no new endpoint is
  // needed and this reads it the same way the account section does.
  useEffect(() => {
    let live = true
    const accountId = record.account_id ?? record.account?.id
    if (!accountId) return
    void shell.api<Array<{ id: string, parent_record_id?: string | null, payload?: { name?: string } }>>(
      'GET', '/api/contacts').then((r) => {
      if (live && r.ok && Array.isArray(r.data)) {
        setContacts(r.data
          .filter((c) => c.parent_record_id === accountId)
          .map((c) => ({ id: c.id, name: c.payload?.name ?? c.id })))
      }
    })
    return () => { live = false }
  }, [shell, record.account_id, record.account?.id])

  // R1: THE DRAFT STORE LIVES HERE, above the tabs, so a tab switch cannot
  // destroy it. `StageTabs` unmounts each panel when its tab is inactive and
  // TestBedPanel owned this - measured, every unsaved edit was discarded.
  const source: TestBedSource = useMemo(() => ({
    payload: record.payload ?? {}, staff,
  }), [record, staff])

  // The store itself. Built from the same descriptors the panel renders, so
  // there is exactly ONE of it for the whole screen however many tabs come
  // and go.
  const rows = useFieldRows(testBedDescriptors(source))


  // ── L1: THE ITEMIZED COST SECTION ──────────────────────────────────────
  //
  // The container used to render the words "Unsaved figures" and nothing else,
  // while the four cards' data sat in `preview` unread. It is filled now.
  //
  // WHICH SOURCE, AND IT IS A CHOICE OF INPUTS RATHER THAN OF ARITHMETIC.
  // The preview while something cost-related is dirty, the record's own
  // stored breakdown otherwise. Both come from the same server function, so
  // the two can never disagree about how anything is added up - the vanilla's
  // `tbCostPreview ?? tbBed.costBreakdown`, unchanged in meaning.
  const shown = preview ?? (isBreakdown(record.costBreakdown) ? record.costBreakdown : null)
  const unsaved = preview !== null

  // The draft-or-stored reader, the vanilla's `tbEffectiveValue`. The hardware
  // labels quote their own inputs, so while a preview is showing they must
  // quote the DRAFT ones - otherwise a row reads `SafeSight (12 × $4,200)`
  // beside a figure computed from 14.
  const effective = useCallback(
    (key: string) => rows.valueOf(key) ?? '', [rows])

  const costBreakdownNode = (
    <div data-testid="tb-cost-breakdown">
      {shown
        ? <CostBreakdownCards breakdown={shown} input={effective} unsaved={unsaved} />
        : (
          // Reported rather than omitted. A section that disappears when
          // something goes wrong reads as "this Test Bed has no costs" to
          // whoever it was for.
          <p className="empty-state" data-testid="tb-cost-breakdown-empty">
            Unable to load cost breakdown.
          </p>)}
    </div>
  )

  // Q4, ruled: the breakdown is its OWN section below the rate grid, with the
  // vanilla's heading and sub-line, rather than a child of the Commercials
  // card. The sub-line is the one place on this tab that says what the figures
  // are FOR, and it says cost only, no price or margin.
  const commercialsTab = (
    <>
      <CommercialsCards rows={rows} fields={testBedDescriptors(source)} />
      <div className="tb-itemized-cost" data-testid="tb-itemized-cost">
        <p className="pg-card-title">Itemized Cost</p>
        <p className="sub">
          What this Test Bed will cost to build - cost only, no price or margin,
          supporting a go/no-go decision.
        </p>
        {costBreakdownNode}
      </div>
    </>
  )

  // ── B6: THE BUYER ROWS, WRITTEN DIRECTLY ───────────────────────────────
  //
  // The door, the route and the reload around `linkBuyer`, which is tested.
  // A link can release a `contact_role_linked` exit criterion, so the stage
  // reloads as well as the record.
  const buyerAccountId = record.account_id ?? record.account?.id ?? null
  const buyerLinksNode = (
    <BuyerLinks accountId={buyerAccountId} links={record.buyer_contacts} contacts={contacts}
      onLink={async (role, contactId) => {
        const r = await linkBuyer({
          canEdit: () => shell.canEditFields(),
          post: async (body) => {
            const res = await shell.api<{ error?: string }>('POST', BUYER_CONTACTS_ROUTE(bed.id), body)
            return { ok: res.ok, error: res.data?.error ?? null }
          },
        }, role, contactId)
        if (r.sent && !r.error) { await load(); refreshStage() }
        return r.error
      }}
      onNew={(role) => {
        if (buyerAccountId) shell.openInlineBuyerContact(bed.id, buyerAccountId, role)
      }} />)

  const load = useCallback(async () => {
    // L1: THE FLAG IS SPENT HERE, BEFORE THE FETCH CAN FAIL. Cleared only on
    // success, it would survive a failed load and make the next save read as an
    // arrival.
    const fresh = flags.current.consume()
    // The landing is the SHELL's, read and cleared through its accessor. The
    // local flags machine still owns the arrival half, and `landOn` stays for
    // the tests that prove R5/R6 - the machine is the contract, the shell is
    // one of its writers.
    const landing = shell.takeTestBedLanding() ?? flags.current.takeLanding()
    setArrival({ fresh, landing })

    const r = await shell.api<BedLike>('GET', `/api/test-beds/${bed.id}`)
    if (r.ok && r.data) {
      setRecord(r.data)
      setLoadFailed(false)
    } else {
      // L4: the view SETTLES on the failure path too, or a record that could
      // not be fetched shows the loading line for ever instead of its error.
      setLoadFailed(true)
    }
    shell.detailLoaded('test-bed-detail')
  }, [shell, bed.id])

  // ── THE COST PREVIEW, with its ordering guard. C1-C9 ─────────────────
  const runner = useRef(createPreviewRunner(
    async (body) => shell.api('POST', '/api/test-beds/calculate', body),
    // The runner hands back whatever the route answered. Narrowed here rather
    // than trusted: a malformed answer becomes null, which falls back to the
    // stored breakdown, which is the vanilla's own behaviour on a failed
    // preview - a wrong number wearing the unsaved marker is worse than the
    // saved one.
    (data) => setPreview(isBreakdown(data) ? data : null),
  ))

  // R2: ITS OWN WRITE, like the Contact surface's. The follow-up task is not
  // part of the field-row batch: it saves itself, so it carries its own PATCH
  // and reloads on success. `expected_revision` follows this host's existing
  // convention for its other standalone write, the notes append.
  const saveFollowUp = useCallback(async (next: { followUpDate: string, followUpDescription: string }) => {
    const r = await shell.api('PATCH', `/api/test-beds/${bed.id}`, {
      payload: next,
      expected_revision: Number.isInteger(record?.latest_revision_number)
        ? record.latest_revision_number : null,
    })
    if (r.ok) await load()
  }, [shell, bed.id, record, load])

  const onDraftsChange = useCallback((next: Record<string, string>) => {
    // ── SET ONLY ON A REAL CHANGE ────────────────────────────────────────
    //
    // The panel reports drafts from an effect keyed on `rows.changes`, which
    // has a fresh object identity on every render. Calling setState
    // unconditionally therefore renders, which re-fires the effect, which sets
    // state again: an infinite loop, and it hung the suite rather than failing
    // it. Before this session the callback only scheduled a preview and set no
    // state, so the identity churn was harmless - Architecture 8 exactly, an
    // unchanged path meeting a new demand.
    setDrafts((prev) => {
      const keys = Object.keys(next)
      const same = keys.length === Object.keys(prev).length
        && keys.every((k) => prev[k] === next[k])
      return same ? prev : next
    })
    runner.current.schedule(next, record.payload ?? {})
  }, [record.payload])

  // ── THE DRAFTS ARE REPORTED FROM HERE, NOT FROM THE REFERENCE PANEL ─────
  //
  // This effect used to live in `TestBedPanel`, which is the Reference pane and
  // therefore UNMOUNTS whenever another tab is open. When last round moved the
  // cost fields to the Commercials tab, typing a cost stopped scheduling a
  // preview entirely - and nothing could see it, because the breakdown
  // container rendered two words either way.
  //
  // It belongs beside the store. `rows` is owned by this host, so this is the
  // one place that can see a draft change from ANY tab.
  useEffect(() => { onDraftsChange(rows.changes) }, [rows.changes, onDraftsChange])

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
   * The whole-list write the use cases, the install notes and the exit tick
   * all need.
   *
   * ONE writer, because all are a record PATCH carrying the revision as the
   * precondition, and two would be Verification 20's shape on the save path.
   * Round A Phase 1 split it into the write and its REPORTING: the use cases
   * and notes report on the host banner, and the exit tick reports inside its
   * own panel (1.6), so the write returns the reason rather than choosing where
   * it is said.
   */
  const writePayload = useCallback(async (payload: Record<string, unknown>) => {
    const r = await shell.api<{ error?: string }>('PATCH', `/api/test-beds/${bed.id}`, {
      payload,
      expected_revision: Number.isInteger(record.latest_revision_number)
        ? record.latest_revision_number : null,
    })
    if (!r.ok) {
      // A 409 reloads either way: the screen is behind the record.
      if (r.status === 409) await load()
      return { ok: false, error: r.status === 409 ? STALE : (r.data?.error ?? 'Failed to save.') }
    }
    await load()
    return { ok: true, error: null }
  }, [shell, bed.id, record.latest_revision_number, load])

  const patchPayload = useCallback(async (payload: Record<string, unknown>) => {
    const r = await writePayload(payload)
    if (!r.ok) setFeedback({ text: r.error, html: null, ok: false })
    return r.ok
  }, [writePayload])

  const stageDeps: StageTabsDeps = useMemo(() => ({
    stages,
    documents: (stage) => shell.api('GET', DOCUMENTS_ROUTE(bed.id, stage)),
    criteria: (stage) => shell.api(
      'GET', `/api/records/${bed.id}/exit-criteria?stage=${encodeURIComponent(stage)}`),
    approvals: () => shell.api('GET', `/api/records/${bed.id}/stage-approvals`),
    // 2.1: from each criterion's OWN stage rows, over the one criteria fetch
    // the Reference score card already makes. 2.2: from the record PAYLOAD,
    // through the same reducer that card uses, so a reload shows the history.
    scoringCriteria: (stage) => criteriaForStage(allCriteria, stage),
    series: (key) => orderedSeries(record.payload, key),
    // 1.5: the attempt, its door and its refresh live in `attemptTick`, where
    // they are tested; this only supplies the host's writer and door.
    onTick: (field, currentlyMet) => attemptTick({
      canEdit: () => shell.canEditFields(),
      write: writePayload,
      refresh: refreshStage,
      now: () => new Date().toISOString(),
    }, field, currentlyMet),
    // 2.3: the per-entry contract lives in `recordScoresInOrder`, where it is
    // tested; this supplies the route, the door and the reload. The record and
    // the stage reload after any attempt that sent something, as the vanilla
    // reloaded on success and on failure: a recorded score stands either way.
    onRecordScores: async (criteria, scores) => {
      const out = await recordScoresInOrder({
        canEdit: () => shell.canEditFields(),
        post: async (body) => {
          const r = await shell.api<{ error?: string }>('POST', SCORE_ROUTE(bed.id), body)
          return { ok: r.ok, error: r.data?.error ?? null }
        },
      }, criteria, scores)
      if (!out.refused) { await load(); refreshStage() }
      return out
    },
    // 2.4: the door, the route and the reload, around the tested helper.
    onMeasurability: async (confirmed) => {
      const r = await recordMeasurability({
        canEdit: () => shell.canEditFields(),
        post: async (body) => {
          const res = await shell.api<{ error?: string }>('POST', MEASURABILITY_ROUTE(bed.id), body)
          return { ok: res.ok, error: res.data?.error ?? null }
        },
      }, confirmed)
      if (r.sent && !r.error) { await load(); refreshStage() }
      return r.error
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
  }), [shell, bed.id, stages, allCriteria, record.payload, units, writePayload, refreshStage, load, loadUnits])

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

  // Z1: its own route, fetched once per record rather than per stage - the
  // terminal tab is the only reader and the answer does not vary by stage.
  const loadLifecycle = useCallback(async () => {
    const r = await shell.api<Lifecycle>('GET', LIFECYCLE_ROUTE(bed.id))
    setLifecycle(r.ok && r.data ? { data: r.data, failed: false } : { data: null, failed: true })
  }, [shell, bed.id])
  useEffect(() => { void loadLifecycle() }, [loadLifecycle])

  const useCasesNode = (
    <UseCasesList useCases={record.payload?.useCases as string[] | undefined}
      onWrite={(next) => patchPayload({ useCases: next })} />)

  // ── THE RECORD BAND, HOISTED OUT OF THE REFERENCE PANEL ────────────────
  //
  // Summary, Notes and the follow-up describe the RECORD, so they render in
  // the header between the title and the stats strip rather than inside one
  // tab's content. Measured on the previous build: the band sat at 433px,
  // below the strip, the chevron and the tab row, because "the header" was
  // read as this panel's own top.
  //
  // THE HOST STILL OWNS ALL THREE WRITES, exactly as before. Only the parent
  // changed: the notes PATCH, the follow-up save and the Summary row's draft
  // store are unmoved, which is what keeps this a reposition rather than a
  // rewire.
  const bandNode = (
    <TestBedBand
      source={source}
      rows={rows}
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
      followUp={
        <FollowUpTask
          date={String(record.payload?.followUpDate ?? '')}
          description={String(record.payload?.followUpDescription ?? '')}
          resetKey={bed.id}
          onSave={(next) => { void saveFollowUp(next) }} />} />)

  // L5: all three, and the absent-id cases fail OPEN here on purpose - the
  // edit attempt is where it fails closed.
  // The SHARED derivation takes ids, not a record: one definition serves the
  // shell, which has no record object, and this tree, which does.
  const readOnly = notMine(record.owner_id ?? null, shell.currentUserId())

  // The class itself is applied by TestBedView, BEFORE this renders. See the
  // note there: applying it from an effect here is one render too late,
  // because `canEditFields` reads it while this tree is rendering.

  return (
    <div data-testid="testbed-host">
      {/* W5: CONVERT TO OPPORTUNITY RENDERS BESIDE THE TITLE.
          It sat at the bottom of this host, below the edit bar and below every
          panel. The ELEMENT is unchanged - same props, same per-record key,
          same handlers - and only its parent moved, which is what keeps this a
          reposition rather than a rewire. Its feedback message travels with
          it, which is right: an outcome belongs where the control that caused
          it is. */}
      <ViewHeader record={loadFailed ? null : record} readOnly={readOnly}
        band={bandNode}
        titleAction={
          <ConvertPanel
            key={bed.id}
            onConvert={async (body) => {
              const r = await shell.api<{ id?: string, error?: string }>(
                'POST', CONVERT_ROUTE(bed.id), body)
              return { ok: r.ok, data: r.ok ? (r.data ?? null) : null, error: r.data?.error ?? null }
            }}
            onOpen={(id) => shell.navigate('opportunity-detail', id)} />
        } />
      <StageTabs
        payload={record.payload ?? {}}
        units={units}
        landing={arrival.landing}
        fresh={arrival.fresh}
        currentStage={record.status ?? ''}
        nextStage={nextStageFor(stages, record.status).nextStage}
        deps={stageDeps}
        installSection={installSectionNode}
        documents={(_stage, data) => (
          <DocumentsPanel data={(data ?? {}) as DocRequirements}
            onConfirm={async (name) => {
              // C3: the confirm carries whatever is in the URL box. The panel
              // owns that value, so it is passed through here.
              await shell.api('POST', completeDocumentRoute(bed.id),
                confirmBody(name, docUrls.current[name] ?? ''))
              // C5: a confirm can release a gate, so the panels reload and the
              // Next Stage button re-derives from the reloaded record.
              await load()
              refreshStage()
            }}
            onSaveUrl={async (name, url) => {
              docUrls.current[name] = url
              // C2: approve:false. Saving a URL must not approve the document -
              // the URL points at the working copy, and satisfying a gate by
              // pasting a link is the failure the gate exists to prevent.
              await shell.api('POST', completeDocumentRoute(bed.id),
                saveUrlBody(name, url))
              // F: a URL save changes no gate, but the document row's stored
              // location has moved, so the panel is reloaded.
              refreshStage()
            }} />)}
        approvals={(stage, data) => (
          <StageTrackList testId="tb-stage-tracks"
            stage={(Array.isArray(data) ? data : [])
              .find((s: StageEntry) => s.stage_name === stage)}
            recordType="test_bed"
            superseded={shell.usesWorkflow('test_bed')}
            onApprove={async (track) => {
              await shell.api('POST', `/api/records/${bed.id}/approvals`, { track })
              await load()
              refreshStage()
            }} />)}
        closed={<ClosedRecordPanel data={lifecycle.data} failed={lifecycle.failed} />}
        refreshToken={stageRefresh}
        recordId={bed.id}
        onNextStage={() => {
          const { currentStage, nextStage } = nextStageFor(stages, record.status)
          if (nextStage) shell.attemptTransition(bed.id, nextStage, 'test_bed', currentStage)
        }}
        commercials={commercialsTab}
        reference={<TestBedPanel
          source={source}
          rows={rows}
          buyerLinks={buyerLinksNode}
          score={<QualificationScore criteria={allCriteria} payload={record.payload} />}
        refPanes
        refPane={refPane}
        onRefPaneChange={setRefPane}
        onDirtyChange={setDirty}

          useCases={useCasesNode}
          customerDocs={customerDocsNode}
          history={<HistoryPanel entries={history.entries} failed={history.failed}
            // R3: the SAME descriptors this surface renders its rows from, so
            // the history names a field exactly as the screen does. A second
            // label table would agree today and drift (Verification 20).
            labelOf={(k) => testBedDescriptors(source).find((f) => f.name === k)?.label ?? k} />} />} />
      {/* R1: ONE BAR FOR THE WHOLE SURFACE, outside the tabs. Inside the
          Reference panel it vanished with that panel, so the cost rows that
          moved to Commercials had no Save and no Discard. Rendered here it
          serves both tabs from the one store, and its id is unchanged so the
          walk that clicks it by id is unaffected. */}
      <EditBar rows={rows} onSave={(c) => { void onSave(c) }} saveId="tb-react-save-all" />
      {/* V5: OWNED, so it cannot clear a message that is not its own, and a
          server save error cannot clear this one either. */}
      {/* W5: `ConvertPanel` WAS HERE and is now passed to `ViewHeader` as its
          title action. Removed rather than left, because a move is TWO claims
          - it appears in its new place AND it is gone from its old one - and
          this estate has shipped the duplicate that skipping the second one
          produces. The probe asserts exactly one trigger renders.

          KEYED ON THE RECORD, at its new site. The shell re-renders this view
          rather than mounting a new one, so an open form with a typed name
          would follow the operator to the next Test Bed. The key is what
          resets it, and the convert suite asserts BOTH halves: that without a
          key the form persists, and that a changed key clears it. */}
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
