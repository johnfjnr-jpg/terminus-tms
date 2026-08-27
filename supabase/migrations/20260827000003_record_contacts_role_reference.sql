-- Terminus TMS: record_contacts gains a catalog reference and an escape
-- valve. Round 35 Phase 4.
--
-- ─────────────────────────────────────────────────────────────
-- TWO COLUMNS, NOT ONE, AND THE LIVE DATA IS WHY
-- ─────────────────────────────────────────────────────────────
--
-- A configured reference plus a separate free-text column is one shape; a
-- text column that usually holds a configured label is another. Round 35
-- Phase 2 asked the question the catalog exists for, "which roles do we cover
-- on deals we win", of the second shape, across all 459 rows in this table:
--
--   "commercial buyer"  written 2 ways, 390 rows: 350 lowercase + 40 as
--                       "Client Commercial Buyer"
--   "technical buyer"   written 2 ways,  31 rows: 28 "Client Technical
--                       Buyer" + 3 "Technical Buyer"
--
-- 2 of 4 distinct roles already split across more than one spelling, and a
-- GROUP BY returning 6 rows for 4 real roles, WITH NO FREE-TEXT FEATURE IN
-- THE PRODUCT AT ALL. That divergence arrived from two independently-built
-- writers. Adding an escape valve to the same column would make it worse by
-- design.
--
-- So: role_id for tiers 1 and 2 of the buyer-role model, role_other for tier
-- 3. "Which roles do we cover" becomes a join, free text is a visibly
-- separate bucket rather than silent misspellings of catalog members, and
-- admin can see which text keeps recurring, which is the only thing that
-- makes promotion into the catalog possible.
--
-- ─────────────────────────────────────────────────────────────
-- role LOSES ITS NOT NULL AND KEEPS ITS COLUMN
-- ─────────────────────────────────────────────────────────────
--
-- THE COLUMN MUST SURVIVE. Three live contact_role_linked gate rules on
-- test_bed match through it: the evaluator in transitions.js reads
-- .eq('role', role) against requirement_detail->>'role'. Test Bed is out of
-- scope for this round and its rows are not migrated, so they keep their text
-- and the gates keep matching.
--
-- Dropping the NOT NULL is additive: every existing row keeps its value, and
-- nothing that reads the column sees a difference. The alternative, writing a
-- denormalised label into `role` alongside role_id, creates two sources for
-- one fact and goes stale the moment admin renames a catalog row, which is
-- Architecture rule 8's fourth variant with a migration on the other end.
--
-- ─────────────────────────────────────────────────────────────
-- THE UNIQUE CONSTRAINT STOPS CONSTRAINING, AND THIS IS THE PHASE THAT CAN
-- PROVE IT
-- ─────────────────────────────────────────────────────────────
--
-- unique (record_id, contact_id, role) governs Test Bed's rows and every row
-- written before this migration. Postgres treats nulls as distinct in a
-- unique constraint by default, so the moment a row carries a null role that
-- constraint permits an unlimited number of duplicates.
--
-- Phase 3 named this as a property to VERIFY rather than assume, because no
-- null-role row existed yet. This is the phase that creates one, so it is the
-- phase that tests it: the test inserts the same (record_id, contact_id,
-- role_id) twice and requires the second to be refused, and separately
-- confirms the old constraint does NOT refuse two null-role rows, which is
-- what makes the partial indexes necessary rather than decorative.
--
-- Partial rather than plain, because a plain unique on (record_id,
-- contact_id, role_id) would have the identical null problem one column over.

alter table public.record_contacts
  add column if not exists role_id uuid references public.contact_roles(id);

alter table public.record_contacts
  add column if not exists role_other text;

alter table public.record_contacts
  alter column role drop not null;

comment on column public.record_contacts.role is
  'The ORIGINAL free-text role, and still the only one Test Bed writes. '
  'Three live contact_role_linked gate rules match through this column, so '
  'it is not migrated and not dropped. Null on any row written by the Key '
  'Customer Contacts panel, which uses role_id or role_other instead.';

comment on column public.record_contacts.role_id is
  'A role from the contact_roles catalog. Tiers 1 and 2 of the buyer-role '
  'model in DESIGN_PRINCIPLES.md. Referenced by uuid rather than by label '
  'because the label is what diverged: see this migration''s header.';

comment on column public.record_contacts.role_other is
  'A role typed on this deal because the catalog does not carry it yet. '
  'Tier 3, the escape valve. NOT a lesser fact about the deal: it is the '
  'evidence admin needs in order to know what to add to the catalog, which '
  'is the whole reason the escape valve survives.';

-- Exactly one of the three. Not NOT VALID: every existing row has role set
-- and both new columns null, so all 459 satisfy it today and the constraint
-- can be validated immediately rather than exempting the rows it was written
-- for. A NOT VALID constraint governs writes only from the moment it lands,
-- which Round 11 Phase 7 already recorded as a property worth being explicit
-- about.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'record_contacts_one_role_source'
  ) then
    alter table public.record_contacts
      add constraint record_contacts_one_role_source
      check (num_nonnulls(role, role_id, role_other) = 1);
  end if;
end $$;

-- The partial replacements for what unique (record_id, contact_id, role)
-- stops enforcing once role is null.
--
-- ONE CONTACT MAY HOLD TWO ROLES ON ONE DEAL, and two contacts may hold the
-- same role: those are the shapes a list exists for. What is refused is the
-- same contact holding the SAME role twice on the same record, which is a
-- duplicate row rather than a fact.
create unique index if not exists record_contacts_record_contact_role_id_uniq
  on public.record_contacts (record_id, contact_id, role_id)
  where role_id is not null;

create unique index if not exists record_contacts_record_contact_role_other_uniq
  on public.record_contacts (record_id, contact_id, role_other)
  where role_other is not null;
