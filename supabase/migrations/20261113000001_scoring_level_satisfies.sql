-- Terminus TMS: whether a scale level counts as met becomes data on the level.
-- DEAL DYNAMICS round, Phase 2, 2026-11-13. Ruling R-DD4.
--
-- ============================================================================
-- WHAT THIS REPLACES
-- ============================================================================
--
-- The lens roll-up decided "met" with a set typed into frontend/app.js:
--
--     const OPP_LENS_SATISFYING_LEVELS = new Set([1, 4, 5])
--
-- That set was right for the two scales it was written against, and only
-- because the three level confirmation scale was numbered 1, 2, 4 to fit it
-- (20260826000001). A scale whose level 1 means "worst" would read as MET.
-- The Deal dynamics scale is exactly that scale, so the set has to go before
-- that scale arrives.
--
-- Phase 1 found this the ONLY reader that decides met by level: the server's
-- score gates check presence and recency, never a value, and Test Bed has no
-- scale rows at all (null scale_id, DEFAULT_LEVELS in code).
--
-- ============================================================================
-- THE VALUES, AND WHY THEY ARE TODAY'S BEHAVIOUR EXACTLY
-- ============================================================================
--
--   Deal evidence, five level              1 Not applicable, 4 Buyer confirmed, 5 Verified
--   Requirement confirmation, three level  1 Not applicable, 4 Confirmed
--
-- Those are the members of {1, 4, 5} each scale actually has. The three level
-- scale has no 5, so the set's 5 never applied to it. Every other level is
-- false by the column default.
--
-- Matched on scale NAME and level VALUE, which is what the replaced set keyed
-- on. The self-check below then asserts the LABELS as well, so a renumbered
-- scale fails here loudly instead of moving a level in or out of "met".
--
-- ============================================================================
-- IDEMPOTENT, AND ONE WAY TO GO WRONG LESS
-- ============================================================================
--
-- The column is `add column if not exists`. The update matches only rows still
-- false, so a replay changes nothing. It is a correlated EXISTS rather than an
-- UPDATE ... FROM, so there is no FROM item that could be scoped wrongly
-- (CLAUDE.md build discipline 14a).
--
-- No seed file carries scoring_scales or scoring_scale_levels, checked against
-- supabase/seeds (the same search finds stage_gate_rules in 001_smoke_test.sql),
-- so Architecture rule 4 has nothing to reconcile.
--
-- NO LEDGER ROW IN THIS FILE (Architecture rule 10, as corrected 2026-09-08).
-- Applied by hand, record it with a separate statement afterwards.

alter table public.scoring_scale_levels
  add column if not exists satisfies boolean not null default false;

comment on column public.scoring_scale_levels.satisfies is
  'Whether a criterion whose latest score is at this level counts as met in the '
  'lens roll-up. Data per level, never a value set in code (R-DD4).';

update public.scoring_scale_levels l
set satisfies = true
where l.satisfies = false
  and exists (
    select 1 from public.scoring_scales s
    where s.id = l.scale_id
      and (
        (s.name = 'Deal evidence, five level' and l.value in (1, 4, 5))
        or (s.name = 'Requirement confirmation, three level' and l.value in (1, 4))
      )
  );

-- SELF-CHECK. Raises, and so rolls the whole file back, unless the flagged set
-- is exactly the five levels named above, carrying the labels the replaced set
-- was documented as meaning, and every scale has at least one met level.
do $$
declare
  flagged text;
  bare    int;
begin
  select string_agg(s.name || ' ' || l.value || ' ' || l.label, ' | ' order by s.name, l.value)
    into flagged
  from public.scoring_scale_levels l
  join public.scoring_scales s on s.id = l.scale_id
  where l.satisfies;

  if flagged is distinct from
     'Deal evidence, five level 1 Not applicable | Deal evidence, five level 4 Buyer confirmed | '
     || 'Deal evidence, five level 5 Verified | Requirement confirmation, three level 1 Not applicable | '
     || 'Requirement confirmation, three level 4 Confirmed' then
    raise exception 'satisfies: unexpected flagged levels: %', coalesce(flagged, '(none)');
  end if;

  select count(*) into bare
  from public.scoring_scales s
  where not exists (
    select 1 from public.scoring_scale_levels l where l.scale_id = s.id and l.satisfies
  );
  if bare > 0 then
    raise exception 'satisfies: % scale(s) have no met level', bare;
  end if;
end $$;
