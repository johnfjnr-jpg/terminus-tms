import type { ReactNode } from 'react'

// ── THE ROW, COMPOSED RATHER THAN INTERPOLATED ───────────────────────────
//
// The vanilla `row()` built an HTML string and its callers passed markup into
// it: `<strong>Opening</strong>`, `<span class="tag">stale</span>`, an inline
// pg-item-note. Brief Phase 2 point 11: where the vanilla interleaved markup in
// strings, the React view COMPOSES ELEMENTS. So left/right/note are ReactNode
// and there is no dangerouslySetInnerHTML anywhere in this view.
//
// The class names and the inline styles are reproduced exactly, because they
// carry stylesheet rules and this round does not restyle. `min-width:0` on the
// left cell is what lets a long label ellipsis instead of forcing the row wide.
export function Row({ left, right, note, cls }: {
  left: ReactNode
  right: ReactNode
  note?: ReactNode
  cls?: string
}) {
  return (
    <div className={`ds-row${cls ? ` ${cls}` : ''}`}>
      <div style={{ minWidth: 0 }}>
        <div className="ds-label">{left}</div>
        {note ? <div className="pg-item-note">{note}</div> : null}
      </div>
      <div className="ds-value">{right}</div>
    </div>
  )
}
