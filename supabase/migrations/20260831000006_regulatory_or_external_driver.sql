-- Terminus TMS: a Commercial criterion for the driver that is not the buyer's
-- own idea. Round 41, fix-panel item 4, ruled by the business.
--
-- ─────────────────────────────────────────────────────────────
-- NO NEW SCALE, AND THAT IS WORTH SAYING
-- ─────────────────────────────────────────────────────────────
--
-- The ruling asks for "the same four-step scale plus Not applicable". THAT IS
-- THE EXISTING SCALE EXACTLY: "Deal evidence, five level" is Not applicable,
-- Unknown, Our hypothesis, Buyer confirmed, Verified, so values 2 to 5 are the
-- four steps and value 1 is Not applicable. Building a second scale was the
-- obvious move and would have been a fork of the one every other Commercial
-- criterion uses.
--
-- ─────────────────────────────────────────────────────────────
-- THE ANCHORS ARE PROVISIONAL, IN THE DATA AND NOT ONLY IN A NOTE
-- ─────────────────────────────────────────────────────────────
--
-- John's standing convention, followed rather than invented: v1 wording carries
-- the literal prefix PROVISIONAL. and a later version drops it once real use has
-- corrected it. Every other criterion on this lens went in the same way, and the
-- v1 rows are still there beside the v2 ones, which is what makes the correction
-- legible rather than silent.
--
-- I drafted these. They are a first attempt at wording a question nobody has
-- asked a buyer yet, and the full assessment criteria review scheduled after
-- Round 41 is where they get corrected.
--
-- ─────────────────────────────────────────────────────────────
-- NO BACKFILL
-- ─────────────────────────────────────────────────────────────
--
-- Existing assessments carry the new row UNSET. Nothing is written into any
-- record: a criterion with no score is unscored, which the schema already says,
-- and inventing a score for 30 deals nobody has re-read would be worse than an
-- honest gap. Lens totals and the assessmentReviewed exit criterion both read
-- the criteria table, so neither needs a change.

insert into public.scoring_criteria
  (record_type, criterion_key, name, asks, sort_order, lens_id, scale_id, rescore_through_stage)
select
  'opportunity',
  'assessCommRegulatoryDriver',
  'Regulatory or external driver',
  'Is something outside the buyer requiring this, rather than the buyer choosing it',
  8,
  '2e83c3cd-7c01-42ac-aaa9-da0d93101e42'::uuid,   -- Commercial
  '5e6e2176-04ed-41be-a807-3bb7d0efbf0b'::uuid,   -- Deal evidence, five level
  null
where not exists (
  select 1 from public.scoring_criteria
  where record_type = 'opportunity' and criterion_key = 'assessCommRegulatoryDriver'
);

-- The five anchors, v1, PROVISIONAL per the convention.
insert into public.scoring_anchors (criterion_id, version, score, wording)
select c.id, 1, v.score, v.wording
from public.scoring_criteria c
cross join (values
  (1, 'PROVISIONAL. Not applicable where no external obligation exists: the buyer is acting on its own initiative and nothing outside is requiring it.'),
  (2, 'PROVISIONAL. Whether anything outside the buyer is driving this has not been established.'),
  (3, 'PROVISIONAL. Terminus believes a regulation, mandate or funding condition is driving this, inferred from the sector or from public policy rather than from the buyer.'),
  (4, 'PROVISIONAL. A named person at the buyer has stated the obligation, what it requires of them and roughly when.'),
  (5, 'PROVISIONAL. The obligation is evidenced: the regulation, licence condition, funding term or deadline is cited and its date confirmed.')
) as v(score, wording)
where c.record_type = 'opportunity'
  and c.criterion_key = 'assessCommRegulatoryDriver'
  and not exists (
    select 1 from public.scoring_anchors a
    where a.criterion_id = c.id and a.version = 1 and a.score = v.score
  );

-- Architecture 10: the ledger row, in the same paste.
insert into supabase_migrations.schema_migrations (version)
values ('20260831000006')
on conflict (version) do nothing;
