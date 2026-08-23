-- Terminus TMS: the assessment rollup gate. Round 24 Phase 6, 2026-08-23.
--
-- A new requirement_type. Every existing rule names ONE thing: a field, a
-- track, a document, a role. This one names none and resolves a SET, which is
-- why it needs a shape of its own rather than another payload_field_required
-- row.
--
-- WHAT IT ASSERTS. Every criterion required at the stage being exited OR
-- EARLIER carries an entry dated at or after entry to that stage.
--
-- The "or earlier" half is the whole point. If Solution Alignment checked only
-- the criteria introduced there, a budget confirmed at Qualification would
-- never be revisited, and going stale is precisely what that criterion does.
--
-- WHY CUMULATIVE RATHER THAN A REQUIRED ROW PER ROLLUP STAGE, sized against
-- the real design before choosing. The design introduces 7 criteria at
-- Qualification, 21 at Solution Alignment and 2 at Proposal, with rollups at
-- Solution Alignment, Proposal and Negotiating. Marking each rollup stage
-- explicitly costs 28 + 30 + 30 = 88 required rows. Computing "at this stage
-- or earlier" costs 7 + 21 + 2 = 30, one per criterion at the stage it is
-- introduced. The 58 extra rows each repeat a fact its introduction row
-- already states, and a Qualification criterion would carry three of them.
--
-- The cost is that the business cannot exempt a single criterion from a single
-- later rollup by deleting one row. Nothing in the design asks for that, and
-- the required flag is still per row, so the door is not closed: an exemption
-- column or a second rule type could express it later without moving anything
-- built here.
--
-- NO INSTRUMENT DISCRIMINATOR, and this is a recorded limit rather than an
-- oversight. The rule resolves every scoring criterion for the record type. A
-- second instrument on the same record type, which the Risk assessment will
-- be, needs a way to say which criteria it counts. Risk is not designed, and
-- inventing the discriminator now would be structure without evidence. It is
-- named here so the round that designs Risk finds it rather than discovers it.
--
-- Written idempotently per Architecture rule 7.

-- Same convention as when payload_field_required and contact_role_linked were
-- added: drop and re-add the check constraint with the new value included.
alter table public.stage_gate_rules
  drop constraint if exists stage_gate_rules_requirement_type_check;

alter table public.stage_gate_rules
  add constraint stage_gate_rules_requirement_type_check
  check (requirement_type in (
    'document_status',
    'approval_obtained',
    'child_record_status',
    'payload_field_required',
    'contact_role_linked',
    'assessment_current'
  ));

-- NO ROWS ARE INSERTED. The Opportunity criteria this would gate do not exist
-- yet, and a rule naming a set that is empty passes vacuously, which is worse
-- than no rule at all: it reads as a gate that has been satisfied.
--
-- The evaluator is exercised in this phase against a synthetic record type
-- rather than by configuring a live one, so the branch ships proven rather
-- than waiting for its first real caller a round later.
