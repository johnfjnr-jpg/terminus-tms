-- ── THE ACCOUNT LINK COMES OUT OF THE QUALIFY GATE ───────────────────────
--
-- R1 of the LEADS CARD round, 2026-09-12. This SUPERSEDES the LEADS round's
-- P1 precondition, and the superseded reasoning is left visible rather than
-- deleted, per Verification 29: a premise changed, so the decision is
-- RE-TAKEN.
--
-- SUPERSEDED: Qualify required `parent_record_id`, so a lead could not be
-- qualified until somebody had already linked it to an Account on the Lead
-- Detail page. That was correct while Qualify was a status change.
--
-- NOW: Qualify IS the conversion. Pressing it opens the account step, and
-- resolving that step calls qualify_contact, which creates or links the
-- Account and flips the status in one transaction. Requiring the link
-- BEFOREHAND would make the conversion impossible to reach.
--
-- ── EXACTLY ONE ROW MOVES ────────────────────────────────────────────────
--
-- Measured live before writing: the Unqualified -> Qualified gate carries 15
-- payload_field_required rules, and parent_record_id is one of them. Removing
-- it leaves 14, which are exactly R1's three groups:
--
--   Contact Details 8  name, company, jobRole, email, mobile, industry_id,
--                      source, linkedin
--   Address Details 5  address, city, postcode, country, region
--   Summary         1  summary
--
-- Nothing is added and nothing else is removed.
--
-- Idempotent by construction: a delete of a row that is already gone is a
-- no-op, so a replay cannot do harm. Architecture 7.
--
-- NO SELF-RECORDING LEDGER ROW, per Architecture 10 as corrected.

delete from public.stage_gate_rules
 where record_type = 'contact'
   and from_stage = 'Unqualified'
   and to_stage = 'Qualified'
   and requirement_detail = '{"field":"parent_record_id"}'::jsonb;
-- jsonb compared to jsonb, never through a ::text cast. Architecture 5: that
-- fault once duplicated rows on every seed run.

-- ── SELF-CHECK ───────────────────────────────────────────────────────────
--
-- Verification 20's clause: a migration asserting a derived value names every
-- reader of it and says what the asserted value tells each one.
--
-- The readers of these rows are computeBlocking (which builds the blocking
-- list the transition route refuses on, and which the exit-criteria panel
-- renders) and nothing else. An assertion that the count is 14 tells
-- computeBlocking that a lead with those 14 fields present may move, and tells
-- the panel to stop listing "Account" as an outstanding criterion.
--
-- It asserts BOTH directions, because "14 remain" alone would also be
-- satisfied by removing the wrong row.
do $$
declare
  v_total   integer;
  v_account integer;
begin
  select count(*) into v_total
    from public.stage_gate_rules
   where record_type = 'contact'
     and from_stage = 'Unqualified'
     and to_stage = 'Qualified'
     and requirement_type = 'payload_field_required';

  select count(*) into v_account
    from public.stage_gate_rules
   where record_type = 'contact'
     and from_stage = 'Unqualified'
     and to_stage = 'Qualified'
     and requirement_detail = '{"field":"parent_record_id"}'::jsonb;

  if v_account <> 0 then
    raise exception 'qualify gate still requires parent_record_id (% rows)', v_account;
  end if;
  if v_total <> 14 then
    raise exception 'qualify gate should carry 14 payload_field_required rules, found %', v_total;
  end if;
end $$;
