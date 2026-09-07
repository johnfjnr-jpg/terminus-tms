// ── X: CONVERT A TEST BED TO AN OPPORTUNITY ─────────────────────────────
//
// Round 7 Phase 2d session 3. THE ESTATE'S FIRST CROSS-RECORD WRITE from a
// migrated surface, so the enumeration measured the server side too.
//
// WHAT THE ROUTE DOES, in short: it reads the Test Bed's latest revision, the
// conversion criteria and the stage probability default, then creates THREE
// rows - a records row, a revision at number 1, and an opportunity_details row
// carrying `converted_from_test_bed_id`. Two fields are genuine RENAMES rather
// than copies: `client_organisation` becomes `company_name`, and `initialLead`
// becomes `customerLead`.
//
// NOTHING IS WRITTEN BACK TO THE TEST BED. The only trace on the source is an
// audit row; the link lives on the target, which is also what the
// max-conversions check reads.
//
// AND THERE IS NO TRANSACTION, which is recorded as a finding rather than fixed
// here: a failure after the first insert leaves an Opportunity with no
// revision, or one with no details row - and with no details row there is no
// `converted_from_test_bed_id`, so the max-conversions check cannot see the
// conversion and a SECOND one is permitted.
export const CONVERT_ROUTE = (id: string) => `/api/test-beds/${id}/convert`

export type ConvertBody =
  | { ok: true, body: { opportunity_name: string } }
  | { ok: false, error: string }

/** X1: refused before any request is made. */
export function convertBody(name: string): ConvertBody {
  const n = String(name ?? '').trim()
  if (!n) return { ok: false, error: 'Opportunity name is required.' }
  return { ok: true, body: { opportunity_name: n } }
}

export interface ConvertFeedback {
  text: string
  kind: 'ok' | 'err'
  /** X3: success OFFERS navigation rather than performing it. */
  opportunityId: string | null
}

export function convertFeedback(
  ok: boolean, data: { id?: string } | null, error: string | null,
): ConvertFeedback {
  if (!ok) {
    // The server's own sentence, because "This Test Bed has already been
    // converted to an Opportunity" is the refusal a user most needs to read
    // and a generic message would hide it.
    return { text: error ?? 'Conversion failed.', kind: 'err', opportunityId: null }
  }
  return {
    text: 'Opportunity created.',
    kind: 'ok',
    opportunityId: data?.id ?? null,
  }
}
