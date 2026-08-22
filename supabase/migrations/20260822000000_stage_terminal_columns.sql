-- Terminus TMS: terminal stage properties as columns, Round 20 Phase 2
--
-- OPPORTUNITY_DESIGN.md v1.2, "The adjacency exception, and why it should
-- be a column". Round 9 Phase 4A made forward transitions adjacency-only
-- after a probe advanced a record two stages and the transition succeeded
-- because no gate rules existed for that pair. Closed Lost has to be
-- reachable from anywhere, which that check would refuse, and a named
-- code exception would put gate vocabulary back into code after this
-- project spent nine rounds moving it out.
--
-- Two columns rather than one. They are independent:
--   is_terminal              nothing leaves this stage
--   reachable_from_any_stage the adjacency check does not apply on entry
-- Closed Won is terminal and NOT reachable from anywhere; it is entered
-- from Negotiating like any other forward move. Closed Lost is both.
--
-- BOTH DEFAULT FALSE, so this migration changes no behaviour on its own.
-- Every existing row keeps exactly the semantics it has today. The stage
-- rows that will carry true do not exist yet and are created in Phase 3.
--
-- Deliberately NOT set here, confirmed against the live database in Phase 2:
-- contact.Parked is the last row in contact's ordered list and looks
-- terminal, and it is not. Three real transitions have left it,
-- Parked -> Unqualified twice and Parked -> Qualified once, which is the
-- un-park path working as intended. Marking it terminal would break a
-- path the business uses. test_bed.Closed holds 5 live records and has
-- never been left; that is a decision for whoever owns Test Bed, not a
-- side effect of this round.

alter table public.stage_definitions
  add column if not exists is_terminal boolean not null default false;

alter table public.stage_definitions
  add column if not exists reachable_from_any_stage boolean not null default false;

comment on column public.stage_definitions.is_terminal is
  'When true, no transition may LEAVE this stage. Blocks outbound moves, '
  'including the backward moves the transition engine otherwise permits '
  'without restriction. Closed Won and Closed Lost are adjacent in the '
  'ordered list, so without this a won deal could be advanced into lost.';

comment on column public.stage_definitions.reachable_from_any_stage is
  'When true, the stage adjacency check does not apply to transitions INTO '
  'this stage, so it can be entered from any stage rather than only from '
  'its immediate predecessor. Does not affect gate rules: a transition into '
  'this stage still satisfies whatever stage_gate_rules rows exist for the '
  'pair. Independent of is_terminal.';
