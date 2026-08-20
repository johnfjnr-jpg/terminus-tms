-- Terminus TMS: Rollout Path's question, reworded. Round 13 Phase 3,
-- 2026-08-20. Written idempotently per Architecture rule 7.
--
-- A ROW EDIT, NOT A CODE CHANGE. `asks` is read generically: the API selects
-- the column by name in src/routes/scoring.js and the panel renders whatever
-- comes back. Nothing in this change touches either, which is the property
-- that makes the wording the business's to own rather than a deploy.
--
-- Confirmed with the business: "Does a route to deployment exist" becomes
-- "Does a suitable rollout path exist". The other four are untouched.
--
-- NO SEED FILE TO RECONCILE, checked rather than assumed. Architecture rule 4
-- covers seeded data because seeds re-run and win. scoring_criteria appears in
-- no file under supabase/seeds; it is seeded by migration 20260819000009,
-- whose insert is guarded by `where not exists` on criterion_key and so never
-- updates an existing row. On a fresh database that migration inserts the
-- original wording and this one corrects it, which is the correct end state
-- and is why the earlier migration is left exactly as it was applied.
--
-- THE ANCHORS ARE NOT TOUCHED. `asks` is the question; the anchors are the
-- instrument, and they are the subject of a business review that has not
-- happened. scoring_anchors ends this round at 15 rows, version 1 only.

update public.scoring_criteria
   set asks = 'Does a suitable rollout path exist'
 where record_type = 'test_bed'
   and criterion_key = 'scoreRolloutPath'
   and asks is distinct from 'Does a suitable rollout path exist';
