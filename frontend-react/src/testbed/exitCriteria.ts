// ── B: THE EXIT-CRITERION TICK ──────────────────────────────────────────
//
// B1: a tick writes an ISO TIMESTAMP and an untick writes null. NEVER a
// boolean.
//
// B2, and it is why the rule exists rather than a style: the gate's
// `payload_field_required` blocks only on `undefined`, `null` and `''`, so a
// stored `false` reads as PRESENT and OPENS THE GATE. Storing a timestamp on
// tick and clearing the key on untick makes "present and non-empty"
// structurally equivalent to "ticked", rather than dependent on a truthiness
// detail in a branch that knows nothing about criteria.
export function exitTickPayload(
  field: string, currentlyMet: boolean, at: string,
): Record<string, string | null> {
  return { [field]: currentlyMet ? null : at }
}

// ── `isTicked` IS REMOVED, Round A Phase 1 ──────────────────────────────
//
// It read a PAYLOAD value and decided met-ness on the client, which is a second
// reader of the gate (Verification 43) and exactly what brief item 1.2 rules
// out: the panel's met state now comes from the server's own `met` on each
// requirement. With its one caller gone, a helper nothing calls is a claim with
// no reader, so it goes rather than staying beside the real source.

// ── THE ROUTE'S RESPONSE, TYPED FROM WHAT IT SENDS ──────────────────────
//
// GET /api/records/:id/exit-criteria answers an OBJECT (records.js), and the
// panel cast it to an array for months, which is audit finding B3. These types
// are written from the captured responses in
// `__tests__/fixtures/exit-criteria-live.json`, not from what a reader wants.
export interface ExitRequirement {
  requirement_type: string
  met: boolean
  message?: string
  label?: string
  field?: string
  min_length?: number
  role?: string
  document?: string
  track?: string
}

export interface ExitCriteriaResponse {
  from_stage: string
  to_stage: string | null
  blocking: readonly unknown[]
  requirements: readonly ExitRequirement[]
}

/**
 * The shape guard at the one point untyped data enters. Anything that is not
 * the route's object is `null`, which the panel renders as a failed load
 * rather than as "no criteria": an unreadable answer is not an empty one.
 */
export function readExitCriteria(data: unknown): ExitCriteriaResponse | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const d = data as Record<string, unknown>
  if (!Array.isArray(d.requirements)) return null
  if (!(typeof d.to_stage === 'string' || d.to_stage === null)) return null
  return d as unknown as ExitCriteriaResponse
}

/**
 * THE FOUR KEYS A TICK MAY WRITE, mirroring TB_EXIT_CRITERION_KEYS in
 * src/routes/test-beds.js, which is also the server's PATCH allowlist for
 * them. A copy is unavoidable (the bundle cannot import a route module), so it
 * is PROVEN equal to the server's set by `testbed-exit-criteria.test.tsx`,
 * which parses the route file, rather than asserted equal by this comment.
 */
export const TB_EXIT_CRITERION_KEYS: ReadonlySet<string> = new Set([
  'exitQualTechnicalCommercialValue',
  'exitQualPhysicalSuitability',
  'exitQualPartnerCommitment',
  'exitMonAllMeetingActionsCompleted',
])

/**
 * 1.3, THE SAFETY HALF: TICKABLE REQUIRES ALL THREE.
 *
 * A label alone must never make a row tickable. `label` is display-only and
 * any payload_field_required rule may carry one - live, `installer_account_id`
 * does, labelled "Installer" - and a tick box there would write an ISO
 * timestamp into a field that is not a tick. Key-set membership is what makes
 * the control safe; the label is only what makes it readable.
 */
export function isTickable(r: ExitRequirement): boolean {
  return r.requirement_type === 'payload_field_required'
    && typeof r.field === 'string' && TB_EXIT_CRITERION_KEYS.has(r.field)
    && !!r.label
}

/**
 * 1.4, the process-vs-data-entry split, ported with its caveat.
 *
 * The business's reasoning, from the vanilla: a tick confirms a STEP WAS
 * PERFORMED, which stays visible in a process being reinforced; a date being
 * filled in is a field, and shows only while it is unmet.
 *
 * CAVEAT, carried rather than resolved: `min_length` means "this field holds a
 * series", which is not the same concept as "this is a process step". It is
 * exact today only because the scored requirements are the only series-valued
 * ones. A future data-entry series would be misclassified and nothing flags it.
 */
export function isProcessRequirement(r: ExitRequirement): boolean {
  if (r.requirement_type === 'document_status') return true
  if (r.requirement_type === 'approval_obtained') return true
  if (r.requirement_type === 'contact_role_linked') return false
  if (r.requirement_type === 'payload_field_required') {
    return r.min_length !== undefined
      || (typeof r.field === 'string' && TB_EXIT_CRITERION_KEYS.has(r.field))
  }
  // An unrecognised type stays visible: a gate blocking with nothing on screen
  // saying why is the failure worth avoiding.
  return true
}

/**
 * 1.5, ONE TICK ATTEMPT, as a function so its guards can be tested and
 * calibrated rather than read (Verification 9: a guard never seen failing is
 * decoration).
 *
 * THE DOOR IS ASKED AT EVERY ATTEMPT, as the field rows ask it, so a keyboard
 * press or a direct call on somebody else's record is refused as surely as a
 * mouse click the door's stylesheet already stops. Refused with `error: null`,
 * which the panel reads as nothing to say.
 *
 * Tick writes an ISO timestamp and untick writes null, never a boolean (the
 * gate reads a stored `false` as PRESENT). The stage is refreshed after any
 * write attempt, so the server's `met` is what the panel shows next.
 */
export async function attemptTick(
  deps: {
    canEdit: () => boolean
    write: (payload: Record<string, string | null>) => Promise<{ ok: boolean, error: string | null }>
    refresh: () => void
    now: () => string
  },
  field: string, currentlyMet: boolean,
): Promise<{ ok: boolean, error: string | null }> {
  if (!deps.canEdit()) return { ok: false, error: null }
  const r = await deps.write(exitTickPayload(field, currentlyMet, deps.now()))
  deps.refresh()
  return r
}

/** The rows a person sees: every process requirement, and data entry while unmet. */
export function visibleRequirements(reqs: readonly ExitRequirement[]): ExitRequirement[] {
  return reqs.filter((r) => isProcessRequirement(r) || !r.met)
}

/**
 * 1.1, the summary line. COUNTED OVER ALL REQUIREMENTS, never the visible
 * subset: it describes the GATE, not the list. Every hidden row is a met one,
 * so the outstanding figure is unchanged by the split and the denominator stays
 * the true number the transition is checked against.
 */
export function exitSummary(res: ExitCriteriaResponse): string | null {
  if (res.to_stage === null || !res.requirements.length) return null
  const outstanding = res.requirements.filter((r) => !r.met).length
  return outstanding === 0
    ? `All criteria met - ready to move to ${res.to_stage}.`
    : `${outstanding} of ${res.requirements.length} outstanding to move to ${res.to_stage}:`
}
