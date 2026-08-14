/**
 * Terminus reference number generator.
 *
 * DESIGN_PRINCIPLES.md Section 9 / PROTOTYPE_SPECIFICATION.md Section 2b /
 * TESTBED_BUILD_BRIEF.md Milestone 1. Format is
 * TT-{country code}-{industry code}-{number}, e.g. TT-GBR-SMARTC-001, one
 * counter per country+industry prefix shared by Test Bed and Opportunity
 * records, never reused even after a record is deleted.
 *
 * The actual atomic increment lives in the database as the
 * issue_reference_number(country_code, industry_code) Postgres function
 * (see supabase/migrations/20260814000000_reference_number_counter.sql) -
 * an INSERT ... ON CONFLICT DO UPDATE ... RETURNING against a highwater
 * table, which Postgres serializes at the row level. This module is a
 * thin wrapper around that RPC call, not a second implementation of the
 * counter logic - the atomicity guarantee lives in exactly one place.
 *
 * issueReferenceNumber() is a distinct, explicit call, not something a
 * record insert triggers automatically. Nothing in this file, or in the
 * migration, wires it to fire on every records insert - a future Test
 * Bed to Opportunity conversion needs to create its new record without
 * drawing a fresh number (it inherits the source Test Bed's existing
 * reference unchanged instead), so the decision to call this has to stay
 * with the caller, not be baked into record creation itself.
 */

/**
 * Atomically issues the next reference number for a country+industry
 * prefix. Two concurrent calls for the same prefix are guaranteed to
 * receive different, sequential numbers - the guarantee is enforced by
 * the database function's row-level UPSERT, not by anything in this
 * function itself.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} db - a
 *   request-scoped client (createUserClient(request.jwt)), same pattern
 *   every route handler already uses - this function does not create
 *   its own client or assume service-role access.
 * @param {string} countryCode - 3-letter country code, e.g. "GBR"
 * @param {string} industryCode - 6-character industry short code, e.g.
 *   "SMARTC" (industries.short_code)
 * @returns {Promise<string>} the full reference, e.g. "TT-GBR-SMARTC-001"
 * @throws if countryCode/industryCode are missing, or the RPC call fails
 */
export async function issueReferenceNumber(db, countryCode, industryCode) {
  if (!countryCode) throw new Error('issueReferenceNumber: countryCode is required')
  if (!industryCode) throw new Error('issueReferenceNumber: industryCode is required')

  const { data, error } = await db.rpc('issue_reference_number', {
    p_country_code: countryCode,
    p_industry_code: industryCode,
  })

  if (error) throw new Error(`issueReferenceNumber failed: ${error.message}`)
  return data
}
