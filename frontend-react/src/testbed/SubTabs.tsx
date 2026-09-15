// ── L4: THE REFERENCE SUB-TAB STRIP ──────────────────────────────────────
//
// `tb-ref-subtabs` was dropped at the swap. The Reference tab now stacks nine
// cards; the last three were PANES - `Use cases`, `Customer documents`,
// `History` - and the business's own reason for making them panes is recorded
// at the vanilla's markup: two large, mostly-empty panels for two lists that
// are usually short is a poor use of the tab's vertical space.
//
// ── CONTROLLED, BECAUSE THE OPEN PANE OUTLIVES THIS COMPONENT ────────────
//
// The vanilla mounted the strip once per RECORD, not once per render, and said
// why: rebuilding it on every render snapped the open pane back to Use cases
// while somebody was working in Customer documents.
//
// React has a sharper version of the same problem. `TestBedPanel` UNMOUNTS on
// every tab switch (`StageTabs` renders `active === 'x' ? panel : null`), so
// state held here would reset on Reference -> Commercials -> Reference. The
// HOST outlives the tabs, which is why R1 lifted the draft store there, and
// the open pane is lifted for exactly the same reason. This component is
// controlled and holds nothing.
//
// ── THE TREATMENT IS THE ESTATE'S, NOT A NEW ONE ─────────────────────────
//
// `.sub-tabs`, and `.detail-tab .sub-tab` on each button, are the classes the
// vanilla's `createTabStrip` emitted and they are still in `style.css`
// (Verification 7: a replacement control carries the replaced control's class,
// and where the estate has a named treatment for the role, that name is the
// contract).
//
// ── AND THE BEHAVIOUR THAT WAS NOT IN ITS PROPS ──────────────────────────
//
// Verification 7's behaviour axis: before replacing a component, list what the
// old one DID that is not in its props. `createTabStrip` carried a ROVING
// TABINDEX and ARROW-KEY navigation, neither of which is visible in its call
// site and both of which a strip loses silently. They are reproduced here.
//
// The Test Bed's OTHER strip, `StageTabs`, has neither. That is a real gap and
// it is recorded rather than fixed in passing: it is not this round's scope,
// and a fix there is a change to the stage tabs.
import { useRef, type ReactNode } from 'react'

export interface SubTab {
  key: string
  label: string
  content: ReactNode
}

export function SubTabs({ idPrefix, label, tabs, active, onSelect }: {
  /**
   * Prefix for the GENERATED pane and tab ids, so `aria-controls` resolves.
   *
   * NAMED `idPrefix` RATHER THAN `id`, and the guard is what named it.
   * `no-duplicate-ids.test.mjs` refused the commit on `id="tb-ref-subtabs"`,
   * because `frontend/index.html:1025` still carries that id in the retired
   * vanilla block. No DOM id actually collided - this value is a prefix and
   * only ever appears as `${idPrefix}-tab-x` / `${idPrefix}-pane-x` - but a
   * prop called `id` that is not an id is a name asserting something untrue
   * (Verification 19), and the scan cannot tell a prop from an attribute.
   *
   * Renaming was the better answer than an exemption: the guard's refusal was
   * information about the name rather than an obstacle in front of it
   * (Verification 9's ratchet clause).
   */
  idPrefix: string
  /** The strip's accessible name. */
  label: string
  tabs: readonly SubTab[]
  active: string
  onSelect: (key: string) => void
}) {
  const stripRef = useRef<HTMLDivElement | null>(null)
  if (!tabs.length) return null
  // A key that is no longer in the list falls back to the first, so a pane
  // cannot be "open" with nothing rendered.
  const current = tabs.some((t) => t.key === active) ? active : tabs[0].key
  const open = tabs.find((t) => t.key === current)

  const move = (delta: number) => {
    const i = tabs.findIndex((t) => t.key === current)
    const next = tabs[(i + delta + tabs.length) % tabs.length]
    onSelect(next.key)
    // Focus follows selection, which is what the vanilla's roving tabindex
    // did: the newly selected tab is the one in the page's tab sequence, so
    // leaving focus behind would strand it on a tabIndex -1 element.
    //
    // FOUND BY A TEST, not by reading: the first version built a selector with
    // `CSS.escape`, which is undefined in jsdom and threw an unhandled error
    // out of the keydown handler. Reading the buttons and matching the dataset
    // needs no escaping at all, so the whole class goes rather than being
    // guarded - and a tab key with a quote in it could never have worked.
    const btns = [...(stripRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    btns.find((b) => b.dataset.subTab === next.key)?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1) }
    else if (e.key === 'Home') { e.preventDefault(); onSelect(tabs[0].key) }
    else if (e.key === 'End') { e.preventDefault(); onSelect(tabs[tabs.length - 1].key) }
  }

  return (
    <div data-testid={idPrefix}>
      <div className="sub-tabs" role="tablist" aria-label={label}
        ref={stripRef} onKeyDown={onKeyDown} data-testid={`${idPrefix}-strip`}>
        {tabs.map((t) => (
          <button key={t.key} type="button"
            id={`${idPrefix}-tab-${t.key}`}
            className={t.key === current ? 'detail-tab sub-tab active' : 'detail-tab sub-tab'}
            role="tab"
            aria-selected={t.key === current}
            aria-controls={`${idPrefix}-pane-${t.key}`}
            // ROVING TABINDEX: exactly one tab is in the page's tab sequence,
            // so Tab moves THROUGH the strip rather than into every tab in it.
            tabIndex={t.key === current ? 0 : -1}
            data-sub-tab={t.key}
            data-testid={`${idPrefix}-btn-${t.key}`}
            onClick={() => onSelect(t.key)}>
            {t.label}
          </button>))}
      </div>
      {/* ONLY THE OPEN PANE IS RENDERED, which is how History stays LAZY - the
          vanilla loaded it on select rather than on every record load, and not
          rendering it is a stronger version of the same thing.

          It also sidesteps the hidden-attribute trap: a pane hidden by a class
          or an attribute can be un-hidden by any stylesheet rule that gives it
          a `display`, which CLAUDE.md Verification 4 records costing two
          contract behaviours at once. A pane that is not in the DOM cannot be
          revealed by the cascade. */}
      {open
        ? (
          <div id={`${idPrefix}-pane-${open.key}`} role="tabpanel" tabIndex={0}
            aria-labelledby={`${idPrefix}-tab-${open.key}`}
            data-testid={`${idPrefix}-pane-${open.key}`}>
            {open.content}
          </div>)
        : null}
    </div>
  )
}
