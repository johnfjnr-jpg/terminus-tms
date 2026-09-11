-- R5, Leads round: COMPANY IS PART OF "CONTACT DETAILS COMPLETE".
--
-- Ruled by John 2026-09-11 on P1's finding. Measured live before this was
-- written: clearing `company` and asking for Qualified returned 200 and the
-- lead qualified. The ruled model says Contact Details must be complete and
-- the screen's Contact Details card carries `company`, so the gate was short
-- of the model by one field.
--
-- ONE ROW ADDED. The existing 14 rules are untouched: this is not a rewrite of
-- the gate, and it deliberately does NOT use the delete-then-insert shape of
-- 20260812000005, which would drop and recreate all 14 and lose anything a
-- later migration had added.
--
-- ── A MAPPING WORTH KNOWING, AND IT IS NOT A CONFLICT ──────────────────────
--
-- 20260812000005's own header records that it sourced the prototype's qualify
-- list and mapped two of its names onto real columns:
--
--     "company/industry are still the real columns
--      (parent_record_id/industry_id)"
--
-- So the gate ALREADY carries a requirement the original author recorded as
-- "company": `parent_record_id`, the linked Account. After this migration the
-- gate requires BOTH - the Account link AND the free-text Company field on the
-- Contact Details card. They are different facts about a lead: one says which
-- Account this person belongs to, the other is what they typed. Requiring both
-- is what the ruling asks for, and this comment exists so a later reader finds
-- the mapping rather than reading `company` and `parent_record_id` as a
-- duplicate (Verification 23: the earlier decision is findable).
--
-- IDEMPOTENT, per Architecture 7 and regardless of what the ledger is expected
-- to guarantee. The ledger has been observed drifting from the schema, and an
-- unguarded INSERT replayed would duplicate the rule - and a duplicated gate
-- rule is invisible in the UI while doubling a requirement.
--
-- SEEDS: checked, and Architecture 4 does not apply. No file in supabase/seeds
-- carries a `contact` stage_gate_rules row; these came from a migration, not a
-- seed, so there is no seed to reconcile.
--
-- NO SELF-RECORDING LEDGER ROW (Architecture 10 as corrected 2026-09-08).
-- Applying through the SQL editor does not write the ledger, so record the
-- version as a SEPARATE statement after this succeeds.
--
-- THIS SESSION CANNOT PARSE-CHECK THIS FILE - PostgREST only, no psql and no
-- connection string - so the construct is chosen to be unable to carry the
-- error: one guarded INSERT, no FROM clause, no CTE, nothing to scope wrongly.

begin;

insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'contact', null, 'Unqualified', 'Qualified', 'payload_field_required', '{"field":"company"}'::jsonb
 where not exists (
   select 1 from public.stage_gate_rules
    where record_type      = 'contact'
      and from_stage       = 'Unqualified'
      and to_stage         = 'Qualified'
      and requirement_type = 'payload_field_required'
      -- jsonb compared to jsonb, NEVER via a ::text cast. Architecture 5: that
      -- fault once duplicated rows on every seed run, because key order in a
      -- text rendering is not stable.
      and requirement_detail = '{"field":"company"}'::jsonb
 );

-- SELF-CHECK, both directions. An assertion that a row EXISTS is satisfied by a
-- row that was always there, so the count is asserted too: exactly one company
-- rule, and the gate grown from 14 to 15 rather than rewritten.
do $$
declare
  company_rules int;
  total_rules   int;
begin
  select count(*) into company_rules
    from public.stage_gate_rules
   where record_type      = 'contact'
     and from_stage       = 'Unqualified'
     and to_stage         = 'Qualified'
     and requirement_type = 'payload_field_required'
     and requirement_detail = '{"field":"company"}'::jsonb;

  if company_rules <> 1 then
    raise exception 'qualify company gate: expected exactly 1 company rule, found %', company_rules;
  end if;

  select count(*) into total_rules
    from public.stage_gate_rules
   where record_type = 'contact' and from_stage = 'Unqualified' and to_stage = 'Qualified';

  if total_rules <> 15 then
    raise exception 'qualify company gate: expected 15 rules on Unqualified->Qualified, found % - the gate was rewritten rather than extended', total_rules;
  end if;

  -- And the neighbours are untouched. Named individually rather than counted,
  -- because a count of 15 is also satisfied by 15 wrong rows.
  if not exists (select 1 from public.stage_gate_rules
                  where record_type = 'contact' and to_stage = 'Qualified'
                    and requirement_detail = '{"field":"summary"}'::jsonb)
     or not exists (select 1 from public.stage_gate_rules
                  where record_type = 'contact' and to_stage = 'Qualified'
                    and requirement_detail = '{"field":"parent_record_id"}'::jsonb) then
    raise exception 'qualify company gate: an existing rule went missing';
  end if;
end $$;

commit;
