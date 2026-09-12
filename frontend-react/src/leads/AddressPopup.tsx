// ── R2: THE ADDRESS POPUP, EDITABLE ──────────────────────────────────────
//
// CARD-LOCAL, and that is a ruling rather than a convenience. Lead Detail's
// address fields run through its own field-row machinery; sharing them would
// mean either coupling a live surface to one being retired, or extracting a
// component out of it - and extracting is an edit to a FROZEN surface.
//
// So this duplicates address editing while Lead Detail stands, declared here
// the way NurtureDialog's duplication is declared: when Lead Detail retires
// after John confirms card parity, this becomes the only one. Until then a
// change to how an address is edited has to land in both.
//
// ── R2 FLIPS LAST ROUND'S R11, AND THE ASSERTION CHANGES WITH IT ─────────
//
// R11 ruled Address ALIVE on an unowned card because it was a read disclosure
// and the revealed panel held ZERO controls - asserted, not argued. An
// editable address is a WRITE, so that assertion EXPIRES. What replaces it is
// a read-versus-write separation: on an unowned lead the values stay readable
// and the inputs and Save are dead.
//
// The door does that by itself once the controls are real form controls -
// `applyReadOnlyControls` disables inputs and buttons - which is why this
// renders inputs rather than contenteditable divs or a custom widget the door
// would not recognise.
import { useMemo, useRef, useState } from 'react'
import { useShell } from '../ShellContext'
import { ADDRESS_FIELDS } from './leadFields'
import { LeadFieldInput } from './LeadFieldInput'

export function AddressPopup({ leadId, current, regions, onClose, onSaved }: {
  leadId: string
  current: Record<string, unknown>
  /** R3: served, never a copy typed here. */
  regions: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const shell = useShell()
  const initial = useMemo(() => Object.fromEntries(
    ADDRESS_FIELDS.map((f) => [f.key, String(current[f.key] ?? '')])), [current])
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  // SAVE ENABLES ONLY WHEN DIRTY, and dirty means differs from what was
  // loaded - not "somebody typed". Typing a character and deleting it leaves
  // the record unchanged and must leave the button disabled.
  const dirty = ADDRESS_FIELDS.some((f) => (values[f.key] ?? '') !== (initial[f.key] ?? ''))

  const save = async () => {
    if (inFlight.current || !dirty) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      // ── WRITE THE DIFF, NOT THE GROUP ───────────────────────────────
      //
      // This wrote all six fields unconditionally, and it DESTROYED DATA.
      // Found by probe: after editing only `city`, the record came back with
      // address, address2, postcode, country and region all empty.
      //
      // The mechanism is `useState(initial)`, which seeds ONCE. If the popup
      // mounts before a refetch has landed, `values` holds the stale - here
      // empty - record, and saving then writes those blanks over real data.
      // The screen looked right at every moment: it showed what it had.
      //
      // Verification 20's addendum exactly, arriving through a write: a
      // control that supplies a value on save turns "unchanged" into "empty"
      // wherever the payload is rebuilt from the screen. The same shape that
      // would have deleted marginOverrides on 33 opportunities.
      //
      // QualifyCompletion already writes only what differs; this now does too,
      // so a field the person did not touch is not a field they cleared.
      const payload: Record<string, string> = {}
      for (const f of ADDRESS_FIELDS) {
        const next = (values[f.key] ?? '').trim()
        if (next !== (initial[f.key] ?? '')) payload[f.key] = next
      }
      if (!Object.keys(payload).length) { onSaved(); return }
      const r = await shell.api<{ error?: string }>(
        'PATCH', `/api/contacts/${leadId}`, { payload })
      if (!r.ok) { setError(r.data?.error ?? 'Could not save the address.'); return }
      onSaved()
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" id={`address-popup-region-${leadId}`}
      data-testid={`address-popup-${leadId}`}
      onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <div className="modal-panel modal-panel-wide" role="dialog" aria-modal="true"
        aria-labelledby={`address-heading-${leadId}`}>
        <p className="eyebrow" id={`address-heading-${leadId}`}>Address details</p>
        <div className="address-popup-grid">
          {ADDRESS_FIELDS.map((f) => (
            <div className="address-popup-cell" key={f.key}>
              <label htmlFor={`addr-${f.key}-${leadId}`}>{f.label}</label>
              <LeadFieldInput
                field={f}
                value={values[f.key] ?? ''}
                onChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
                industries={[]}
                sources={[]}
                regions={regions}
                testid={`addr-${f.key}-${leadId}`} />
            </div>
          ))}
        </div>
        {error ? <p className="msg-error" data-testid={`addr-error-${leadId}`}>{error}</p> : null}
        <div className="form-actions">
          <button type="button" className="btn-primary" data-testid={`addr-save-${leadId}`}
            disabled={busy || !dirty} onClick={() => { void save() }}>
            {busy ? 'Saving...' : 'Save'}
          </button>
          {/* ── CLOSE MUST SURVIVE THE DOOR ─────────────────────────────
              Found by probe, not by reading: on an UNOWNED lead the door
              neutralises every button in the card, and this one was among
              them - so the popup opened over a full-screen backdrop and
              could not be dismissed. The card behind it became unclickable.
              That is P3's family exactly: the door must never make an
              unowned lead unusable to READ.

              `aria-controls` is the DECLARED PROPERTY the door already reads
              for read affordances, and it is TRUE here: this button controls
              that region's visibility, the same justification the notes
              expand rungs carry. Exempting by a class name would be
              Verification 19's warning - a styling class sheltering
              controls. */}
          <button type="button" className="btn-ghost" data-testid={`addr-close-${leadId}`}
            aria-controls={`address-popup-region-${leadId}`}
            onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
