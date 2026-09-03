-- Terminus TMS: probability is re-derived at EVERY transition, by whichever
-- path moves the record.
--
-- ── THE MEASURED CAUSE, AND IT IS NOT THE ONE THE SYMPTOM SUGGESTS ────────
--
-- The walk reported probability sitting at 10% on a Proposal deal. Measured
-- across every live opportunity: SEVEN records carry a probability that is not
-- their stage's default, all of them 10, which is the Qualification value
-- written at creation. All five Proposal records and one Closed Won record.
--
-- `probability_override_pct` is NULL on every one of them, so the Round 20
-- override guard never fired. The re-derivation is not being SKIPPED, it is not
-- being REACHED: it lives in the POST /records/:id/transition route, and the
-- stage-approval workflow moves the record inside decide_transition_request and
-- raise_transition_request, neither of which mentions probability at all
-- (measured: zero occurrences in both).
--
-- Architecture 8 again, from the mover's side: the update was correct for every
-- path that existed when it was written, and a new path arrived that does not
-- go through it.
--
-- ── SO IT BECOMES A TRIGGER ON THE FACT, NOT A STEP IN A ROUTE ────────────
--
-- Architecture 3, one computation path per concern. A stage change is a fact
-- about `records`, and every mover writes it there: the route, the decide
-- function, the zero-track immediate move in the raise function, and whatever
-- moves a record next. A trigger is the only place that catches all of them
-- without a fourth copy of the same lookup.
--
-- ── SUPERSEDES ROUND 20 PHASE 4, and its reasoning is left visible ────────
--
-- Round 20 Phase 4 ruled: "a person's override outranks the stage default", and
-- the transition route skips the reset when `probability_override_pct` is set.
-- That was a correct answer to "should a transition discard what a person
-- typed".
--
-- The business ruled the opposite on 2026-09-03: probability is DERIVED from
-- stage, overwritable within a stage, and RE-DERIVED at each transition. The
-- override holds until the next transition and then goes.
--
-- Verification 23: two correct decisions about the same behaviour taken in
-- different rounds, and the fix is deletion rather than reconciliation. The
-- override no longer outranks anything at a transition, so the guard in
-- transitions.js goes with this migration rather than sitting beside it
-- disagreeing.

-- ── 1. THE CONFIG, WHICH ALREADY EXISTED ─────────────────────────────────
--
-- stage_probability_defaults is already a table and already carries all seven
-- stages, so the storage half of the ruling needs nothing. One value disagreed
-- with the ruling: Evaluation was 60 and is ruled 40.
--
-- Data-driven per Architecture 2: a later Admin UI edits this row rather than
-- needing a migration.
update public.stage_probability_defaults
   set default_probability_pct = 40
 where record_type = 'opportunity'
   and variant is null
   and stage = 'Evaluation'
   and default_probability_pct is distinct from 40;

-- ── 2. RE-DERIVE ON EVERY STAGE CHANGE ───────────────────────────────────
create or replace function public.apply_stage_probability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default integer;
begin
  -- Only a real stage change, and only for the record type that has the concept.
  if new.record_type <> 'opportunity' then return new; end if;
  if new.status is not distinct from old.status then return new; end if;

  select d.default_probability_pct into v_default
  from public.stage_probability_defaults d
  where d.record_type = new.record_type
    and d.stage = new.status
    and (d.variant is not distinct from new.variant);

  -- A stage with no configured default leaves the value alone rather than
  -- writing a null over it: absence of configuration is not a probability of
  -- nothing. Architecture 11, and the same reason weightedValue returns null
  -- rather than 0 when probability is missing.
  if v_default is null then return new; end if;

  -- THE OVERRIDE IS CLEARED, NOT IGNORED. The ruling is that an override holds
  -- until the next transition; leaving it set would keep a value that has just
  -- been superseded sitting in the record, and the next reader would have to
  -- know which of the two to believe.
  --
  -- ALL FOUR COLUMNS, because the override is a SET and not a value.
  -- opportunity_details_probability_override_complete is an all-or-nothing
  -- check across pct, reason, by and at, so clearing the pct alone violates it
  -- and every transition of an overridden record would have failed. Found by
  -- the probe's own fixture hitting 23514 while setting one up, before this
  -- migration was applied to anything.
  update public.opportunity_details
     set probability_pct = v_default,
         probability_override_pct = null,
         probability_override_reason = null,
         probability_override_by = null,
         probability_override_at = null
   where record_id = new.id;

  return new;
end $$;

comment on function public.apply_stage_probability is
  'Re-derives probability_pct from stage_probability_defaults on every stage '
  'change, whichever path moved the record, and clears any override. The route '
  'that used to do this is not on the workflow''s path: measured, seven live '
  'opportunities sat at the Qualification default after moving. Supersedes '
  'Round 20 Phase 4, which let an override outrank the stage default.';

-- AFTER, not BEFORE. opportunity_details carries refuse_write_while_frozen, so
-- this write is refused while a request on the record is still OPEN. Every
-- mover closes its request before moving the record - decide_transition_request
-- sets the request to approved, then updates records - so by the time this
-- fires there is no open request to freeze against. That ordering is the
-- premise, it is not obvious, and it is what the probe calibrates.
drop trigger if exists records_stage_probability_trg on public.records;
create trigger records_stage_probability_trg
  after update of status on public.records
  for each row execute function public.apply_stage_probability();

-- ── 3. BRING THE SEVEN DRIFTED RECORDS TO THEIR STAGE'S VALUE ────────────
--
-- Not a backfill of history: these are records whose stage already changed and
-- whose probability should have moved with it. Guarded so it is a no-op on a
-- replay, per Architecture 7.
update public.opportunity_details od
   set probability_pct = d.default_probability_pct,
       probability_override_pct = null,
       probability_override_reason = null,
       probability_override_by = null,
       probability_override_at = null
  from public.records r
  join public.stage_probability_defaults d
    on d.record_type = r.record_type
   and d.stage = r.status
   and d.variant is not distinct from r.variant
 where od.record_id = r.id
   and r.record_type = 'opportunity'
   and r.deleted_at is null
   and od.probability_pct is distinct from d.default_probability_pct;

do $$
declare
  v_eval integer;
  v_drift integer;
begin
  select default_probability_pct into v_eval from public.stage_probability_defaults
   where record_type = 'opportunity' and variant is null and stage = 'Evaluation';
  if v_eval is distinct from 40 then
    raise exception 'Evaluation must be 40 under the ruling, got %', v_eval;
  end if;

  select count(*) into v_drift
  from public.opportunity_details od
  join public.records r on r.id = od.record_id
  join public.stage_probability_defaults d
    on d.record_type = r.record_type and d.stage = r.status
   and d.variant is not distinct from r.variant
  where r.record_type = 'opportunity' and r.deleted_at is null
    and od.probability_pct is distinct from d.default_probability_pct;
  if v_drift <> 0 then
    raise exception '% opportunities still disagree with their stage default', v_drift;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Architecture 10: the ledger row, in the same paste.
insert into supabase_migrations.schema_migrations (version)
values ('20260903000001')
on conflict (version) do nothing;
