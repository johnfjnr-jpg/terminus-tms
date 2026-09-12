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

/**
 * R2's Address details disclosure. Read-only on the card by design: the card
 * works a pipeline, and editing an address is what opening the lead is for.
 * Qualify needs all five, so seeing WHICH are missing without leaving the list
 * is the point of showing them here.
 */
const ADDRESS_FIELDS: Array<[string, string]> = [
  ['address', 'Address'], ['address2', 'Address 2'], ['city', 'City'],
  ['postcode', 'Postcode'], ['country', 'Country'], ['region', 'Region'],
]
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
  lead, notMine, accountName, accounts, onOpen, onAddNote, onSaveFollowUp, onNurture, onQualified,
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
      </div>

      <LeadCardActions
        leadId={lead.id}
        status={lead.status ?? null}
        accounts={accounts}
        onQualified={onQualified}
        onNurture={() => onNurture(lead.id)}
        addressOpen={addressOpen}
        onToggleAddress={() => setAddressOpen((v: boolean) => !v)} />

      {addressOpen
        ? (
          <div
            className="lead-address-panel"
            id={`lead-address-panel-${lead.id}`}
            data-testid={`lead-address-${lead.id}`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {ADDRESS_FIELDS.map(([key, label]) => (
              <div className="lead-address-cell" key={key}>
                <div className="lead-card-col-title">{label}</div>
                <div data-testid={`lead-address-${key}-${lead.id}`}>
                  {str(p[key]) || <span className="empty-state">Not recorded</span>}
                </div>
              </div>
            ))}
          </div>
        )
        : null}

      <div className="lead-card-body">
        <div className="lead-card-col" data-testid={`lead-summary-${lead.id}`}>
          <div className="lead-card-col-title">Summary</div>
          <div className="lead-card-summary-body">
            {str(p.summary) || <span className="empty-state">No summary captured yet.</span>}
          </div>
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
