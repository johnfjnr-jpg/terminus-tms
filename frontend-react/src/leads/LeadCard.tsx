// ── ONE LEAD, AS A CARD ──────────────────────────────────────────────────
//
// P4's ruled shape: a header row, then Summary, Notes and the Follow-up task
// across three columns.
//
// NAVIGATE, NOT INLINE - John's ruling, and the reason is in the brief: Qualify,
// Nurture and field editing happen on the detail screen, never on the card. So
// the card carries NO Qualify, Nurture, Save, Discard, Delete or Unqualify.
// Clicking anywhere opens the lead.
//
// EXCEPT THE TWO INLINE WRITES. Add Note and the follow-up task commit on their
// own controls, because the mass-update case is the point of the list: work
// through leads adding notes and setting follow-ups without opening each one.
// Their containers stop the click from reaching the card, which is the same
// mechanism the vanilla card used and is recorded there as tested by a real
// click-type-Add sequence.
//
// THE COMPONENTS ARE REUSED, NOT REBUILT. NotesHistory already does latest
// first, default 2, expand, and the one-control Add; FollowUpTask already does
// date-plus-description with its own save. Writing card versions of either
// would be two readers of one behaviour, and the notes model in particular has
// just been ruled on twice.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fieldValuesFor } from './leadFields'
import { LeadCardActions } from './LeadCardActions'
import { AddressPopup } from './AddressPopup'
import { InlineSummary } from './InlineSummary'

import { NotesHistory } from '../contact/NotesHistory'
import { FollowUpTask } from '../contact/FollowUpTask'
import type { Note } from '../contact/notes'
import { formatDate } from '../../../src/lib/format-dates.js'

export interface LeadRecord {
  id: string
  status?: string | null
  owner_id?: string | null
  created_at?: string | null
  payload?: Record<string, unknown>
  /** R7: a real COLUMN, and the reason the Industry picker read `--`. */
  industry_id?: string | null
  account?: { name?: string } | null
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

export function LeadCard({
  lead, notMine, accountName, accounts, industries, sources, regions,
  onOpen, onAddNote, onSaveFollowUp, onSaveSummary, onNurture, onQualified,
  onAddressSaved,
}: {
  lead: LeadRecord
  /** Per-card, because a list has many owners and the door must be asked once each. */
  notMine: boolean
  accountName: string | null
  onOpen: (id: string) => void
  onAddNote: (id: string, text: string) => Promise<boolean>
  onSaveFollowUp: (id: string, next: { followUpDate: string, followUpDescription: string }) => void
  /** R2: the account step's options, fetched once by the list, not per card. */
  accounts: Array<{ id: string, name: string }>
  industries: Array<{ id: string, name: string }>
  sources: string[]
  regions: string[]
  /** R4: Summary is a write now, so it saves like the other inline writes. */
  onSaveSummary: (id: string, text: string) => Promise<boolean>
  /** R3/R4: reload the record AND re-read the blocking list, as one thing. */
  onAddressSaved: () => Promise<void>
  /** R2: Nurture opens the follow-up dialogue, date and reason. */
  onNurture: (id: string) => void
  /** The conversion landed; the list re-reads so the card leaves the pipeline. */
  onQualified: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [addressOpen, setAddressOpen] = useState(false)
  // R3: the actions component owns `blocking`; it hands this ref its refresh
  // so the address popup calls the same function rather than keeping a copy.
  const refreshRef = useRef<null | (() => Promise<unknown>)>(null)
  // R3: whether the SERVER says Summary is still required. Received from the
  // actions component, which owns the blocking list, rather than fetched
  // again here - one writer, one value.
  const [summaryRequired, setSummaryRequired] = useState(false)
  // HOISTED, not written inline in the JSX. A hook in an attribute position
  // is legal only while that JSX is unconditional, and nothing in the markup
  // says so - the next person to wrap this in a condition breaks hook order
  // with no warning. It is also referentially stable, which the effect that
  // calls it depends on.
  const onBlockingChange = useCallback((b: Array<{ field?: string }>) => {
    setSummaryRequired(b.some((x) => x.field === 'summary'))
  }, [])
  const p = lead.payload ?? {}
  const notes = (Array.isArray(p.notes) ? p.notes : []) as Note[]
  // R7: what the FIELD SURFACE gets. `p` stays the payload for everything
  // that genuinely reads a payload key; this adds the one column the fields
  // name. Memoised because it is a new object each render otherwise, and a
  // future effect keyed on it would then loop.
  const fieldValues = useMemo(() => fieldValuesFor(lead), [lead])
  // A4: held in STATE rather than a ref, because the portal must re-render
  // once the slot element exists. A ref would be null on the first pass and
  // nothing would tell React to look again.
  const [panelHost, setPanelHost] = useState<HTMLDivElement | null>(null)

  // ── THE DOOR, PER CARD ────────────────────────────────────────────────
  //
  // New ground: every doored surface before this was a detail view with one
  // owner. `applyReadOnlyControls` now takes a ROOT, so the card passes its own
  // element and its own answer - one definition, asked once per card.
  //
  // In an effect because the sweep reads the PAINTED DOM, and re-run when the
  // notes or the task change, because a re-render replaces the controls the
  // last sweep neutralised.
  useEffect(() => {
    const apply = (window as unknown as {
      applyReadOnlyControls?: (root: HTMLElement | string, notMine: boolean) => void
    }).applyReadOnlyControls
    if (ref.current) apply?.(ref.current, notMine)
    // addressOpen is in the dependency list DELIBERATELY. Verification 43's
    // clause: a control revealed AFTER the door has swept is a control the
    // door never saw, and the disclosure adds real inputs to the card.
  }, [notMine, notes.length, p.followUpDate, p.followUpDescription, addressOpen])

  // A click anywhere opens the lead. The inline regions below stop propagation,
  // so typing a note never navigates away mid-sentence.
  const open = () => onOpen(lead.id)

  return (
    <div
      ref={ref}
      className={`lead-card${notMine ? ' is-not-mine' : ''}`}
      data-testid={`lead-card-${lead.id}`}
      data-lead-id={lead.id}
      data-not-mine={notMine ? 'true' : 'false'}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
    >
      <div className="lead-card-head">
        <span className="lead-card-name" data-testid={`lead-name-${lead.id}`}>
          {str(p.name) || '--'}
        </span>
        {lead.status
          ? <span className="tag" data-testid={`lead-status-${lead.id}`}>{lead.status.toUpperCase()}</span>
          : null}
        <span className="lead-card-sub" data-testid={`lead-sub-${lead.id}`}>
          {[accountName ?? str(p.company) ?? '--', str(p.source) || '--',
            formatDate(lead.created_at) || '--'].join(' · ')}
        </span>

        {/* R5: THE ACTIONS ARE ON THE TOP LINE, inside the head, rather than
            on a row of their own. That row cost 34px plus its margins, and
            Phase 0 measured it as the largest height saving available while
            the follow-up column is frozen by R7. `margin-left: auto` in the
            stylesheet pushes the group off the text and into the middle of
            the line. */}
        <LeadCardActions
          leadId={lead.id}
          status={lead.status ?? null}
          accounts={accounts}
          onQualified={onQualified}
          onNurture={() => onNurture(lead.id)}
          addressOpen={addressOpen}
          onOpenAddress={() => setAddressOpen(true)}
        registerRefresh={(fn) => { refreshRef.current = fn }}
          onBlockingChange={onBlockingChange}
          payload={fieldValues}
          industries={industries}
          sources={sources}
          regions={regions}
          onSaved={onQualified}
          panelHost={panelHost} />
      </div>

      {addressOpen
        ? (
          <AddressPopup
            leadId={lead.id}
            current={p}
            regions={regions}
            onClose={() => setAddressOpen(false)}
            onSaved={async () => {
              // R3: the popup takes the SAME refresh path. Phase 0 measured
              // it refreshing values and leaving TWO stars wrong, because
              // nothing on this path touched the parent's blocking list.
              //
              // The actions component's refresh when the surface is open, so
              // the markers behind it recompute; the plain list reload
              // otherwise, when there is no surface to correct.
              setAddressOpen(false)
              if (refreshRef.current) await refreshRef.current()
              else await onAddressSaved()
            }} />
        )
        : null}

      <div className="lead-card-body">
        {/* The panel renders its OWN header now, through the shared shell.
            The card no longer places a title above a component and hopes the
            two line up: `Panel` owns the header line, so S1's placement and
            S3's alignment are properties of the shell rather than of this
            call site. */}
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <InlineSummary
            value={str(p.summary)}
            leadId={lead.id}
            required={summaryRequired}
            onSave={(text) => onSaveSummary(lead.id, text)} />
        </div>

        {/* INLINE WRITE 1. stopPropagation so the card's navigate does not fire
            while somebody is typing into it. */}
        <div
          className="lead-card-col"
          data-testid={`lead-notes-${lead.id}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {/* R3: the title is no longer a sibling above the component. It is
              the first item ON the header row, beside `Latest first`, Add
              note and Discard - which is what brings the note input up to the
              Summary field's line. */}
          <NotesHistory
            notes={notes}
            onAdd={(text) => onAddNote(lead.id, text)}
            hasDirtyEdits={false}
            onConfirmDiscard={(proceed) => { proceed() }}
            resetKey={lead.id}
            title="Notes"
            actionsInHeader />
        </div>

        {/* INLINE WRITE 2. */}
        <div
          className="lead-card-col"
          data-testid={`lead-followup-${lead.id}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <FollowUpTask
            date={str(p.followUpDate)}
            description={str(p.followUpDescription)}
            resetKey={lead.id}
            onSave={(next) => onSaveFollowUp(lead.id, next)} />
        </div>
      </div>
      {/* A4: THE SLOT THE EXPANDED QUALIFY STEPS RENDER INTO, below the card's
          own content rather than above it. The actions stay on the top line
          (R5); only the sheet they open moves. It stops propagation for the
          same reason the three columns above do - the card itself navigates,
          and somebody typing into the sheet is not asking to open the record. */}
      <div
        ref={setPanelHost}
        data-testid={`lead-steps-${lead.id}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()} />
    </div>
  )
}
