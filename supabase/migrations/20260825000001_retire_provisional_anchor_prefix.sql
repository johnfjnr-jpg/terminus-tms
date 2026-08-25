-- Terminus TMS: the PROVISIONAL prefix is retired. Round 31 Phase 2, 2026-08-25.
--
-- Round 25 Phase 2 seeded the seven Commercial criteria with anchor wording
-- that carried a literal `PROVISIONAL.` prefix on all five levels, and said so
-- in its own header: the ends of each scale were drawn from the superset's
-- evidence columns and the middle was provisional by construction. The marker
-- existed so nobody would read the wording as settled the way Test Bed's
-- anchors had been read as settled ever since `scoring_model.sql` carried the
-- same warning in a comment.
--
-- THE MARKER HAS DONE ITS JOB. The wording has now been read against a real
-- deal and the business has judged it. Round 31 puts the wording on a hover,
-- where `PROVISIONAL.` would be the first word read five times in a row.
--
-- ============================================================================
-- A NEW VERSION, NOT AN EDIT
-- ============================================================================
--
-- `scoring_anchors` is append only and the immutability is structural rather
-- than conventional: the table declares a select policy and nothing else, so
-- an UPDATE through the API returns `error: none` with `rows affected: 0`. It
-- reports success and changes nothing, which is the Verification 8 shape and
-- the reason this is a migration.
--
-- It is also the mechanism INVARIANT 9 requires. That invariant asserts every
-- stored score references a complete anchor version, and derives "complete"
-- from the scores a criterion holds anchors for at ANY version. Version 1 is
-- left exactly as it was, so the 71 live score entries stamped `anchorVersion:
-- 1` keep resolving to the wording they were actually made against. Round 28
-- established that deleting the rows would break this for precisely that
-- reason.
--
-- VERSION 2 IS COMPLETE OR IT IS NOTHING. Five scores for each of the seven
-- criteria, 35 rows. A partial version would satisfy INVARIANT 9 today,
-- because no entry references it yet, and fail the first time anything is
-- scored against it.
--
-- ============================================================================
-- DERIVED FROM VERSION 1, NOT RETYPED
-- ============================================================================
--
-- The new wording is version 1's with the prefix stripped by `regexp_replace`,
-- so the two versions are provably identical except for the marker. Retyping
-- 35 strings would put a transcription error one keystroke away and nothing
-- would catch it: an anchor is prose, and prose has no constraint to violate.
--
-- SCOPED TO OPPORTUNITY. Test Bed's 15 anchors carry no prefix, so the
-- replacement would be a no-op on them, but a version 2 row would still be
-- created and `current_version` is computed as the highest version number
-- (`src/routes/scoring.js`). Creating an empty new version for Test Bed would
-- change which version its panel renders from, for no reason. The filter is on
-- the criterion's record_type and on the prefix actually being present.
--
-- IDEMPOTENT, per Architecture rule 7. The `where not exists` guard is on the
-- natural key the table already enforces, (criterion_id, version, score), so a
-- replay inserts nothing rather than raising on the unique constraint.
--
-- No seed file carries `scoring_anchors`, checked and calibrated against
-- `stage_gate_rules`, which the seeds do carry. Architecture rule 4 has nothing
-- to reconcile here.

insert into public.scoring_anchors (criterion_id, version, score, wording)
select a.criterion_id,
       2,
       a.score,
       regexp_replace(a.wording, '^PROVISIONAL\.\s*', '')
from public.scoring_anchors a
join public.scoring_criteria c on c.id = a.criterion_id
where a.version = 1
  and c.record_type = 'opportunity'
  and a.wording like 'PROVISIONAL.%'
  and not exists (
    select 1 from public.scoring_anchors existing
    where existing.criterion_id = a.criterion_id
      and existing.version = 2
      and existing.score = a.score
  );
