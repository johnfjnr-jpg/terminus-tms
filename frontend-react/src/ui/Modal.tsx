// ── THE MODAL SHAPE: SECTIONS 4 AND 5, INSIDE THE COMPONENT ──────────────
//
// John's ruling: a modal is a DISTINCT shape. Its actions sit in a FOOTER
// row, not on a header line - the established dialogue convention, GOV.UK and
// APG, both of which INTERACTION_STANDARDS already cites. Named explicitly so
// the two on the lead card are a convention rather than a silent S1
// violation.
//
// ── AND SECTIONS 4 AND 5 LIVE HERE, NOT IN EACH CALLER ───────────────────
//
// Phase 0 measured both of the card's dialogues at 0 of 6 on Section 4 - no
// focus on open, no Tab confinement, no Escape - and 1 of 3 on Section 5.
// The standard is nine sections old and the React surfaces never received
// it: the 42 lines of focus-trap tokens the document counts are all in the
// vanilla, and Section 5's two cited implementations were built in
// `frontend/contact-detail.js`, which the migration retired.
//
// They are implemented ONCE, here, because Section 4's own text says it
// "applies to any future in-page panel that plays the same role as Park",
// and a standard re-implemented per dialogue is the thing this round exists
// to stop.
//
// ── SECTION 5's TWO MECHANISMS ARE DELIBERATELY DIFFERENT ────────────────
//
// The document is explicit that conflating them is a real design error:
//
//   - ACCIDENTAL dismissal (a backdrop click) is REFUSED, with a nudge. The
//     premise is that it was a misclick, not a decision. Phase 0 found the
//     refusal working and SILENT, which is the one combination Section 5
//     argues against - the person clicks, nothing happens, and nothing says
//     why.
//   - INTENTIONAL leave (Cancel, close, Escape) gets confirm-and-discard,
//     because refusing outright would make Cancel non-functional while
//     dirty. Phase 0 found this discarding silently: a live data-loss path.
import { useEffect, useRef, type ReactNode } from 'react'
import { useShell } from '../ShellContext'

/** `app.js` owns the shared discard dialogue; the seam is how we ask it. */
const discardConfirmIsOpen = (): boolean => {
  const f = (window as unknown as { discardConfirmIsOpen?: () => boolean }).discardConfirmIsOpen
  return typeof f === 'function' ? f() : false
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]),'
  + ' textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  title, children, footer, onClose, dirty = false, testid, regionId, nudge,
}: {
  title: string
  children: ReactNode
  /**
   * The footer row. John's ruling: a modal's actions live here, not on the
   * header line.
   *
   * A RENDER FUNCTION, so the footer's dismiss control routes through the
   * SAME `requestClose` that Escape does. Two paths out of one dialogue is
   * how Phase 0 found Escape doing nothing while Close discarded silently.
   */
  footer: (requestClose: () => void) => ReactNode
  onClose: () => void
  /** Drives BOTH of Section 5's mechanisms. */
  dirty?: boolean
  testid: string
  regionId: string
  /** Rendered by the caller when a backdrop click is refused. */
  nudge?: ReactNode
}) {
  const shell = useShell()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const openerRef = useRef<Element | null>(null)

  // SECTION 4: focus moves to the panel's first focusable element on open,
  // and returns to the control that opened it on close. The opener is
  // captured on mount because by the time we close, activeElement is inside
  // the dialogue.
  useEffect(() => {
    openerRef.current = document.activeElement
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    return () => {
      const back = openerRef.current
      if (back instanceof HTMLElement && document.contains(back)) back.focus()
    }
  }, [])

  // SECTION 5, INTENTIONAL LEAVE: confirm, then discard. When clean it
  // closes immediately, exactly as before the guard existed.
  const requestClose = () => {
    if (!dirty) { onClose(); return }
    shell.confirmDiscard(() => { onClose() })
  }

  // Declared before the effects that close over it.
  // SECTION 4: Tab and Shift+Tab cycle only through the dialogue's own
  // focusable elements. Escape closes, by the same path as Cancel so it
  // inherits Section 5's protection rather than bypassing it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The document's own inert-guard: while the shared discard dialogue is
      // open, this handler stands down, so one Escape cannot fire both in the
      // same tick.
      if (discardConfirmIsOpen()) return
      if (e.key === 'Escape') { e.preventDefault(); requestClose(); return }
      if (e.key !== 'Tab') return
      // NO `offsetParent` FILTER. It reads null in jsdom, which has no
      // layout, so the trap collapsed to a single element and both wrap
      // tests failed - and in a browser it is a fragile way to ask about
      // visibility anyway. The FOCUSABLE selector already excludes disabled
      // controls, and a `hidden` subtree is out of the tab order by
      // specification, so `[hidden]` is the honest exclusion.
      const items = [...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
        .filter((el) => !el.closest('[hidden]'))
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const a = document.activeElement
      if (e.shiftKey && (a === first || !panelRef.current?.contains(a))) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && a === last) {
        e.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  })

  // SECTION 5, ACCIDENTAL DISMISSAL: refused, and it says so. The refusal
  // alone was what Phase 0 found; the nudge is the half that was missing.
  const onBackdrop = (e: React.MouseEvent) => {
    // STOP PROPAGATION FIRST, ALWAYS. The lead card is itself a click target
    // that navigates, so a backdrop click that bubbles opens the record -
    // and the modal's own refusal then looks like a refusal that failed,
    // because the view it was rendered into has been hidden underneath it.
    //
    // The popup this replaced carried `onClick={(e) => e.stopPropagation()}`
    // on its backdrop and the reason was not written down; dropping it was a
    // regression, caught by the live probe measuring the ancestor chain and
    // finding `#view-leads` at `display: none`.
    e.stopPropagation()
    if (e.target !== e.currentTarget) return
    if (!dirty) { onClose(); return }
    const save = panelRef.current?.querySelector<HTMLElement>('.form-actions button')
    save?.classList.add('btn-attention')
    const warn = panelRef.current?.querySelector<HTMLElement>('[data-modal-nudge]')
    if (warn) {
      warn.hidden = false
      // Section 5 asks for the nudge to be scrolled into view, "so it's
      // visible even if the user was scrolled elsewhere in a long form".
      // GUARDED because jsdom does not implement scrollIntoView: unguarded it
      // threw outside any assertion, so the suite reported 975 PASSED and
      // exited 1 - a green count on a red run, which is why the coarsest
      // signal is the one to read.
      warn.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    }
  }

  return (
    <div className="modal-backdrop" id={regionId} data-testid={testid}
      onClick={onBackdrop}
      onKeyDown={(e) => e.stopPropagation()}>
      <div className="modal-panel modal-panel-wide" role="dialog" aria-modal="true"
        aria-labelledby={`${regionId}-heading`} ref={panelRef}
        onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow" id={`${regionId}-heading`}>{title}</p>
        {children}
        {/* The nudge lives in the markup and is revealed, rather than being
            mounted on refusal: a node that appears is a node the scroll has
            to chase. */}
        <p className="msg-warning" data-modal-nudge hidden
          data-testid={`${testid}-nudge`}>
          {nudge ?? 'You have unsaved changes, save or close.'}
        </p>
        {/* JOHN'S RULING: a modal's actions are a FOOTER row. */}
        <div className="form-actions">{footer(requestClose)}</div>
      </div>
    </div>
  )
}

/** The dismiss control, so every modal's way out is the same one. */
export function ModalClose({ onRequestClose, regionId, testid, label }: {
  onRequestClose: () => void
  regionId: string
  testid: string
  label?: string
}) {
  // `aria-controls` is the DECLARED PROPERTY the door reads to know this is a
  // read affordance rather than a write - and R3 of this round is that it
  // must NAME A REAL ELEMENT. The door reads the attribute's presence, not
  // its target, so a broken pointer grants the exemption anyway: an exemption
  // held by a false declaration. `regionId` is the modal's own id.
  return (
    <button type="button" className="btn-sm" data-testid={testid}
      aria-controls={regionId} onClick={onRequestClose}>{label ?? 'Close'}</button>
  )
}
