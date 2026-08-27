-- Terminus TMS: the Key Customer Contacts role vocabulary. Round 35 Phase 2.
--
-- Nine roles, each naming a FUNCTION someone holds in their organisation
-- regardless of this deal. Configuration only: nothing writes to this table in
-- this phase, and the panel that reads it arrives in Phase 3.
--
-- ─────────────────────────────────────────────────────────────
-- WHY THIS EXISTS, AND WHAT IT REPLACES
-- ─────────────────────────────────────────────────────────────
--
-- Opportunity has carried four fixed buyer slots since Round 3 Phase 3:
-- Technical, Commercial, Legal and IT / Security Buyer, held as a role string
-- on record_contacts and validated against a hardcoded array in two places
-- (BUYER_ROLES in opportunity-reference.js, VALID_OPPORTUNITY_BUYER_ROLES in
-- routes/opportunities.js).
--
-- FOUR SLOTS AND A LIST OF PEOPLE ARE DIFFERENT THINGS. Four slots say there
-- are four buyer roles, fill them in. A list says who are you talking to and
-- what part do they play, and it can hold two technical evaluators, or an
-- economic buyer who is also the champion, or eleven people at a large
-- account. Multi-threading is measurable in a list and invisible in four
-- slots: four slots with three filled read the same whether the deal knows
-- three people or thirty.
--
-- This is the tier-2 catalog of the three-tier buyer-role model recorded in
-- DESIGN_PRINCIPLES.md on 2026-08-15 and confirmed-but-unbuilt through nine
-- rounds since. The model is intact and unsuperseded:
--
--   tier 1  core roles, always the same, sourced from a controlled vocabulary
--   tier 2  an admin-curated catalog, THIS TABLE
--   tier 3  a free-text escape valve typed on the specific deal
--
-- ─────────────────────────────────────────────────────────────
-- ADMIN-CURATED MEANS ADMIN-CURATED. No inline creation.
-- ─────────────────────────────────────────────────────────────
--
-- Round 35's brief proposed that any user be able to create a role from the
-- panel, with a system-wide effect confirmation, citing the prototype's
-- Industry escape valve as the precedent. Phase 0 found the precedent does not
-- transfer, in three ways that each stand alone: it writes into Admin -
-- Picklists, a screen PROTOTYPE_SPECIFICATION.md Section 7 puts out of v1 and
-- which does not exist in this build; it is gated to a CTO or CEO project
-- role, with everyone else able only to flag "needs review"; and it carries a
-- mandatory six-character code as deliberate friction, for which a role has no
-- equivalent.
--
-- So inline creation as proposed meant any user adding a permanent row nobody
-- in this app can remove. Refused by the business on that finding. This table
-- is edited through Supabase's own editor until an Admin module exists, the
-- same deferral industries, terminus_staff, stage_gate_rules and
-- closed_lost_reasons already carry.
--
-- Tier 3 is unaffected and survives: a salesperson meeting a role outside
-- these nine types it on the deal, and admin promotes the recurring ones into
-- this table later. That is how the catalog learns what to add.
--
-- ─────────────────────────────────────────────────────────────
-- SHAPED ON closed_lost_reasons, NOT ON scoring_lenses
-- ─────────────────────────────────────────────────────────────
--
-- The brief named both as the precedent. They are different shapes and only
-- one of them is right here:
--
--   closed_lost_reasons   id, label, sort_order, ACTIVE, created_at
--   scoring_lenses        id, name,  sort_order,         created_at
--
-- scoring_lenses has no active flag, so retiring a lens means deleting a row
-- that live criteria reference. A role list needs retirement without deletion,
-- because a role dropped from the catalog is still the truth about the deal
-- that recorded it.
--
-- ─────────────────────────────────────────────────────────────
-- A UUID, REFERENCED BY THE LINK ROW. NOT A TEXT NATURAL KEY.
-- ─────────────────────────────────────────────────────────────
--
-- Same conclusion closed_lost_reasons reached, and here it is not a
-- precaution, it is a repair. record_contacts.role is text today, and the
-- question this catalog exists to answer, "which roles do we cover on deals we
-- win", is ALREADY broken by it. Measured across all 459 live rows in Phase 2:
--
--   "commercial buyer"  is written 2 ways, 390 rows: 350 lowercase + 40 as
--                       "Client Commercial Buyer"
--   "technical buyer"   is written 2 ways,  31 rows: 28 as "Client Technical
--                       Buyer" + 3 as "Technical Buyer"
--
-- 2 of 4 distinct roles are already split across more than one spelling, and a
-- GROUP BY on that column returns 6 rows for 4 real roles. That divergence
-- arrived from two independently-built writers with no free-text feature in
-- the product at all. Adding one to a text column would make it worse by
-- design.
--
-- So the link row carries a uuid reference for a catalog role and a SEPARATE
-- free-text column for tier 3, rather than one text column that usually holds
-- a catalog label. The first is queryable and the second is not: with two
-- columns, "which roles do we cover" is a join, and the free-text entries are
-- a visibly separate bucket rather than silent misspellings of catalog
-- members. That is also what makes promotion possible later, since admin can
-- see exactly which text keeps recurring.
--
-- Phase 3 builds that link-row change. It is named here because it is the
-- reason this table is uuid-keyed.

create table if not exists public.contact_roles (
  id          uuid        primary key default gen_random_uuid(),
  label       text        not null unique,
  sort_order  integer     not null,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.contact_roles is
  'The Key Customer Contacts role vocabulary: the FUNCTION a person holds in '
  'their own organisation, independent of this deal. Tier 2 of the three-tier '
  'buyer-role model in DESIGN_PRINCIPLES.md. Referenced by uuid from the link '
  'row, never matched by label, because record_contacts.role already proves a '
  'text key diverges. Admin-managed as rows, same deferral as industries and '
  'closed_lost_reasons: no inline creation, refused deliberately in Round 35 '
  'Phase 0.';

comment on column public.contact_roles.active is
  'False retires a role from the picker without deleting it. A role cited by '
  'a live deal is never deleted: the deal would be left pointing at nothing. '
  'This column is the difference between this table and scoring_lenses, and '
  'the reason closed_lost_reasons was the shape copied.';

alter table public.contact_roles enable row level security;

-- Team-wide read, matching closed_lost_reasons exactly. No insert, update or
-- delete policy: deny-by-default is the admin-only decision expressed in RLS
-- rather than only in a route, so a future endpoint cannot quietly become an
-- inline-creation path without a migration saying so.
drop policy if exists "contact_roles_select" on public.contact_roles;
create policy "contact_roles_select" on public.contact_roles
  for select using (auth.uid() is not null);

-- WHERE NOT EXISTS rather than ON CONFLICT, per Round 20 Phase 0 and the
-- standing rule that every migration is written idempotently whatever the
-- ledger is expected to guarantee. The unique constraint on label would make
-- ON CONFLICT work, but the guard is written the same way throughout so a
-- replay is provably a no-op rather than relying on which constraint happens
-- to exist.
--
-- Nine, not ten. Phase 0 proposed Pain Owner as a tenth role to close the gap
-- against the live Organisational criterion "Internal pain owner". The
-- business moved it to stance instead: the person whose problem this is has a
-- job title, and whose problem it is is a posture. Same argument that keeps
-- Champion out of this list. See 20260827000002_contact_stances.sql.
insert into public.contact_roles (label, sort_order)
select v.label, v.sort_order
from (values
  ('Executive Sponsor', 10),
  ('Technical Buyer',   20),
  ('Commercial Buyer',  30),
  ('Procurement',       40),
  ('Legal',             50),
  ('IT',                60),
  ('Cyber Sec',         70),
  ('QHSE',              80),
  ('DPO',               90)
) as v(label, sort_order)
where not exists (
  select 1 from public.contact_roles r where r.label = v.label
);
