-- Terminus TMS: fix reference number truncation at the 999 -> 1000 boundary
--
-- Real bug, found by explicit boundary testing requested during Milestone
-- 1 sign-off (not covered by the earlier 1-25 concurrency test): Postgres's
-- lpad(string, length, fill) does not just pad short strings, it also
-- TRUNCATES strings already longer than the target length, keeping only
-- the leftmost `length` characters. lpad('1000', 3, '0') therefore
-- returned '100', not '1000' - the previous issue_reference_number()
-- (20260814000000_reference_number_counter.sql) silently truncated every
-- reference number from 1000 upward, directly violating
-- DESIGN_PRINCIPLES.md Section 9's explicit rule: "grows past 999 by
-- adding digits rather than wrapping or resetting."
--
-- Fix: only pad when the number is genuinely short (< 1000); once it's
-- 1000 or above it's already at least 4 digits and must be used as-is,
-- with no lpad call at all - the case that made the earlier version
-- silently corrupt the number's length is now never reached.
create or replace function public.issue_reference_number(p_country_code text, p_industry_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := p_country_code || '-' || p_industry_code;
  v_next   integer;
  v_number text;
begin
  if p_country_code is null or p_country_code = '' then
    raise exception 'issue_reference_number: p_country_code is required';
  end if;
  if p_industry_code is null or p_industry_code = '' then
    raise exception 'issue_reference_number: p_industry_code is required';
  end if;

  insert into public.reference_number_counters (prefix, current_value)
  values (v_prefix, 1)
  on conflict (prefix) do update
    set current_value = reference_number_counters.current_value + 1,
        updated_at = now()
  returning current_value into v_next;

  v_number := case when v_next < 1000 then lpad(v_next::text, 3, '0') else v_next::text end;

  return 'TT-' || v_prefix || '-' || v_number;
end;
$$;

comment on function public.issue_reference_number(text, text) is
  'Atomically issues the next TT-{country}-{industry}-{number} reference '
  'for the given country+industry prefix. Explicit call only, never fired '
  'implicitly by a records insert - a future Test Bed to Opportunity '
  'conversion must not call this, it carries the source record''s existing '
  'reference over unchanged instead. Numbers under 1000 are zero-padded to '
  '3 digits; 1000 and above are used as-is (lpad truncates rather than '
  'only padding, so it must not be applied once the number is already '
  'longer than the pad width - see 20260814000001).';
