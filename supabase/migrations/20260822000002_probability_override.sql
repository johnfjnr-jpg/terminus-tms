-- Terminus TMS: per-record probability override, Round 20 Phase 4
--
-- OPPORTUNITY_DESIGN.md v1.2, "Probability, confirmed v1.2". The stored
-- column stays and there is no read-time derivation. What changes is that
-- a stage default stops being the only possible value.
--
-- WHY THIS IS A WRITE-PATH CHANGE AND NOT A COLUMN.
-- transitions.js overwrites opportunity_details.probability_pct from the
-- stage default after EVERY successful transition. Measured in Round 20
-- Phase 1 rather than read: a fixture's probability_pct was set to a
-- sentinel 77, the record was transitioned Discovery to Qualified through
-- the real API, and the value read back 20, the Qualified default. An
-- override column added without changing that write path would be erased
-- by the next stage change, which is the failure this migration exists to
-- prevent rather than a risk it accepts.
--
-- ATTRIBUTION IS A REFERENCE, NOT A STRING.
-- probability_override_by is a uuid referencing auth.users, not an email
-- or a name. The 2026-08-22 Deferred scope entry in DESIGN_PRINCIPLES.md
-- records what the alternative costs: the four staff fields hold a name as
-- text, so a rename or a departure leaves every historical record pointing
-- at a string that no longer resolves to anyone. That finding is three
-- days old and this is the first column written since it.
--
-- THE REASON IS NOT OPTIONAL, AND THE DATABASE IS WHERE THAT IS ENFORCED.
-- A route-level check is correct for every caller that exists and silent
-- for the next one, which is Architecture rule 8. The CHECK below makes an
-- override without a reason, an author or a timestamp impossible to store
-- at all, whatever writes it.

alter table public.opportunity_details
  add column if not exists probability_override_pct integer;

alter table public.opportunity_details
  add column if not exists probability_override_reason text;

alter table public.opportunity_details
  add column if not exists probability_override_by uuid references auth.users(id);

alter table public.opportunity_details
  add column if not exists probability_override_at timestamptz;

-- All four move together or none of them exist. Written as NOT VALID
-- deliberately: every existing row has all four null, which satisfies the
-- constraint, but NOT VALID keeps the migration from scanning the table
-- and is then validated immediately so the constraint is fully enforced
-- rather than left in the half-state DESIGN_PRINCIPLES.md already records
-- as a trap.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunity_details_probability_override_complete'
  ) then
    alter table public.opportunity_details
      add constraint opportunity_details_probability_override_complete
      check (
        (probability_override_pct is null
          and probability_override_reason is null
          and probability_override_by is null
          and probability_override_at is null)
        or
        (probability_override_pct is not null
          and probability_override_pct between 0 and 100
          and probability_override_reason is not null
          and length(btrim(probability_override_reason)) > 0
          and probability_override_by is not null
          and probability_override_at is not null)
      ) not valid;

    alter table public.opportunity_details
      validate constraint opportunity_details_probability_override_complete;
  end if;
end $$;

comment on column public.opportunity_details.probability_override_pct is
  'A per-record probability set by a person, overriding the stage default. '
  'When not null, transitions.js does NOT overwrite probability_pct from '
  'stage_probability_defaults. Null means the stage default governs, which '
  'is the behaviour every record had before this column existed.';

comment on column public.opportunity_details.probability_override_at is
  'When the override was set. This is what makes a STALE override visible: '
  'the override deliberately survives stage changes, because a judgement '
  'does not expire when the stage moves, so the only signal that it was '
  'made against a situation that no longer holds is its age.';
