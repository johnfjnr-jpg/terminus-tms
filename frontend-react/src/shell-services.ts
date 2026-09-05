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
// Three vanilla modules already depend on that: opportunity-approval.js:210 and
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
}

type ShellWindow = Window & {
  api?: (method: string, path: string, body?: unknown) => Promise<ApiResult<unknown>>
  navigate?: (view: string, id?: string) => void
  detailLoaded?: (view: string) => void
  getOppLoadedRevision?: () => number | null
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
}
