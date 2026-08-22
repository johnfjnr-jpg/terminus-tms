-- Terminus TMS: Opportunity stage restructure, Round 20 Phase 3
--
-- OPPORTUNITY_DESIGN.md v1.2. Replaces the six configured stages with the
-- confirmed seven: five working stages and two terminal states.
--
--   old                          new
--   Discovery    (1)      ->     Qualification       (10)
--   Qualified    (2)      ->     Solution Alignment  (20)
--   Proposal     (3)      ->     Proposal            (40)   carried over
--   Evaluation   (4)      ->     Evaluation          (60)   carried over
--   Negotiation  (5)      ->     Negotiating         (80)
--   Closing      (6)      ->     removed
--                                Closed Won         (100)   terminal
--                                Closed Lost          (0)   terminal, reachable from any stage
--
-- Sort orders are spaced by 20. The adjacency check compares POSITION in
-- the ordered list rather than sort_order arithmetic, so the gaps cost
-- nothing and leave room to insert a stage later without renumbering.
--
-- ─────────────────────────────────────────────────────────────
-- WHY THE ORDER OF THE STATEMENTS BELOW MATTERS
-- ─────────────────────────────────────────────────────────────
--
-- Nothing joins these tables. records.status is plain text with no foreign
-- key and no check constraint, stage_definitions.stage_name is a separate
-- column in a separate table, and stage_probability_defaults.stage is a
-- third. Postgres will not complain about any inconsistency between them
-- at any point during this migration, so the ordering is the only thing
-- protecting the intermediate states:
--
--   1. Insert the five NEW stage rows first. A record whose status is not
--      in stage_definitions gets fromIdx < 0 in transitions.js and can
--      never transition again, so the destinations must exist before any
--      record points at them.
--   2. Update the two CARRIED-OVER stage rows' sort_order.
--   3. Move the records off the old names.
--   4. Move stage_gate_rules off the old names. Zero opportunity rows exist
--      today, asserted rather than assumed, so these affect nothing; they
--      are written anyway so a replay after rules are added still works.
--   5. Remap stage_probability_defaults, insert then update then delete.
--   6. Delete the four obsolete stage rows LAST, after nothing points at
--      them.
--
-- Reversing 3 and 6 would leave 61 records holding a status with no stage
-- row, which is silent, survives a commit, and is unrecoverable by one.
--
-- ─────────────────────────────────────────────────────────────
-- IDEMPOTENCY
-- ─────────────────────────────────────────────────────────────
--
-- Every insert is guarded with WHERE NOT EXISTS rather than ON CONFLICT.
-- stage_definitions does carry UNIQUE (record_type, variant, stage_name),
-- but every opportunity row has variant NULL and Postgres treats NULLs in
-- a unique constraint as distinct, so ON CONFLICT would not fire and a
-- replay would insert duplicates invisibly. Confirmed by probe in Round 20
-- Phase 0: two identical rows with a non-null variant were rejected 23505,
-- two with a NULL variant both inserted.
--
-- The updates and deletes are naturally idempotent: a second run matches
-- the old names, finds none, and affects zero rows.
--
-- WHERE NOT EXISTS also has a failure mode this migration deliberately
-- avoids. For a name that CARRIES OVER, the guard is satisfied by the old
-- row and the insert is skipped, silently preserving the old sort_order
-- and the old probability. Proposal would keep 50 instead of 40. That is
-- why Proposal and Evaluation are UPDATEd explicitly below rather than
-- being included in the insert.

-- ── 1. The five new stage rows ────────────────────────────────
insert into public.stage_definitions
  (record_type, variant, stage_name, sort_order, is_terminal, reachable_from_any_stage)
select 'opportunity', null, v.stage_name, v.sort_order, v.is_terminal, v.reachable
from (values
  ('Qualification',       10,  false, false),
  ('Solution Alignment',  20,  false, false),
  ('Negotiating',         80,  false, false),
  ('Closed Won',         100,  true,  false),
  ('Closed Lost',          0,  true,  true )
) as v(stage_name, sort_order, is_terminal, reachable)
where not exists (
  select 1 from public.stage_definitions d
  where d.record_type = 'opportunity' and d.variant is null and d.stage_name = v.stage_name
);

-- ── 2. The two carried-over stage rows ────────────────────────
update public.stage_definitions
  set sort_order = 40, is_terminal = false, reachable_from_any_stage = false
  where record_type = 'opportunity' and variant is null and stage_name = 'Proposal';

update public.stage_definitions
  set sort_order = 60, is_terminal = false, reachable_from_any_stage = false
  where record_type = 'opportunity' and variant is null and stage_name = 'Evaluation';

-- ── 3. The records, live and soft deleted alike ───────────────
-- Soft-deleted records are never hard deleted in this project, so leaving
-- them pointing at a stage that no longer exists is not acceptable.
update public.records set status = 'Qualification'      where record_type = 'opportunity' and status = 'Discovery';
update public.records set status = 'Solution Alignment' where record_type = 'opportunity' and status = 'Qualified';
update public.records set status = 'Negotiating'        where record_type = 'opportunity' and status = 'Negotiation';
-- 'Proposal' and 'Evaluation' keep their names, so no statement is needed
-- and none is written. A no-op UPDATE would report a row count that looks
-- like work and is not.

-- ── 4. stage_gate_rules ───────────────────────────────────────
-- Zero opportunity rows exist at the time of writing, asserted against the
-- live database rather than assumed. Written anyway so that a replay after
-- Phase 5 adds rules still moves them.
update public.stage_gate_rules set from_stage = 'Qualification'      where record_type = 'opportunity' and from_stage = 'Discovery';
update public.stage_gate_rules set to_stage   = 'Qualification'      where record_type = 'opportunity' and to_stage   = 'Discovery';
update public.stage_gate_rules set from_stage = 'Solution Alignment' where record_type = 'opportunity' and from_stage = 'Qualified';
update public.stage_gate_rules set to_stage   = 'Solution Alignment' where record_type = 'opportunity' and to_stage   = 'Qualified';
update public.stage_gate_rules set from_stage = 'Negotiating'        where record_type = 'opportunity' and from_stage = 'Negotiation';
update public.stage_gate_rules set to_stage   = 'Negotiating'        where record_type = 'opportunity' and to_stage   = 'Negotiation';
delete from public.stage_gate_rules where record_type = 'opportunity' and (from_stage = 'Closing' or to_stage = 'Closing');

-- ── 5. stage_probability_defaults ─────────────────────────────
insert into public.stage_probability_defaults (record_type, variant, stage, default_probability_pct)
select 'opportunity', null, v.stage, v.pct
from (values
  ('Qualification',       10),
  ('Solution Alignment',  20),
  ('Negotiating',         80),
  ('Closed Won',         100),
  ('Closed Lost',          0)
) as v(stage, pct)
where not exists (
  select 1 from public.stage_probability_defaults p
  where p.record_type = 'opportunity' and p.variant is null and p.stage = v.stage
);

-- Carried over. Proposal changes 50 to 40. Evaluation is already 60 and is
-- set explicitly anyway, so the value is asserted by the statement rather
-- than assumed from the old row.
update public.stage_probability_defaults set default_probability_pct = 40
  where record_type = 'opportunity' and variant is null and stage = 'Proposal';
update public.stage_probability_defaults set default_probability_pct = 60
  where record_type = 'opportunity' and variant is null and stage = 'Evaluation';

delete from public.stage_probability_defaults
  where record_type = 'opportunity' and variant is null
    and stage in ('Discovery', 'Qualified', 'Negotiation', 'Closing');

-- ── 6. The four obsolete stage rows, last ─────────────────────
delete from public.stage_definitions
  where record_type = 'opportunity' and variant is null
    and stage_name in ('Discovery', 'Qualified', 'Negotiation', 'Closing');
