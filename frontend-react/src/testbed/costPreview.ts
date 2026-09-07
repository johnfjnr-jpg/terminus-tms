// ── THE LIVE COST PREVIEW ────────────────────────────────────────────────
//
// Round 7 Phase 1a, built from the Phase 0 enumeration C1-C9 with the two
// findings that enumeration produced FIXED here rather than carried.
//
// C3: THE BROWSER ADDS UP NOTHING. The drafts are sent to the server's cost
// engine and whatever comes back is rendered. `buildTestBedCostBreakdown` is
// the single mapping point for a saved record too, so a preview and a save
// cannot disagree.

/** C1: the thirteen keys the server's engine reads. */
export const COST_INPUT_KEYS = [
  'safesightCameras', 'airQualitySensors', 'hemirSensors',
  'ssUnitCost', 'aqUnitCost', 'hemirUnitCost',
  'ssInstallCost', 'aqInstallCost', 'hemirInstallCost',
  'ssHostingCost', 'aqHostingCost', 'hemirHostingCost',
  'testBedDuration',
] as const

/** C2: the debounce, preserved. */
export const PREVIEW_DEBOUNCE_MS = 400

export interface Drafts { [key: string]: string | undefined }

/**
 * ── FINDING T3, FIXED: `??` SEMANTICS, NOT `||` ─────────────────────────
 *
 * The vanilla reads `tbEdits[key]?.draft || tbPayload?.[key] || ''`. `||`, not
 * `??` - so an EMPTIED field has draft `''`, which is falsy, and falls through
 * to the STORED value. **The preview then prices a field the person has just
 * cleared.**
 *
 * Architecture 11's family: a fallback in the calculation. A cleared field is a
 * state the screen must be able to SAY, not one it quietly replaces.
 *
 * The distinction is asserted rather than described: a draft of `''` is a
 * VALUE, and only the ABSENCE of a draft falls through.
 */
export function effectiveValue(
  key: string,
  drafts: Drafts,
  stored: Record<string, unknown>,
): string {
  const draft = drafts[key]
  if (draft !== undefined) return draft
  const v = stored[key]
  return v === null || v === undefined ? '' : String(v)
}

/** C5: dirtiness is by COMPARISON, so returning a field to its stored value clears the preview. */
export function costFieldsDirty(drafts: Drafts, stored: Record<string, unknown>): boolean {
  return COST_INPUT_KEYS.some((k) => {
    const draft = drafts[k]
    if (draft === undefined) return false
    const v = stored[k]
    return draft !== (v === null || v === undefined ? '' : String(v))
  })
}

export function previewBody(drafts: Drafts, stored: Record<string, unknown>): Record<string, string> {
  const body: Record<string, string> = {}
  for (const k of COST_INPUT_KEYS) body[k] = effectiveValue(k, drafts, stored)
  return body
}

export type PreviewResult = { ok: boolean, data?: unknown }

/**
 * ── FINDING T2, FIXED: A REQUEST-ORDERING GUARD ─────────────────────────
 *
 * The vanilla's `runTbCostPreview` awaits the POST and then assigns
 * `tbCostPreview = result.ok ? result.data : null` with NO sequence token. Two
 * overlapping requests resolve **last-to-arrive rather than last-to-be-sent**,
 * so a slow first response can overwrite a fast second and the screen prices
 * inputs nobody is looking at.
 *
 * The 400ms debounce makes overlap unlikely, not impossible: one response
 * slower than 400ms plus a second edit is enough.
 *
 * **This is Architecture 8's recorded instance on that very file** -
 * *"renderTbStageExitCriteria had no load-token guard, safe only because it ran
 * last, until the fetches were parallelised."* Same file, same shape, and the
 * migration does not carry it over.
 *
 * LATEST WINS, and a stale response is DROPPED rather than merged: a token is
 * taken before the request and compared after it, so a response that is not the
 * newest changes nothing at all.
 */
export function createPreviewRunner(
  post: (body: Record<string, string>) => Promise<PreviewResult>,
  onResult: (data: unknown | null) => void,
) {
  let issued = 0
  let latestApplied = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const run = async (drafts: Drafts, stored: Record<string, unknown>) => {
    // C5: back to the stored values means the stored breakdown is the truth.
    if (!costFieldsDirty(drafts, stored)) { onResult(null); return }
    const token = ++issued
    const result = await post(previewBody(drafts, stored))
    // THE GUARD. A response older than one already applied is discarded, and
    // so is one whose newer sibling is still outstanding.
    if (token <= latestApplied || token !== issued) return
    latestApplied = token
    // C6: on refusal, fall back to the STORED breakdown rather than leaving a
    // wrong number wearing the unsaved marker.
    onResult(result.ok ? (result.data ?? null) : null)
  }

  return {
    /** C2: debounced from the last keystroke. */
    schedule(drafts: Drafts, stored: Record<string, unknown>) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { void run(drafts, stored) }, PREVIEW_DEBOUNCE_MS)
    },
    /** Immediately, which is what a discard does. */
    runNow(drafts: Drafts, stored: Record<string, unknown>) { return run(drafts, stored) },
    cancel() { if (timer) { clearTimeout(timer); timer = null } },
    /** For tests: how many requests have been issued. */
    issuedCount() { return issued },
  }
}
