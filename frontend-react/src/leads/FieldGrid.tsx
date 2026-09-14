// ── THE DENSE LABELLED FIELD GRID ────────────────────────────────────────
//
// R8, direction (c). One definition, rendered by both record surfaces.
//
// WHY IT IS SHARED RATHER THAN COPIED. Phase 1's screenshots measured the two
// surfaces answering the same question differently: at 1440 the completion
// surface showed FOURTEEN of the record's fields and contact detail showed
// ZERO, because its two field cards are collapsed by default. The ruling took
// this display for both. A second copy on the contact side would be
// Verification 20 arriving in markup - two renderers of one idea, agreeing
// today.
//
// WHAT IT IS NOT. It is not a panel header of its own: it renders the shell's
// `Panel`, which is what the conformance gate requires and what it checks
// transitively through the render closure. Building a title line here would
// red that gate, correctly.
//
// THE STATE IS THE CALLER'S. This component holds none. The completion
// surface keeps its own `values` map; the contact surface passes its
// `FieldRowsController` straight through - which is what preserves the save
// path, the dirty count, the discard and, with them, the change-note audit
// trail that Round B measured a naive swap deleting silently.
import type { LeadField } from './leadFields'
import { LeadFieldInput } from './LeadFieldInput'
import { Panel } from '../ui/Panel'

export function FieldGrid({
  title, testid, name, fields, valueOf, onChange,
  missing, tinted, industries, sources, regions, disabled, inputTestid, missingTestid,
  className = 'lead-complete-group',
}: {
  title: string
  testid: string
  /** The shell's panel name, for the conformance gate's own vocabulary. */
  name: string
  fields: LeadField[]
  valueOf: (key: string) => string
  onChange: (key: string, v: string) => void
  /**
   * Fields the SERVER says are outstanding, marked with an asterisk.
   *
   * C23: the mode governs framing, the server governs marks. This is the
   * server's half, and it is a prop rather than anything this component
   * decides - Round B's recorded fault was a surface suppressing markers on
   * its own initiative, which deleted the qualification tinting.
   */
  missing?: Set<string>
  /** Fields a refused qualify named, tinted on the cell. */
  tinted?: Set<string>
  industries: Array<{ id: string, name: string }>
  sources: string[]
  regions: string[]
  /** The door, answered at render by the caller. */
  disabled?: boolean
  /**
   * THE CALLER OWNS ITS NAMING, and that is deliberate rather than lazy.
   *
   * The completion surface's inputs are `lead-fix-<key>-<leadId>`, with the
   * record id LAST, and six probes plus three gate suites cite them. A grid
   * that imposed its own scheme would rename every one of them for no reason
   * other than its own convenience - Verification 32, a cited identifier is
   * an identifier and not a position.
   */
  inputTestid: (key: string) => string
  missingTestid: (key: string) => string
  /**
   * R8: THE FRAME IS THE CALLER'S, because the two surfaces sit in different
   * furniture. On the contact screen this grid is a sibling of
   * `cd-card-account` and five other cards, so it must carry the card frame or
   * it hangs outside the border every neighbour has - a defect that shipped
   * once already, was found by opening a screenshot, and whose guard (R6-5)
   * fired on this very change.
   */
  className?: string
}) {
  return (
    <Panel name={name} title={title} testid={testid} className={className}>
      <div className="lead-complete-grid">
        {fields.map((f) => (
          // `data-key` is the handle every field census in this estate uses,
          // on both surfaces, and it is carried here so the count assertions
          // keep measuring the same thing across the swap.
          // THE TINT IS A PROPERTY OF THE CELL, and `field-blocked` is the
          // estate's own class for it - the same one the display/edit row
          // wrapper carried, so every existing assertion keeps measuring the
          // same thing across the swap.
          <div key={f.key} data-key={f.key}
            className={`lead-complete-cell${tinted?.has(f.key) ? ' field-blocked' : ''}`}>
            <label htmlFor={inputTestid(f.key)}>
              {f.label}
              {missing?.has(f.key)
                ? <span className="nlg-required" data-testid={missingTestid(f.key)}> *</span>
                : null}
            </label>
            <LeadFieldInput
              field={f}
              value={valueOf(f.key)}
              onChange={(v) => onChange(f.key, v)}
              industries={industries}
              sources={sources}
              regions={regions}
              disabled={disabled}
              testid={inputTestid(f.key)} />
          </div>
        ))}
      </div>
    </Panel>
  )
}
