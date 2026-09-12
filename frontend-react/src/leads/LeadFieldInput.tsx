// One input for one lead field, shared by the New Lead grid and the Qualify
// completion popup (R1 + R6). The DEFINITION is in leadFields.ts; this is how
// it is rendered as a control.
//
// Deliberately layout-free: no widths, no labels, no wrapper. The grid puts it
// in a <td> and the popup puts it under a <label>, and neither has to know
// what the other does.
import type { LeadField } from './leadFields'

export function LeadFieldInput({
  field, value, onChange, industries, sources, regions = [], testid, invalid, describedBy,
  onFocus, onBlur, title,
}: {
  field: LeadField
  value: string
  onChange: (v: string) => void
  industries: Array<{ id: string, name: string }>
  sources: string[]
  /** R3: served by the server, never a copy typed here. */
  regions?: string[]
  testid: string
  invalid?: boolean
  describedBy?: string
  /**
   * The grid's auto-extend hangs off FOCUS and its touched-tracking off BLUR.
   * They are props rather than something this file invents, and they are here
   * at all because the first version of the swap dropped them: the grid's old
   * inline `common` object carried both, and moving the rendering out without
   * moving them would have silently killed auto-extend and the on-blur
   * validation. Verification 43 - list what the retired path WROTE.
   */
  onFocus?: () => void
  onBlur?: () => void
  title?: string
}) {
  const common = {
    'data-testid': testid,
    value,
    onFocus,
    onBlur,
    title,
    'aria-invalid': invalid ? true : undefined,
    'aria-errormessage': invalid ? describedBy : undefined,
    className: invalid ? 'field-blocked' : undefined,
  }
  if (field.kind === 'industry') {
    return (
      <select {...common} onChange={(e) => onChange(e.target.value)}>
        <option value="">--</option>
        {industries.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
    )
  }
  if (field.kind === 'source') {
    return (
      <select {...common} onChange={(e) => onChange(e.target.value)}>
        <option value="">--</option>
        {sources.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    )
  }
  if (field.kind === 'region') {
    // R3: a select, from the list the SERVER serves. If the fetch has not
    // landed the field still renders - as a select with only the current
    // value - rather than silently becoming free text, which would be the
    // drift arriving through the back door.
    const opts = regions.length ? regions : (value ? [value] : [])
    return (
      <select {...common} onChange={(e) => onChange(e.target.value)}>
        <option value="">--</option>
        {opts.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    )
  }
  if (field.kind === 'textarea') {
    return <textarea {...common} rows={2} onChange={(e) => onChange(e.target.value)} />
  }
  // type="text" EXPLICITLY. The estate styles `input[type="text"]`, and
  // LinkAccountPanel's typeless input is why the Qualify account step rendered
  // a white browser default on a dark screen - one of the four F3 instances.
  // Every input this file makes carries its type.
  return <input type="text" {...common} onChange={(e) => onChange(e.target.value)} />
}
