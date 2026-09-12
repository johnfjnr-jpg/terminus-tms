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
import { useEffect, useRef, useState } from 'react'
import { LeadCardActions } from './LeadCardActions'
import { AddressPopup } from './AddressPopup'
import { InlineSummary } from './InlineSummary'

import { NotesHistory } from '../contact/NotesHistory'
import { FollowUpTask } from '../contact/FollowUpTask'
import type { Note } from '../contact/notes'

export interface LeadRecord {
  id: string
  status?: string | null
  owner_id?: string | null
  created_at?: string | null
  payload?: Record<string, unknown>
  account?: { name?: string } | null
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

export function LeadCard({
  lead, notMine, accountName, accounts, industries, sources,
  onOpen, onAddNote, onSaveFollowUp, onSaveSummary, onNurture, onQualified,
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
  /** R4: Summary is a write now, so it saves like the other inline writes. */
  onSaveSummary: (id: string, text: string) => Promise<boolean>
  /** R2: Nurture opens the follow-up dialogue, date and reason. */
  onNurture: (id: string) => void
  /** The conversion landed; the list re-reads so the card leaves the pipeline. */
  onQualified: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [addressOpen, setAddressOpen] = useState(false)
  const p = lead.payload ?? {}
  const notes = (Array.isArray(p.notes) ? p.notes : []) as Note[]

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
            lead.created_at ? String(lead.created_at).slice(0, 10) : '--'].join(' · ')}
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
          payload={p}
          industries={industries}
          sources={sources}
          onSaved={onQualified} />
      </div>

      {addressOpen
        ? (
          <AddressPopup
            leadId={lead.id}
            current={p}
            onClose={() => setAddressOpen(false)}
            onSaved={() => { setAddressOpen(false); onQualified() }} />
        )
        : null}

      <div className="lead-card-body">
        <div
          className="lead-card-col"
          data-testid={`lead-summary-${lead.id}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="lead-card-col-title">Summary</div>
          <InlineSummary
            value={str(p.summary)}
            leadId={lead.id}
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
          <div className="lead-card-col-title">Notes</div>
          <NotesHistory
            notes={notes}
            onAdd={(text) => onAddNote(lead.id, text)}
            hasDirtyEdits={false}
            onConfirmDiscard={(proceed) => { proceed() }}
            resetKey={lead.id} />
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
    </div>
  )
}
