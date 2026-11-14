-- Terminus TMS: the Deal dynamics lens, and Regulatory driver's stage rows.
-- DEAL DYNAMICS round, Phase 3, 2026-11-14. Rulings R-DD1 to R-DD7.
--
-- ============================================================================
-- WHAT THIS ADDS
-- ============================================================================
--
--   scale     Deal dynamics, five level        5 levels
--   lens      Deal dynamics, sort_order 50     information only, no gate (R-DD1)
--   criteria  four, opportunity, sort 1 to 4   (R-DD2)
--   anchors   twenty, version 1, PROVISIONAL   (R-DD7)
--   stages    twenty for the four criteria     (R-DD5)
--   stages    four for assessCommRegulatoryDriver, Finding A (R-DD6)
--
-- ============================================================================
-- THE SCALE RUNS WORST TO BEST, AND MET IS DATA (R-DD3, R-DD4)
-- ============================================================================
--
--   1 Poor      reason required
--   2 Weak      reason required
--   3 Adequate
--   4 Good      satisfies
--   5 Strong    satisfies
--
-- No Not applicable level. Level 1 here is the WORST answer, which is exactly
-- the scale the retired app.js set {1, 4, 5} would have read as met. Phase 2
-- (20261113000001) moved met onto scoring_scale_levels.satisfies first, so
-- this scale can say what it means. `description` is left null, following
-- every other scale whose criteria all carry their own anchors.
--
-- ============================================================================
-- NO GATE, AND THE ONE WAY THAT COULD CHANGE
-- ============================================================================
--
-- Solution Alignment is `required` per R-DD5. The only reader of `required` on
-- scoring_criterion_stages is the assessment_current gate rule in
-- src/routes/transitions.js, and no stage_gate_rules row of that type exists.
-- So this lens gates nothing today. A future assessment_current rule on the
-- opportunity would pull these four in at Solution Alignment, which R-DD1 says
-- they are not for.
--
-- ============================================================================
-- FINDING A
-- ============================================================================
--
-- assessCommRegulatoryDriver (20260831000006) was given a criterion row and
-- anchors and no stage rows, so it rendered at no stage. It gets the same rows
-- as its Commercial siblings: Solution Alignment required, then Proposal,
-- Evaluation and Negotiating. It is unscored on every scored opportunity, so
-- the Commercial roll-up gains one in its total at those four stages and
-- nothing in its met count.
--
-- ============================================================================
-- IDEMPOTENT
-- ============================================================================
--
-- Every insert is guarded on its natural key with NOT EXISTS (Architecture 7):
-- scale by name, level by (scale, value), lens by name, criterion by
-- (record_type, criterion_key), anchor by (criterion, version, score), stage
-- row by (criterion, stage). No seed file carries any scoring table
-- (Architecture 4 has nothing to reconcile).
--
-- NO LEDGER ROW IN THIS FILE (Architecture rule 10, as corrected 2026-09-08).
-- Applied by hand, record it with a separate statement afterwards.

-- ---------------------------------------------------------------------------
-- The scale and its levels.
-- ---------------------------------------------------------------------------
insert into public.scoring_scales (name)
select 'Deal dynamics, five level'
where not exists (
  select 1 from public.scoring_scales where name = 'Deal dynamics, five level'
);

insert into public.scoring_scale_levels (scale_id, value, label, reason_required, satisfies)
select s.id, v.value, v.label, v.reason_required, v.satisfies
from (values
  (1, 'Poor',     true,  false),
  (2, 'Weak',     true,  false),
  (3, 'Adequate', false, false),
  (4, 'Good',     false, true),
  (5, 'Strong',   false, true)
) as v(value, label, reason_required, satisfies)
cross join (select id from public.scoring_scales where name = 'Deal dynamics, five level') s
where not exists (
  select 1 from public.scoring_scale_levels l
  where l.scale_id = s.id and l.value = v.value
);

-- ---------------------------------------------------------------------------
-- The lens.
-- ---------------------------------------------------------------------------
insert into public.scoring_lenses (name, sort_order)
select 'Deal dynamics', 50
where not exists (
  select 1 from public.scoring_lenses where name = 'Deal dynamics'
);

-- ---------------------------------------------------------------------------
-- The four criteria.
-- ---------------------------------------------------------------------------
insert into public.scoring_criteria
  (record_type, criterion_key, name, asks, sort_order, lens_id, scale_id)
select 'opportunity', v.criterion_key, v.name, v.asks, v.sort_order, l.id, s.id
from (values
  ('assessDealClientResponsiveness',   'Client responsiveness',
   'How quickly does the client reply to our communications?', 1),
  ('assessDealTerminusResponsiveness', 'Terminus responsiveness',
   'How quickly do we reply to the client and move the next step?', 2),
  ('assessDealEngagementMomentum',     'Engagement momentum',
   'Is interaction with the client rising, steady or falling?', 3),
  ('assessDealClientFollowThrough',    'Client follow-through',
   'Does the client complete agreed actions by the agreed date?', 4)
) as v(criterion_key, name, asks, sort_order)
cross join (select id from public.scoring_lenses where name = 'Deal dynamics') l
cross join (select id from public.scoring_scales where name = 'Deal dynamics, five level') s
where not exists (
  select 1 from public.scoring_criteria c
  where c.record_type = 'opportunity' and c.criterion_key = v.criterion_key
);

-- ---------------------------------------------------------------------------
-- Anchors, version 1, every wording prefixed PROVISIONAL. per the convention.
-- Measurable thresholds (R-DD7), so later email automation can score the same
-- meaning a salesperson scores by hand.
-- ---------------------------------------------------------------------------
insert into public.scoring_anchors (criterion_id, version, score, wording)
select c.id, 1, v.score, 'PROVISIONAL. ' || v.wording
from (values
  ('assessDealClientResponsiveness', 1, 'No reply in 10 or more business days'),
  ('assessDealClientResponsiveness', 2, 'Replies only after repeated chasing'),
  ('assessDealClientResponsiveness', 3, 'Replies in 3 to 5 business days'),
  ('assessDealClientResponsiveness', 4, 'Replies in 1 to 2 business days'),
  ('assessDealClientResponsiveness', 5, 'Same-day replies; the client starts threads'),

  ('assessDealTerminusResponsiveness', 1, 'Client waiting 5 or more business days on us'),
  ('assessDealTerminusResponsiveness', 2, 'Our replies run past 3 business days'),
  ('assessDealTerminusResponsiveness', 3, 'We reply in 2 to 3 business days'),
  ('assessDealTerminusResponsiveness', 4, 'We reply the next business day'),
  ('assessDealTerminusResponsiveness', 5, 'Same day; we start the next step'),

  ('assessDealEngagementMomentum', 1, 'No interaction in 30 days'),
  ('assessDealEngagementMomentum', 2, 'Interaction falling off; client passive'),
  ('assessDealEngagementMomentum', 3, 'Steady but irregular contact'),
  ('assessDealEngagementMomentum', 4, 'Regular cadence; both sides active'),
  ('assessDealEngagementMomentum', 5, 'Interaction increasing; client asks for meetings'),

  ('assessDealClientFollowThrough', 1, 'Agreed actions missed with no explanation'),
  ('assessDealClientFollowThrough', 2, 'Most agreed actions late'),
  ('assessDealClientFollowThrough', 3, 'About half of agreed actions on time'),
  ('assessDealClientFollowThrough', 4, 'Most agreed actions on time'),
  ('assessDealClientFollowThrough', 5, 'All agreed actions met by the agreed date')
) as v(criterion_key, score, wording)
join public.scoring_criteria c
  on c.record_type = 'opportunity' and c.criterion_key = v.criterion_key
where not exists (
  select 1 from public.scoring_anchors a
  where a.criterion_id = c.id and a.version = 1 and a.score = v.score
);

-- ---------------------------------------------------------------------------
-- Stage rows. Twenty for Deal dynamics (R-DD5) and four for Regulatory driver
-- (R-DD6, Finding A).
-- ---------------------------------------------------------------------------
insert into public.scoring_criterion_stages (criterion_id, stage, required)
select c.id, st.stage, st.required
from (values
  ('assessDealClientResponsiveness'),
  ('assessDealTerminusResponsiveness'),
  ('assessDealEngagementMomentum'),
  ('assessDealClientFollowThrough')
) as k(criterion_key)
cross join (values
  ('Qualification',      false),
  ('Solution Alignment', true),
  ('Proposal',           false),
  ('Evaluation',         false),
  ('Negotiating',        false)
) as st(stage, required)
join public.scoring_criteria c
  on c.record_type = 'opportunity' and c.criterion_key = k.criterion_key
where not exists (
  select 1 from public.scoring_criterion_stages s
  where s.criterion_id = c.id and s.stage = st.stage
);

insert into public.scoring_criterion_stages (criterion_id, stage, required)
select c.id, st.stage, st.required
from (values
  ('Solution Alignment', true),
  ('Proposal',           false),
  ('Evaluation',         false),
  ('Negotiating',        false)
) as st(stage, required)
join public.scoring_criteria c
  on c.record_type = 'opportunity' and c.criterion_key = 'assessCommRegulatoryDriver'
where not exists (
  select 1 from public.scoring_criterion_stages s
  where s.criterion_id = c.id and s.stage = st.stage
);

-- ---------------------------------------------------------------------------
-- SELF-CHECK. Raises, and so rolls the whole file back, unless every row above
-- is present exactly as ruled. Compared as whole strings, so a missing row, an
-- extra row or a wrong flag all fail loudly.
-- ---------------------------------------------------------------------------
do $$
declare
  got text;
begin
  -- The scale's levels: value, label, reason required, satisfies.
  select string_agg(l.value || ' ' || l.label || ' ' || l.reason_required || ' ' || l.satisfies, ' | ' order by l.value)
    into got
  from public.scoring_scale_levels l
  join public.scoring_scales s on s.id = l.scale_id
  where s.name = 'Deal dynamics, five level';
  if got is distinct from
     '1 Poor true false | 2 Weak true false | 3 Adequate false false | 4 Good false true | 5 Strong false true' then
    raise exception 'deal dynamics: scale levels are %', coalesce(got, '(none)');
  end if;

  -- The lens.
  select string_agg(name || ' ' || sort_order, ' | ') into got
  from public.scoring_lenses where name = 'Deal dynamics';
  if got is distinct from 'Deal dynamics 50' then
    raise exception 'deal dynamics: lens is %', coalesce(got, '(none)');
  end if;

  -- The four criteria, on the lens and the scale, in order.
  select string_agg(c.sort_order || ' ' || c.criterion_key, ' | ' order by c.sort_order)
    into got
  from public.scoring_criteria c
  join public.scoring_lenses l on l.id = c.lens_id and l.name = 'Deal dynamics'
  join public.scoring_scales s on s.id = c.scale_id and s.name = 'Deal dynamics, five level'
  where c.record_type = 'opportunity';
  if got is distinct from
     '1 assessDealClientResponsiveness | 2 assessDealTerminusResponsiveness | '
     || '3 assessDealEngagementMomentum | 4 assessDealClientFollowThrough' then
    raise exception 'deal dynamics: criteria are %', coalesce(got, '(none)');
  end if;

  -- Twenty anchors at version 1, five per criterion, each PROVISIONAL, and no
  -- other version.
  select count(*)::text || ' ' || count(*) filter (where a.wording like 'PROVISIONAL. %')::text
         || ' ' || count(distinct a.criterion_id::text || ':' || a.score::text)::text || ' ' || max(a.version)::text
    into got
  from public.scoring_anchors a
  join public.scoring_criteria c on c.id = a.criterion_id
  where c.criterion_key like 'assessDeal%' and c.record_type = 'opportunity';
  if got is distinct from '20 20 20 1' then
    raise exception 'deal dynamics: anchors (rows, provisional, distinct, max version) are %', coalesce(got, '(none)');
  end if;

  -- Stage rows: every Deal dynamics criterion at the five stages, required at
  -- Solution Alignment only.
  -- collate "C" so the expected string does not depend on the database's
  -- collation.
  select string_agg(x, ' | ' order by x collate "C") into got from (
    select c.criterion_key || ' ' || string_agg(s.stage || case when s.required then '*' else '' end, ',' order by s.stage collate "C") as x
    from public.scoring_criterion_stages s
    join public.scoring_criteria c on c.id = s.criterion_id
    where c.record_type = 'opportunity'
      and (c.criterion_key like 'assessDeal%' or c.criterion_key = 'assessCommRegulatoryDriver')
    group by c.criterion_key
  ) t;
  if got is distinct from
     'assessCommRegulatoryDriver Evaluation,Negotiating,Proposal,Solution Alignment* | '
     || 'assessDealClientFollowThrough Evaluation,Negotiating,Proposal,Qualification,Solution Alignment* | '
     || 'assessDealClientResponsiveness Evaluation,Negotiating,Proposal,Qualification,Solution Alignment* | '
     || 'assessDealEngagementMomentum Evaluation,Negotiating,Proposal,Qualification,Solution Alignment* | '
     || 'assessDealTerminusResponsiveness Evaluation,Negotiating,Proposal,Qualification,Solution Alignment*' then
    raise exception 'deal dynamics: stage rows are %', coalesce(got, '(none)');
  end if;

  -- Phase 2's invariant, re-asserted: every scale still has a met level.
  if exists (
    select 1 from public.scoring_scales s
    where not exists (select 1 from public.scoring_scale_levels l where l.scale_id = s.id and l.satisfies)
  ) then
    raise exception 'deal dynamics: a scale has no met level';
  end if;
end $$;
