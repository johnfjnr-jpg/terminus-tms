// ── THE PANEL SHELL: THE PRINCIPLE, MADE UNROUTABLE-AROUND ───────────────
//
// > ACTION GOES WITH ITS SCOPE. A control sits with the thing it acts on.
//
// Record-scoped actions live on the record's action bar
// (INTERACTION_STANDARDS Section 6). PANEL-scoped actions live on the
// panel's header line, right-aligned (S1). One principle, two scopes.
//
// ── WHY A COMPONENT AND NOT A CONVENTION ─────────────────────────────────
//
// Phase 0 measured FIVE save-control placements on ONE card, and no shared
// panel component of any kind: three competing CSS shells - `.card-col-head`,
// `.cd-card`, and `.eyebrow` plus `.form-actions`. The panels were not
// inconsistent through carelessness. THERE WAS NEVER ONE THING TO BUILD THEM
// FROM.
//
// So `Panel` renders its own header and takes actions ONLY through the
// header's slot. A panel cannot put its Save below its field, because a panel
// has nowhere else to put it. Conforming three shells would have left three
// shells that agree today, which is Verification 20 at component level and is
// what produced this round.
//
// ── THE REGISTRY IS STRUCTURAL ───────────────────────────────────────────
//
// Every Panel emits `data-panel`. The conformance test enumerates from THAT
// rather than from a hand-written list, because Verification 19 records that
// a list enumerated by name fails silently on the member nobody added.
import type { ReactNode } from 'react'

export function PanelHeader({
  title, secondary, actions, testid, headerTestid, required, requiredTestid,
}: {
  title: string
  /** The Notes pattern's `LATEST FIRST`: a fact about the panel, not a control. */
  secondary?: ReactNode
  /** S1: right-aligned, by the layout rather than by each caller remembering. */
  actions?: ReactNode
  testid?: string
  /** So a panel adopting the shell keeps the testid its tests already use. */
  headerTestid?: string
  /**
   * R3: THE PANEL SAYS IT MUST BE COMPLETED, and the shell owns saying it.
   *
   * It replaces a sentence the completion surface used to render - "Summary
   * is required. Complete it in the Summary panel below." - which pointed at
   * a panel instead of marking it. One asterisk on the real panel beats an
   * instruction about where to go.
   *
   * ON THE SHELL RATHER THAN IN ONE PANEL, deliberately: any panel that must
   * be completed now says so the same way, and Round B's account section
   * inherits it without deciding again.
   */
  required?: boolean
  requiredTestid?: string
}) {
  const hid = headerTestid ?? (testid ? `${testid}-head` : undefined)
  return (
    <div className="panel-head" data-panel-header={testid ?? ''}
      {...(hid ? { 'data-testid': hid } : {})}>
      {/* `data-panel-title` is structural, so the conformance test can find
          a panel's title without every panel remembering to add a testid. */}
      <span className="panel-title" data-panel-title>
        {title}
        {required
          ? <span className="nlg-required"
              {...(requiredTestid ? { 'data-testid': requiredTestid } : {})}> *</span>
          : null}
      </span>
      {secondary ? <span className="panel-secondary">{secondary}</span> : null}
      {actions ? <span className="panel-actions">{actions}</span> : null}
    </div>
  )
}

export function Panel({
  name, title, secondary, actions, children, testid, className, headerTestid,
  required, requiredTestid,
}: {
  /** The registry key. Structural, so a new panel joins the census by existing. */
  name: string
  title: string
  secondary?: ReactNode
  actions?: ReactNode
  children: ReactNode
  testid?: string
  className?: string
  headerTestid?: string
  required?: boolean
  requiredTestid?: string
}) {
  return (
    <section className={`panel${className ? ` ${className}` : ''}`} data-panel={name}
      {...(testid ? { 'data-testid': testid } : {})}>
      <PanelHeader title={title} secondary={secondary} actions={actions}
        testid={testid} headerTestid={headerTestid}
        required={required} requiredTestid={requiredTestid} />
      <div className="panel-body">{children}</div>
    </section>
  )
}
