-- Terminus TMS: generalise issue_reference_number() with a scheme
-- discriminator, for the new Account Number generator (Round 4 Phase 2)
--
-- ROUND4_BUILD_BRIEF.md Phase 2 / DESIGN_PRINCIPLES.md Section 9. The
-- Account Number format (TT-{country}-{name prefix}-{counter}) is
-- structurally identical in shape to the existing TT-{country}-{industry}-
-- {counter} reference code - both are TT- + country + a second segment +
-- a zero-padded/grown counter. reference_number_counters is already fully
-- generic (prefix text primary key, current_value integer) with zero
-- semantic awareness of what "prefix" represents, and the atomic
-- INSERT...ON CONFLICT...RETURNING plus the lpad boundary-safety logic
-- (20260814000001) are unchanged by this migration, not rewritten -
-- confirmed reusable as-is per Round 4 Phase 1's own investigation.
--
-- The one real risk investigated and confirmed before building: without a
-- discriminator, Account Numbers and Opportunity/Test Bed reference codes
-- would share one flat counter keyspace. A company whose sanitised name
-- prefix happens to exactly match a real, live industry short_code (e.g.
-- "Smartc Co" -> SMARTC, the real Smart Cities industry code) would then
-- draw from and advance the *same* counter sequence as that country's
-- real Smart-City Opportunities/Test Beds - not just a visual coincidence,
-- a genuinely shared, interleaved sequence. p_scheme fixes this by folding
-- a namespace into the counter table's own key only, never into the
-- returned string.
--
-- Backward compatibility is the load-bearing constraint here, not an
-- afterthought: every already-issued reference code (TT-GBR-AIRPRT-001
-- and the rest) has its counter stored under the exact unprefixed key
-- ('GBR-AIRPRT') every call before this migration used. If p_scheme's
-- default resolved to a *different* key than that, the counter for every
-- already-active country+industry combination would silently look like a
-- brand new, never-used prefix and restart at 1 - re-issuing an
-- already-claimed code on the very next real Opportunity/Test Bed
-- creation, exactly the "never reused" rule (Section 9) being violated
-- for real, live data, not a hypothetical. p_scheme defaulting to NULL,
-- and NULL/'industry' both resolving to the identical unprefixed key the
-- original function always used, is what prevents that - only a
-- genuinely new scheme value (e.g. 'account') gets a distinct, namespaced
-- key.
create or replace function public.issue_reference_number(
  p_country_code text,
  p_industry_code text,
  p_scheme text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key_prefix text;
  v_next   integer;
  v_number text;
begin
  if p_country_code is null or p_country_code = '' then
    raise exception 'issue_reference_number: p_country_code is required';
  end if;
  if p_industry_code is null or p_industry_code = '' then
    raise exception 'issue_reference_number: p_industry_code is required';
  end if;

  if p_scheme is null or p_scheme = 'industry' then
    -- Original, unnamespaced key - byte-identical to every call before
    -- this migration, so real, already-issued counters keep resolving to
    -- the same row and keep counting up from wherever they actually are,
    -- not from 1.
    v_key_prefix := p_country_code || '-' || p_industry_code;
  else
    -- Genuinely new scheme (e.g. 'account', Round 4's Account Number
    -- generator) - namespaced with a literal scheme prefix no legacy key
    -- could ever contain, so it structurally cannot collide with the
    -- industry-code keyspace regardless of what string the caller passes
    -- as p_industry_code (here, actually a sanitised name prefix - see
    -- src/lib/reference-number.js's issueAccountNumber, which is the only
    -- real caller of this branch).
    v_key_prefix := p_scheme || ':' || p_country_code || '-' || p_industry_code;
  end if;

  insert into public.reference_number_counters (prefix, current_value)
  values (v_key_prefix, 1)
  on conflict (prefix) do update
    set current_value = reference_number_counters.current_value + 1,
        updated_at = now()
  returning current_value into v_next;

  v_number := case when v_next < 1000 then lpad(v_next::text, 3, '0') else v_next::text end;

  -- Visible output never carries the scheme discriminator - both schemes
  -- render as plain TT-{country}-{segment}-{number}, the discriminator is
  -- purely an internal counter-key concern.
  return 'TT-' || p_country_code || '-' || p_industry_code || '-' || v_number;
end;
$$;

comment on function public.issue_reference_number(text, text, text) is
  'Atomically issues the next TT-{country}-{segment}-{number} reference '
  'for the given country+segment, optionally namespaced by p_scheme so '
  'unrelated numbering schemes (industry reference codes vs. Account '
  'Numbers) never share a counter sequence even if their segment strings '
  'coincide. p_scheme is internal only, never part of the returned '
  'string. NULL/''industry'' (the default) reproduces the exact '
  'unprefixed key every caller used before this migration - required for '
  'continuity with already-issued reference codes, not a stylistic '
  'choice. Explicit call only, never fired implicitly by a records '
  'insert - a Test Bed to Opportunity conversion must not call this, it '
  'carries the source record''s existing reference over unchanged '
  'instead.';

grant execute on function public.issue_reference_number(text, text, text) to authenticated;
