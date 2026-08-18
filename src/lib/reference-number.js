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

/**
 * Account Number generator (Round 4 Phase 2, 2026-08-17).
 *
 * ROUND4_BUILD_BRIEF.md Phase 2. Format TT-{country code}-{name prefix}-
 * {number}, e.g. TT-GBR-WILLOWGLEN-001 - structurally the same shape as
 * the reference code above, deliberately: it reuses the exact same
 * atomic-counter/boundary-safety core (issue_reference_number, unchanged
 * by this addition), just keyed by a sanitised company-name prefix
 * instead of an industry code, and namespaced internally
 * (20260817000000_reference_number_scheme_namespace.sql's p_scheme
 * parameter) so this counter can never share or collide with the
 * industry-code keyspace even if a sanitised name happens to exactly
 * match a real industry short_code - confirmed a real, not just
 * theoretical, risk during Phase 1's investigation (a company named
 * "Smartc Co" sanitises to the same 6 characters as the live SMARTC
 * industry code).
 *
 * Sanitisation rule, confirmed against the brief's own worked examples:
 * strip everything except letters and digits (spaces, punctuation, all
 * of it), uppercase, take the first 10 characters of what's left.
 *   "Willowglen Pte Ltd" -> "WILLOWGLEN"
 *   "AT&T"                -> "ATT"
 *   "O'Brien's Ltd"        -> "OBRIENSLTD"
 */
export function sanitizeAccountNamePrefix(name) {
  return (name ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10)
}

/**
 * Atomically issues the next Account Number for a country+name-prefix.
 * Same atomicity guarantee as issueReferenceNumber above, same
 * underlying database function, just the 'account' scheme.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} countryCode - 3-letter country code, e.g. "GBR"
 * @param {string} accountName - the Account's own name, sanitised here,
 *   not by the caller - callers pass the real, as-typed name.
 * @returns {Promise<string>} e.g. "TT-GBR-WILLOWGLEN-001"
 * @throws if countryCode is missing, the sanitised name prefix is empty
 *   (e.g. a name with no letters or digits at all), or the RPC call fails
 */
export async function issueAccountNumber(db, countryCode, accountName) {
  if (!countryCode) throw new Error('issueAccountNumber: countryCode is required')
  const namePrefix = sanitizeAccountNamePrefix(accountName)
  if (!namePrefix) throw new Error('issueAccountNumber: accountName produced an empty name prefix after sanitisation')

  const { data, error } = await db.rpc('issue_reference_number', {
    p_country_code: countryCode,
    p_industry_code: namePrefix,
    p_scheme: 'account',
  })

  if (error) throw new Error(`issueAccountNumber failed: ${error.message}`)
  return data
}
