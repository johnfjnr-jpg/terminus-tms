-- R10, stage panels round: A TEST BED DOES NOT ADVANCE WITHOUT ITS APPROVERS
-- NAMED.
--
-- Ruled by John 2026-09-18 on the R8 measurement, which is recorded in
-- STAGE_PANELS_ROUND_REPORT.md section 2 and reproducible from
-- scripts/stage-panels/measure-r8.mjs. What that measurement established, and
-- each clause is why this file is the shape it is:
--
--   * the three approvers are PAYLOAD KEYS on the Test Bed record -
--     commercialAuthority, technicalAuthority, terminusLegalOwner - carrying a
--     staff NAME. So `payload_field_required` is the requirement type that
--     already asks this question, and no new type is invented.
--   * `terminus_staff` has no `user_id`, so there is no identity to check a
--     name against. This gate asks whether a name is RECORDED, which is all
--     the data can currently support, and the identity work is the proposed
--     next round (R12).
--   * every live Test Bed past Qualification already carries all three, so
--     NOTHING IS RETROSPECTIVELY BLOCKED by this file. Measured at 0 of 8.
--
-- ── WHAT GOES IN, AND IT IS DERIVED RATHER THAN LISTED ────────────────────
--
-- Two sets, and the second is John's backstop (a):
--
--   the RULING     Qualification -> Pre-Site Assessment, one rule per track,
--                  all three, so nothing leaves Qualification unnamed.
--   the BACKSTOP   wherever an `approval_obtained` rule already demands a
--                  track's decision, the same stage also demands that track's
--                  approver be named. A field emptied after Qualification is
--                  then caught at the next stage that needs that person,
--                  rather than never.
--
-- DERIVED FROM THE APPROVAL ROWS THEMSELVES rather than typed out, so the
-- correspondence cannot be got wrong at apply time: a typed list is a second
-- reader of the approval configuration (Verification 20). Measured against the
-- live configuration when this was written: 3 ruled plus 16 backstop, 19 rows,
-- and 0 rules of this shape already present.
--
-- The derivation is a snapshot taken AT APPLY TIME, not a live view. An
-- approval rule added later does not grow itself a field rule, and
-- scripts/tests/config-invariants.test.mjs asserts the correspondence so that
-- drift is a red test rather than a silence.
--
-- ── THE WORDING IS THE LABEL ──────────────────────────────────────────────
--
-- computeBlocking renders a labelled payload_field_required rule as
-- `Requires ${label}` (src/routes/transitions.js). So the label IS the ruled
-- sentence, "a Commercial approver to be named", and the row reads
-- "Requires a Commercial approver to be named" on the exit criteria panel and
-- in a refused transition, from one construction rather than two.
--
-- IDEMPOTENT, per Architecture 7 and regardless of what the ledger is expected
-- to guarantee: the insert is guarded by `where not exists` on a jsonb-to-jsonb
-- comparison, never via a ::text cast (Architecture 5).
--
-- SEEDS: checked, and Architecture 4 does not apply. supabase/seeds/003_test_bed.sql
-- carries no stage_gate_rules row; only 001_smoke_test.sql does, and it is a
-- different record_type. There is no seed to reconcile.
--
-- NO SELF-RECORDING LEDGER ROW (Architecture 10 as corrected 2026-09-08).
-- Applying through the SQL editor does not write the ledger, so record the
-- version as a SEPARATE statement after this succeeds.
--
-- THIS SESSION CANNOT PARSE-CHECK THIS FILE - PostgREST only, no psql and no
-- connection string (build discipline 14) - so the constructs are chosen to be
-- unable to carry the error: one insert whose FROM clause names only tables it
-- reads, no LATERAL, no CTE, and a correlated `not exists` that can reference
-- the target unambiguously.

begin;

-- THE BACKSTOP. One field rule per (stage, track) an approval rule already
-- names. `distinct` because a stage may carry the same track once per rule
-- shape, and a duplicated gate rule is invisible on screen while doubling a
-- requirement.
insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select distinct
  'test_bed',
  null,
  a.from_stage,
  a.to_stage,
  'payload_field_required',
  jsonb_build_object(
    'field', case a.requirement_detail->>'track'
               when 'Commercial' then 'commercialAuthority'
               when 'Technical'  then 'technicalAuthority'
               when 'Legal'      then 'terminusLegalOwner'
             end,
    'label', 'a ' || (a.requirement_detail->>'track') || ' approver to be named')
from public.stage_gate_rules a
where a.record_type       = 'test_bed'
  and a.requirement_type  = 'approval_obtained'
  and a.requirement_detail->>'track' in ('Commercial', 'Technical', 'Legal')
  and not exists (
    select 1 from public.stage_gate_rules x
     where x.record_type      = 'test_bed'
       and x.from_stage       = a.from_stage
       and x.to_stage         = a.to_stage
       and x.requirement_type = 'payload_field_required'
       and x.requirement_detail = jsonb_build_object(
             'field', case a.requirement_detail->>'track'
                        when 'Commercial' then 'commercialAuthority'
                        when 'Technical'  then 'technicalAuthority'
                        when 'Legal'      then 'terminusLegalOwner'
                      end,
             'label', 'a ' || (a.requirement_detail->>'track') || ' approver to be named')
  );

-- THE RULING. All three at Qualification, including Legal, which Qualification
-- does not demand a decision from and therefore the backstop does not reach.
-- The destination is read from stage_definitions rather than typed, so a
-- renamed or inserted stage cannot leave this pointing at nothing.
insert into public.stage_gate_rules
  (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select
  'test_bed',
  null,
  'Qualification',
  (select s.stage_name
     from public.stage_definitions s
    where s.record_type = 'test_bed'
      and s.sort_order > (select s2.sort_order
                            from public.stage_definitions s2
                           where s2.record_type = 'test_bed'
                             and s2.stage_name  = 'Qualification')
    order by s.sort_order
    limit 1),
  'payload_field_required',
  jsonb_build_object('field', t.field, 'label', 'a ' || t.track || ' approver to be named')
from (values
       ('Commercial', 'commercialAuthority'),
       ('Technical',  'technicalAuthority'),
       ('Legal',      'terminusLegalOwner')
     ) as t(track, field)
where not exists (
  select 1 from public.stage_gate_rules x
   where x.record_type      = 'test_bed'
     and x.from_stage       = 'Qualification'
     and x.requirement_type = 'payload_field_required'
     and x.requirement_detail = jsonb_build_object(
           'field', t.field, 'label', 'a ' || t.track || ' approver to be named')
);

-- SELF-CHECK, BOTH DIRECTIONS AND NAMED RATHER THAN COUNTED.
--
-- A count is satisfied by the right number of wrong rows (Verification 33), so
-- the three Qualification rules are asserted BY NAME, and the correspondence
-- with the approval rules is asserted as a SET DIFFERENCE in both directions -
-- an approval with no field rule, and a field rule with no approval. An
-- assertion that a set is empty proves nothing about whether empty is
-- survivable (Verification 20's migration clause), so the total is asserted
-- too, against a number derived here rather than typed.
do $$
declare
  missing        int;
  orphaned       int;
  qual_rules     int;
  approval_pairs int;
  field_rules    int;
begin
  select count(*) into qual_rules
    from public.stage_gate_rules
   where record_type      = 'test_bed'
     and from_stage       = 'Qualification'
     and requirement_type = 'payload_field_required'
     and requirement_detail in (
       '{"field":"commercialAuthority","label":"a Commercial approver to be named"}'::jsonb,
       '{"field":"technicalAuthority","label":"a Technical approver to be named"}'::jsonb,
       '{"field":"terminusLegalOwner","label":"a Legal approver to be named"}'::jsonb);
  if qual_rules <> 3 then
    raise exception 'approvers named: expected 3 Qualification approver rules, found %', qual_rules;
  end if;

  -- An approval rule with no matching field rule: the backstop did not reach.
  select count(*) into missing
    from public.stage_gate_rules a
   where a.record_type      = 'test_bed'
     and a.requirement_type = 'approval_obtained'
     and not exists (
       select 1 from public.stage_gate_rules x
        where x.record_type      = 'test_bed'
          and x.from_stage       = a.from_stage
          and x.to_stage         = a.to_stage
          and x.requirement_type = 'payload_field_required'
          and x.requirement_detail->>'label' =
              'a ' || (a.requirement_detail->>'track') || ' approver to be named');
  if missing <> 0 then
    raise exception 'approvers named: % approval rule(s) have no approver-named rule beside them', missing;
  end if;

  -- And the other direction: an approver-named rule at a stage that demands no
  -- such decision. Qualification's Legal rule is the ONE legitimate case, so it
  -- is excluded by name rather than by loosening the check.
  select count(*) into orphaned
    from public.stage_gate_rules x
   where x.record_type      = 'test_bed'
     and x.requirement_type = 'payload_field_required'
     and x.requirement_detail->>'label' like 'a % approver to be named'
     and not (x.from_stage = 'Qualification'
              and x.requirement_detail->>'field' = 'terminusLegalOwner')
     and not exists (
       select 1 from public.stage_gate_rules a
        where a.record_type      = 'test_bed'
          and a.requirement_type = 'approval_obtained'
          and a.from_stage       = x.from_stage
          and a.to_stage         = x.to_stage
          and 'a ' || (a.requirement_detail->>'track') || ' approver to be named'
              = x.requirement_detail->>'label');
  if orphaned <> 0 then
    raise exception 'approvers named: % approver-named rule(s) sit at a stage that demands no such decision', orphaned;
  end if;

  -- The total, derived: every approval pair, plus the one Qualification Legal
  -- rule the backstop cannot produce.
  select count(distinct (from_stage, to_stage, requirement_detail->>'track')) into approval_pairs
    from public.stage_gate_rules
   where record_type = 'test_bed' and requirement_type = 'approval_obtained';

  select count(*) into field_rules
    from public.stage_gate_rules
   where record_type      = 'test_bed'
     and requirement_type = 'payload_field_required'
     and requirement_detail->>'label' like 'a % approver to be named';

  if field_rules <> approval_pairs + 1 then
    raise exception 'approvers named: % approver-named rules against % approval pairs plus the Qualification Legal rule', field_rules, approval_pairs;
  end if;
end $$;

commit;
