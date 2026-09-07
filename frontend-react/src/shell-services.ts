// ── THE ONLY MODULE THAT READS window.* ──────────────────────────────────
//
// Migration Round 1, Phase 1. Every service the React tree needs from the
// vanilla shell is read here and nowhere else, and reaches components through
// context. A component that reaches for `window` has re-created the coupling
// this seam exists to contain, and there is no second place to look when the
// shell's side of it changes.
//
// THIS SEAM IS A PERMANENT DELIVERABLE. Every subsequent surface mounts
// through it, so its shape is a Round 1 decision rather than a pilot detail.
//
// ── A PHASE 1 FINDING, RECORDED WHERE IT BITES ───────────────────────────
//
// `window.api` IS NEVER ASSIGNED. Searched: zero occurrences of `window.api =`
// anywhere in frontend/. `api` is declared `async function api(...)` at
// app.js:2335 and becomes a property of `window` only because app.js is loaded
// as a CLASSIC SCRIPT - there is no build step and no `type="module"`, so its
// top-level declarations are globals.
//
// Three vanilla modules depended on that when this was written:
// opportunity-approval.js:210 (deleted at the Round 4 close) and
// opportunity-deal.js in two places. It works today and it is not this round's
// to fix. It is recorded because the day app.js becomes a module - which the
// migration ends in - `window.api` disappears and those callers break silently
// at runtime rather than loudly at build. Round 2's Phase 0 should decide
// whether the shell exports it explicitly before anything relies on it further.

export interface ApiResult<T = unknown> {
  ok: boolean
  status?: number
  data?: T
}

export interface ShellServices {
  api<T = unknown>(method: string, path: string, body?: unknown): Promise<ApiResult<T>>
  navigate(view: string, id?: string): void
  detailLoaded(view: string): void
  getOppLoadedRevision(): number | null
  /**
   * ── THE OWNERSHIP DOOR, INJECTED ─────────────────────────────────────
   *
   * Migration Round 1, Phase 4. The field-row contract's behaviour 2: one
   * guarded edit-entry hook, and the guard lives HERE rather than as a
   * getElementById inside a component, so the React tree does not couple to
   * the vanilla DOM's ownership class.
   *
   * Called at EVERY entry attempt, never read at render. The contract's own
   * note is that the door has no timing dependency, unlike the CSS treatment
   * and the disabled-flag sweep it replaced, and a value captured at render
   * would reintroduce one.
   *
   * Round 2's Phase 0 decides what the shell's implementation reads once the
   * consuming surface is known.
   */
  canEditFields(): boolean
  /**
   * ── THE SHARED REASON DIALOGUE, REUSED RATHER THAN REBUILT ───────────
   *
   * Round 6 Phase 0. The shell's dialogue owns the focus trap, the single
   * Escape owner, the backdrop-click cancel and the stays-open-on-failure
   * behaviour INTERACTION_STANDARDS section 4 requires. A React copy would be
   * a second place for all four to drift, and the vanilla recorded the same
   * decision when IT stopped owning one: "REUSED, NOT REBUILT".
   *
   * `onConfirm` returns `{ok, error}` rather than throwing, because the
   * dialogue stays open and renders `error` in place on a refusal. `onCancel`
   * must touch no caller state: cancelling the reason for one field may not
   * discard an unrelated edit.
   */
  requestChangeReason(opts: ChangeReasonOptions): void
  /**
   * The signed-in person's email, for authoring a note.
   *
   * `currentSession` is a `let` at app.js:3, but the shell ASSIGNS
   * `window.currentSession` as well, so this one genuinely is reachable -
   * unlike industriesCache or terminusStaffCache, which are lexical only. It
   * is read here rather than in a component because the seam is the only
   * module allowed to touch window.
   *
   * Returns '' rather than throwing: a note with no author is worth more than
   * a save that fails, and the server records the writer independently.
   */
  currentUserEmail(): string
  /**
   * The shell's own sentence for a stale write, HTML because it carries a
   * reload control.
   *
   * C5. Every surface that can 409 must say the same thing, and a surface that
   * worded its own would be Verification 20 in a string: two descriptions of
   * one event, only one of them ever updated - and the local version silently
   * drops the control, so the person is told to reload and given no way to.
   *
   * Returns null when the shell has no renderer, and the caller falls back to
   * its own plain sentence rather than showing nothing.
   */
  staleWriteHtml(recordId: string): string | null
  /**
   * ── C1, THE SEAM THAT REPLACES A LEXICAL READ ────────────────────────
   *
   * `frontend/app.js` bound its Contact back button to `cdReturnView`, a `let`
   * declared at the top level of `frontend/contact-detail.js`. Classic scripts
   * share one global lexical scope, so that read worked; a bundle cannot make
   * the name exist at all, because `let` never reaches `window`.
   *
   * So the direction inverts. The React view OWNS the answer and pushes it
   * here; the shell ASKS through a guarded accessor with 'leads' as its
   * default, which is the value the vanilla initialised to and the safe one -
   * leads is where an unqualified contact came from, and an unqualified
   * contact is what a record with no status is.
   */
  setContactReturnView(view: 'contacts' | 'leads'): void
}

export interface ChangeReasonOptions {
  heading: string
  contextLabel: string
  contextValue?: string
  promptLabel: string
  confirmLabel: string
  emptyReasonError?: string
  /** An element ID. The shell focuses it when the dialogue closes. */
  returnFocusTo?: string
  onConfirm(reason: string): Promise<{ ok: boolean, error?: string }>
  onDone?: () => void | Promise<void>
  onCancel?: () => void
}

type ShellWindow = Window & {
  api?: (method: string, path: string, body?: unknown) => Promise<ApiResult<unknown>>
  navigate?: (view: string, id?: string) => void
  detailLoaded?: (view: string) => void
  getOppLoadedRevision?: () => number | null
  canEditFields?: () => boolean
  requestChangeReason?: (opts: ChangeReasonOptions) => void
  currentSession?: { user?: { email?: string } } | null
  staleWriteHtml?: (recordId: string) => string
  contactReturnView?: () => 'contacts' | 'leads'
}

const w = (): ShellWindow => window as ShellWindow

// EACH SERVICE FAILS LOUDLY IF THE SHELL DID NOT PROVIDE IT, rather than
// resolving to undefined and surfacing three layers away as "cannot read
// property of undefined". The seam is where the shell's contract is checked
// because it is the only place that knows what the contract is.
export const shellServices: ShellServices = {
  async api<T = unknown>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
    const fn = w().api
    if (typeof fn !== 'function') {
      throw new Error('shell-services: window.api is not available. The React tree cannot fetch without the shell.')
    }
    return (await fn(method, path, body)) as ApiResult<T>
  },
  navigate(view: string, id?: string): void {
    const fn = w().navigate
    if (typeof fn !== 'function') throw new Error('shell-services: window.navigate is not available.')
    fn(view, id)
  },
  detailLoaded(view: string): void {
    // NOT guarded with a throw. This one is called on the failure path, and a
    // seam that throws while reporting a failure replaces the error the person
    // needed with one about the seam.
    w().detailLoaded?.(view)
  },
  getOppLoadedRevision(): number | null {
    const fn = w().getOppLoadedRevision
    return typeof fn === 'function' ? fn() : null
  },
  // ── FAILS CLOSED, AND THAT IS THE WHOLE POINT ────────────────────────
  //
  // A shell that has not provided this guard yields a surface whose fields do
  // not open. That is visible in the first second of use and safe.
  //
  // Failing OPEN would make a missing ownership door look exactly like a
  // present one, on a surface where the defect being guarded against is
  // somebody editing a record that is not theirs. An absent control that
  // reads as a working control is the failure this project keeps recording.
  canEditFields(): boolean {
    const fn = w().canEditFields
    return typeof fn === 'function' ? fn() === true : false
  },
  // GUARDED WITH A THROW, unlike detailLoaded. This one is called INSTEAD of
  // writing, not while reporting a failure: a missing dialogue means the
  // person is never asked for the reason the route will then demand, and the
  // save fails with "reason is required" for no visible cause. Failing here
  // names the actual fault.
  requestChangeReason(opts: ChangeReasonOptions): void {
    const fn = w().requestChangeReason
    if (typeof fn !== 'function') {
      throw new Error('shell-services: window.requestChangeReason is not available. '
        + 'The React tree cannot ask for a change reason without the shell dialogue.')
    }
    fn(opts)
  },
  currentUserEmail(): string {
    return w().currentSession?.user?.email ?? ''
  },
  staleWriteHtml(recordId: string): string | null {
    const fn = w().staleWriteHtml
    return typeof fn === 'function' ? fn(recordId) : null
  },
  // NOT guarded with a throw. The shell reads this through its own guarded
  // accessor with a default, so a shell that never asks is a shell whose back
  // button still works.
  setContactReturnView(view: 'contacts' | 'leads'): void {
    w().contactReturnView = () => view
  },
}
