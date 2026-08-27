-- Terminus TMS: Base Cost Data, the product catalog. Round 36 Phase 1.
--
-- The costs the Opportunity Commercials tab has claimed to mirror since it was
-- built. Its own label reads "Computed pricing (USD) - costs mirrored from Base
-- Cost Data" and there has never been a Base Cost Data to mirror.
--
-- Configuration only. Nothing writes to this table in this phase, and the tab
-- that reads it arrives in Phase 2.
--
-- ─────────────────────────────────────────────────────────────
-- WHAT ROUND 36 PHASE 0 FOUND, AND WHY THIS TABLE IS THE FIX
-- ─────────────────────────────────────────────────────────────
--
-- The ten rate keys (ssUnitCost, aqUnitCost, hemirUnitCost, the four install
-- rates and the three hosting rates) are refused by SALESPERSON_WRITABLE_KEYS
-- and always have been: git log -S over routes/opportunities.js returns exactly
-- one commit, the one that created the allowlist, where the names appear only
-- in the comment saying they are rejected.
--
-- Nothing writes them either. An Opportunity's revision 1 is
-- {name, company_name, customerLead}, and all four live Opportunities carry
-- zero rate keys. So the fields were never read-only-after-creation. They were
-- never written at all, and the screen showed $0 for arithmetic on nothing.
--
-- The divergence the catalog exists to end is real and it is on TEST BED, where
-- the same rates ARE writable and typed by hand. Ten of 39 typed values across
-- eight live Test Beds disagree with the figures seeded below, including a
-- hosting rate entered at 2000 against a catalog 200.
--
-- ─────────────────────────────────────────────────────────────
-- A ROW IS ONE PRODUCT'S BATCH, NOT A THIRD OF A BATCH
-- ─────────────────────────────────────────────────────────────
--
-- Confirmed with the business: a manufacturing run is per product, and runs for
-- different products arrive at different times. So a batch does not span the
-- catalog, and there is no batch header to carry: the row IS the batch.
--
-- That is why this is one flat table rather than the header-plus-lines shape
-- scoring_scales/scoring_scale_levels uses. Phase 0 costed that option against
-- this one, and its advantage was keeping three product lines from disagreeing
-- about their shared batch metadata. There is no shared batch metadata, so the
-- advantage does not exist here and the second table would be empty ceremony.
--
-- ─────────────────────────────────────────────────────────────
-- effective_from, NOT AN active FLAG. THE BUSINESS'S DECISION.
-- ─────────────────────────────────────────────────────────────
--
-- Current is the latest batch for a product whose effective_from has passed.
--
-- The reasoning is the business's own reason for wanting batches: retracing
-- through previous pricing. A flag cannot answer "which batch was current in
-- March", because the history is destroyed the moment the flag moves. A date
-- answers it by reading, and needs nothing else recorded.
--
-- It also allows a run to be entered before it takes effect. One consequence,
-- confirmed as intended: a future-dated batch is NOT current, so entering next
-- quarter's prices does not reprice today's deals.
--
-- ─────────────────────────────────────────────────────────────
-- NO active COLUMN, AND THAT IS A DEPARTURE FROM closed_lost_reasons
-- ─────────────────────────────────────────────────────────────
--
-- closed_lost_reasons and contact_roles both carry `active`, and Round 35
-- shaped its vocabularies on that column deliberately. It does not transfer,
-- for two reasons that each stand alone.
--
-- FIRST, `active` there serves a need that does not exist here. It separates
-- two things a vocabulary must do at once: stop OFFERING a row in a picker,
-- while keeping an existing citation RESOLVING. Nothing picks a batch. No user
-- ever chooses one, in this phase or in the pricing-version round that follows,
-- because "which batch" is answered by a date and not by a person. Half of what
-- the flag is for is unreachable.
--
-- SECOND, and this is the disqualifying one: a flag would be a SECOND answer to
-- "which batch is current", competing with effective_from. Architecture rule 3
-- says one computation path per concern, and a second path that agrees today
-- will disagree later. It would also reintroduce exactly the defect the date was
-- chosen to avoid, since a flag holds only the present.
--
-- Retirement here is a later batch superseding an earlier one, which is what
-- effective_from already says. A batch entered in error is corrected in the
-- Supabase editor before anything points at it, not flagged inactive forever.
--
-- ─────────────────────────────────────────────────────────────
-- WHAT KEEPS A SUPERSEDED BATCH UNCHANGED, STATED PRECISELY
-- ─────────────────────────────────────────────────────────────
--
-- Select-only RLS below, the Round 35 precedent: a select policy and no insert,
-- update or delete policy, so deny-by-default refuses every write. Every API
-- route runs under the user's JWT (src/supabase.js), so this is enforced by the
-- database against the whole application rather than by care at a call site.
--
-- IT DOES NOT BIND THE SUPABASE EDITOR. The editor connects as the table owner
-- and bypasses RLS, and the editor is the only maintenance path this build has.
-- So the guarantee is precisely: the application cannot alter a batch, and an
-- admin can. That is the same guarantee contact_roles, contact_stances,
-- closed_lost_reasons and industries all carry, and it is stated here rather
-- than left to be assumed stronger than it is.
--
-- The stronger form, a trigger raising on UPDATE or DELETE of a row whose
-- effective_from has passed, would bind the owner too. NOT BUILT HERE, and the
-- reason is a real cost rather than an oversight: it would also stop an admin
-- correcting a typo in a batch that went live this morning, and nothing points
-- at a batch yet. Pricing versions are the round where a citation starts to
-- exist, and that is the round where the business should be asked to weigh the
-- two. Flagged in DESIGN_PRINCIPLES.md rather than decided silently here.
--
-- ─────────────────────────────────────────────────────────────
-- product IS CONSTRAINED TEXT, AND THE CONSTRAINT IS NOT WHAT LIMITS IT TO THREE
-- ─────────────────────────────────────────────────────────────
--
-- A CHECK rather than a free text column, because Round 35 Phase 2 measured
-- record_contacts.role diverging into 6 spellings for 4 real roles across 459
-- rows, with no free-text feature in the product at all. A CHECK makes that
-- impossible rather than unlikely.
--
-- A CHECK rather than a foreign key to a products table, because there is no
-- products table and this round is not the place to invent one. DESIGN_
-- PRINCIPLES.md records product_defaults as "row-based, so a future product is
-- a new row, not a schema change", and Round 36 Phase 0 measured what that
-- claim is worth today: 445 hardcoded SafeSight/AQ/HEMIR references across
-- seven files, in the calculator, the routes, both detail scripts and the
-- markup. A fourth product is a code change whatever this table looks like.
--
-- So the three-value CHECK is not the thing standing between this build and a
-- fourth product. Saying otherwise would repeat the claim the same document
-- already records as never having been true.
--
-- Keys are readable words rather than the ss/aq/hemir prefixes the payload
-- uses, because an admin maintains these rows by hand in the Supabase editor
-- and that is the only write path there is. Phase 2 maps the three keys to the
-- payload prefixes in exactly one place.
--
-- No display label column. The two screens that show these products already
-- disagree with each other, "AQ Sensor" on Opportunity and "Air Quality" on
-- Test Bed, so a catalog label would be a third variant that neither reads:
-- written once, never read, and false the moment either screen is renamed.

create table if not exists public.base_cost_batches (
  id                    uuid          primary key default gen_random_uuid(),
  product               text          not null
                          check (product in ('safesight', 'air_quality', 'hemir')),
  batch_label           text          not null,
  effective_from        date          not null,
  unit_cost             numeric(12,2) not null check (unit_cost >= 0),
  install_cost_existing numeric(12,2) not null check (install_cost_existing >= 0),
  install_cost_new      numeric(12,2) not null check (install_cost_new >= 0),
  hosting_cost_month    numeric(12,2) not null check (hosting_cost_month >= 0),
  created_at            timestamptz   not null default now(),
  -- Two batches for one product cannot take effect on the same day. Without
  -- this, "the latest batch whose effective_from has passed" has two answers
  -- and the resolver picks by row order, which is not a decision anyone made.
  unique (product, effective_from)
);

comment on table public.base_cost_batches is
  'Base Cost Data: the product catalog the Opportunity Commercials tab mirrors. '
  'One row per product per manufacturing batch, because the business confirmed '
  'runs are per product and arrive at different times, so a row IS a batch '
  'rather than a third of one. Current is the latest row for a product whose '
  'effective_from has passed; a future-dated row is deliberately not current. '
  'Admin-managed as rows, same deferral as industries, contact_roles and '
  'closed_lost_reasons: select-only RLS, no write path from this application.';

comment on column public.base_cost_batches.effective_from is
  'The date this batch becomes the current cost for its product. Chosen over an '
  'active flag by the business: a flag holds only the present, so it cannot '
  'answer "which batch was current in March", which is the retracing the '
  'batches exist for. A date in the future is entered deliberately and is not '
  'current until it arrives.';

comment on column public.base_cost_batches.install_cost_existing is
  'Installing on infrastructure already in place, e.g. a lamppost that is '
  'already there. An INSTALLATION distinction, not a hardware one: unit_cost is '
  'the same either way. Applies on a per-unit installation basis only. Under a '
  'lump-sum contractor price the installation cost is the lump sum and this '
  'split does not apply, which is the Installation tab''s concern rather than '
  'this table''s.';

comment on column public.base_cost_batches.install_cost_new is
  'Installing where the infrastructure does not exist yet: new poles, new '
  'network. See install_cost_existing for why this is not a second unit cost.';

comment on column public.base_cost_batches.hosting_cost_month is
  'Cost per unit per month. The contract term multiplies it; the term is a deal '
  'field and is not held here.';

alter table public.base_cost_batches enable row level security;

-- Team-wide read, matching contact_roles and closed_lost_reasons exactly. No
-- insert, update or delete policy: deny-by-default is the admin-only decision
-- expressed in RLS rather than only in a route, so a future endpoint cannot
-- quietly become a write path without a migration saying so. It is also what
-- keeps a superseded batch unchanged, against the application. See the block
-- above for what it does NOT bind.
drop policy if exists "base_cost_batches_select" on public.base_cost_batches;
create policy "base_cost_batches_select" on public.base_cost_batches
  for select using (auth.uid() is not null);

-- WHERE NOT EXISTS rather than ON CONFLICT, per the standing rule that every
-- migration is written idempotently whatever the ledger is expected to
-- guarantee. The unique constraint on (product, effective_from) would make ON
-- CONFLICT work; the guard is written the same way throughout so a replay is
-- provably a no-op rather than relying on which constraint happens to exist.
--
-- The figures are the business's own, supplied in this round's brief. USD, and
-- there is no currency column: Bid Currency is a Structural Terms field on the
-- deal, that tab is not this round, and a column written once and read by
-- nothing is the defect this whole table exists to stop repeating.
--
-- 'Initial catalog' rather than an invented run number. These arrived as an
-- opening price list, not as a manufacturing run, and a plausible-looking fake
-- batch reference would be a claim with a shelf life.
insert into public.base_cost_batches
  (product, batch_label, effective_from, unit_cost, install_cost_existing, install_cost_new, hosting_cost_month)
select v.product, v.batch_label, v.effective_from::date, v.unit_cost, v.install_existing, v.install_new, v.hosting
from (values
  ('safesight',   'Initial catalog', '2026-08-27',   8000.00, 2000.00, 20000.00, 200.00),
  ('air_quality', 'Initial catalog', '2026-08-27',   2000.00,  500.00,  1000.00, 100.00),
  ('hemir',       'Initial catalog', '2026-08-27', 100000.00, 5000.00, 10000.00, 500.00)
) as v(product, batch_label, effective_from, unit_cost, install_existing, install_new, hosting)
where not exists (
  select 1 from public.base_cost_batches b
  where b.product = v.product and b.effective_from = v.effective_from::date
);
