-- R1, Leads round: NURTURE IS A RELABEL OF `Parked`.
--
-- Ruled by John 2026-09-11. The action is identical: this changes a LABEL, not
-- a behaviour. No gate, no rule and no code path changes meaning, and the
-- superseded name is left visible in DESIGN_PRINCIPLES.md rather than rewritten
-- so a reader can see a relabel rather than find two documents disagreeing.
--
-- MEASURED SURFACE before writing this, exact counts:
--     stage_definitions named 'Parked'          1   (record_type 'contact' only)
--     stage_gate_rules with to_stage 'Parked'   1   (payload_field_required followUpDate)
--     stage_gate_rules with from_stage 'Parked' 0
--     records with status 'Parked', live        0
--     records with status 'Parked', incl deleted 6
--     stage_probability_defaults for 'Parked'   0
--
-- NO SELF-RECORDING LEDGER ROW. Architecture 10 as corrected 2026-09-08: a
-- migration must not insert its own supabase_migrations row, because the CLI
-- writes that row itself in the same transaction with no conflict clause and
-- collides at 23505. If this is applied BY HAND through the dashboard, record
-- the version as a SEPARATE statement afterwards.
--
-- THIS SESSION CANNOT PARSE-CHECK THIS FILE. It reaches Postgres only through
-- PostgREST - no psql, no pg module, no connection string - so per CLAUDE.md
-- rule 14 the constructs below are chosen to be unable to carry the error
-- rather than merely legal if typed right: plain UPDATEs with correlated
-- predicates, no FROM clause, no LATERAL, nothing that can scope wrongly.

begin;

-- Order matters only for readability; every statement is idempotent and none
-- depends on another's result.

-- 1. The stage itself.
update public.stage_definitions
   set stage_name = 'Nurture'
 where record_type = 'contact'
   and stage_name  = 'Parked';

-- 2. The gate rule that points at it. from_stage is swept too, though it
--    matches nothing today: a rule written later must not be missed by a
--    migration that only looked where rows happened to be.
update public.stage_gate_rules
   set to_stage = 'Nurture'
 where record_type = 'contact'
   and to_stage    = 'Parked';

update public.stage_gate_rules
   set from_stage = 'Nurture'
 where record_type = 'contact'
   and from_stage  = 'Parked';

-- 3. The records themselves, INCLUDING soft-deleted ones. Six exist and all
--    six are deleted. They are updated anyway, because a status value that no
--    longer appears in stage_definitions is an orphan, and a restored record
--    carrying one could not transition anywhere.
update public.records
   set status = 'Nurture'
 where record_type = 'contact'
   and status      = 'Parked';

-- 4. Probability defaults, if any are ever added for this stage. Matches zero
--    rows today and is here so the relabel is complete rather than sufficient.
update public.stage_probability_defaults
   set stage = 'Nurture'
 where record_type = 'contact'
   and stage       = 'Parked';

-- SELF-CHECK. Verification 20's clause: a migration asserting a derived value
-- names every reader of it. The readers of stage_name here are transitions.js
-- (the gate loop), the client's stage list, and records.status itself - so the
-- assertion is that NO reader can still see 'Parked' for a contact, rather than
-- that some count is now 1.
do $$
declare
  leftovers int;
begin
  select (select count(*) from public.stage_definitions
            where record_type = 'contact' and stage_name = 'Parked')
       + (select count(*) from public.stage_gate_rules
            where record_type = 'contact' and (to_stage = 'Parked' or from_stage = 'Parked'))
       + (select count(*) from public.records
            where record_type = 'contact' and status = 'Parked')
       + (select count(*) from public.stage_probability_defaults
            where record_type = 'contact' and stage = 'Parked')
    into leftovers;

  if leftovers <> 0 then
    raise exception 'contact nurture relabel: % rows still name Parked', leftovers;
  end if;

  -- And the positive half, because an assertion that something is ABSENT is
  -- satisfied by the thing never having existed (Verification 14's clause).
  if not exists (select 1 from public.stage_definitions
                  where record_type = 'contact' and stage_name = 'Nurture') then
    raise exception 'contact nurture relabel: no Nurture stage exists after the relabel';
  end if;

  if not exists (select 1 from public.stage_gate_rules
                  where record_type = 'contact' and to_stage = 'Nurture'
                    and requirement_type = 'payload_field_required'
                    and requirement_detail->>'field' = 'followUpDate') then
    raise exception 'contact nurture relabel: the followUpDate gate did not follow the relabel';
  end if;
end $$;

commit;
