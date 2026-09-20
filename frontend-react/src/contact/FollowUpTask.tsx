// ── THE FOLLOW-UP TASK ───────────────────────────────────────────────────
//
// P3 gives P1's follow-up keys their first surface. P1 built and proved them
// server-side - `followUpDate` and `followUpDescription`, writable on EVERY
// status - and said plainly that nothing rendered them. This is that panel.
//
// INDEPENDENT OF THE NURTURE REASON, which is the distinction P1 exists to
// keep: the reason explains why a lead went to Nurture and is a NOTE; the task
// says what to do and when, and is a pair of fields. A lead that is Unqualified
// or Qualified has no reason and may still have a task.
//
// NOT A FieldRow, deliberately. The shared row is one label and one value with
// its own open/close; a task is two fields that are saved together and read as
// one thing. Forcing it into the row would make the date and the description
// separately dirty, separately openable and separately discardable, which is
// the opposite of what a task is.
//
// THE DOOR REACHES IT. Both controls are ordinary form elements, so
// applyReadOnlyControls disables them by what they ARE rather than by a name
// list, and the door probe asserts `followUp` by name - the tripwire P2 left
// declared and shrink-only turns green here.
import { useState } from 'react'

export function FollowUpTask({ date, description, onSave, resetKey }: {
  date: string
  description: string
  onSave: (next: { followUpDate: string, followUpDescription: string }) => void
  /** Changes per visit, so a half-typed task cannot follow you to another lead. */
  resetKey?: unknown
}) {
  const [d, setD] = useState(date)
  const [t, setT] = useState(description)
  const [lastReset, setLastReset] = useState(resetKey)
  const [lastSaved, setLastSaved] = useState({ date, description })

  // A4's rule, applied here too: edits live only until saved or discarded, so
  // changing lead drops them. Compared during render rather than in an effect,
  // for the same reason the field rows do it - an effect is one paint late.
  if (resetKey !== lastReset) {
    setLastReset(resetKey)
    setD(date); setT(description)
    setLastSaved({ date, description })
  }

  const dirty = d !== lastSaved.date || t !== lastSaved.description

  return (
    <div className="cd-card" data-testid="cd-card-followup">
      <div className="cd-card-head">
        <span className="cd-card-title">Follow-up task</span>
        {dirty
          ? <span className="sub" data-testid="cd-followup-dirty">unsaved</span>
          : null}
      </div>

      <div className="cd-followup-body">
        <label className="cd-followup-field">
          <span className="label">Date</span>
          <input
            type="date"
            id="cd-followUpDate"
            data-testid="cd-followUpDate"
            value={d}
            onChange={(e) => setD(e.target.value)} />
        </label>

        <label className="cd-followup-field cd-followup-field--wide">
          <span className="label">Description</span>
          <input
            type="text"
            id="cd-followUpDescription"
            data-testid="cd-followUpDescription"
            placeholder="What needs doing"
            value={t}
            onChange={(e) => setT(e.target.value)} />
        </label>

        {/* ── THE SAME DEFECT AS R5, FOUND BY OPENING A SCREENSHOT ────────
            This button carried no class either, so it rendered as a white
            browser default beside `Add note`, which wears `btn-sm`, on the
            very same card row.

            IT IS REPORTED AS A THIRD-SURFACE FINDING RATHER THAN SMUGGLED IN.
            The Opportunity round put this component on a THIRD surface, so
            the defect is one this round made visible on a screen it built;
            the Contact and the Test Bed have carried it for longer. The class
            is therefore shared, and the blast radius is all three surfaces,
            which is stated at the close rather than left to be discovered.

            `btn-sm` and not `btn-primary`, matching `cd-add-note-btn` on the
            same card family rather than inventing a second weight for a
            neighbouring control. */}
        <button
          type="button"
          className="btn-sm"
          id="cd-followup-save"
          data-testid="cd-followup-save"
          disabled={!dirty}
          onClick={() => {
            onSave({ followUpDate: d, followUpDescription: t })
            setLastSaved({ date: d, description: t })
          }}>
          Save task
        </button>
      </div>
    </div>
  )
}
