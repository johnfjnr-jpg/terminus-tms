-- Terminus TMS: record_contacts
--
-- The Contact <-> Opportunity/Test Bed many-to-many join table named in
-- DESIGN_PRINCIPLES.md Section 2 (line 163) and deliberately deferred out
-- of 20260812000001_contact_account.sql - Contact -> Account is an
-- ordinary single-parent parent_record_id relationship, but a Contact
-- attaching to more than one Opportunity/Test Bed over time (or holding
-- more than one role on the same one) doesn't fit that shape, hence its
-- own join table rather than another parent_record_id use.
--
-- contact_id references records.id directly, not scoped to
-- record_type='contact' - per DESIGN_PRINCIPLES.md, Lead and Contact are
-- "the same record throughout, no structural change", so the 8
-- historically-converted Lead rows this table is about to be backfilled
-- with (still carrying record_type='lead', predating today's Contact
-- migration) are valid contact_id values as-is. Confirmed with John before
-- writing this migration - relabeling those Lead rows to record_type
-- 'contact' is a separate, larger, non-additive change and stays out of
-- scope here.
create table public.record_contacts (
  id          uuid primary key default gen_random_uuid(),
  record_id   uuid not null references public.records(id) on delete restrict,
  contact_id  uuid not null references public.records(id) on delete restrict,
  role        text not null,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  unique (record_id, contact_id, role)
);

comment on table public.record_contacts is
  'Contact <-> Opportunity/Test Bed many-to-many, role per link (commercial '
  'buyer, end user, technical buyer, IT/Security, procurement, ...). Not '
  'parent_record_id - a Contact can hold roles across more than one record '
  'over time, see DESIGN_PRINCIPLES.md Section 2.';

create index record_contacts_record_id_idx on public.record_contacts(record_id);
create index record_contacts_contact_id_idx on public.record_contacts(contact_id);

alter table public.record_contacts enable row level security;

-- Immutable, same convention as record_revisions/approvals/audit_log - no
-- UPDATE or DELETE policies (deny-by-default). A wrong role/link is
-- corrected by adding the right row, not editing this one.
create policy "record_contacts_select" on public.record_contacts
  for select using (
    auth.uid() = (select owner_id from public.records where id = record_id)
  );

create policy "record_contacts_insert" on public.record_contacts
  for insert with check (
    auth.uid() = created_by
    and auth.uid() = (select owner_id from public.records where id = record_id)
  );

-- Backfill: the 8 historically-converted Leads (record_type='lead',
-- status='converted') each linked to the one downstream Opportunity/Test
-- Bed created from it via the old leads.js /convert and
-- /convert-to-test-bed endpoints (confirmed via a real read-only query
-- during the Rule-8 frontend audit - parent_record_id on each of these 8
-- traces back to exactly one of these 8 Leads, and stays untouched by this
-- migration). Role defaults to 'commercial buyer' - the person who was the
-- point of contact on the original Lead is presumed to be the commercial
-- buyer on the resulting deal, per John's steer; this is a default, not a
-- verified fact, and can be corrected per-record later without touching
-- these rows.
insert into public.record_contacts (record_id, contact_id, role, created_by) values
  ('9f734179-f774-42f4-97e9-1fbe61e6ecd0', 'eeff347d-5786-47cb-93d4-b02f8f989704', 'commercial buyer', (select owner_id from public.records where id = 'eeff347d-5786-47cb-93d4-b02f8f989704')),
  ('da114673-bee2-4b1d-860c-cee0f662b5e5', '3287e43b-ea48-45c5-8529-a41dc6d194b2', 'commercial buyer', (select owner_id from public.records where id = '3287e43b-ea48-45c5-8529-a41dc6d194b2')),
  ('a52ee709-0d81-47c2-9b3a-51153eac21c6', '2b385724-5ed6-454e-a791-0baaa353c308', 'commercial buyer', (select owner_id from public.records where id = '2b385724-5ed6-454e-a791-0baaa353c308')),
  ('e8ce30cd-b911-4c32-9098-33fb90da0fc2', '0663e6c8-5d88-43cd-bfc2-cacbb4083824', 'commercial buyer', (select owner_id from public.records where id = '0663e6c8-5d88-43cd-bfc2-cacbb4083824')),
  ('64a42c09-8353-4242-a9d2-9e88b1f6af51', '9ad1c3c1-e949-44b6-b240-991882ebf325', 'commercial buyer', (select owner_id from public.records where id = '9ad1c3c1-e949-44b6-b240-991882ebf325')),
  ('a8bfb7e7-b04d-4d0d-9322-b676b9a2789a', 'bf525283-4e8a-42ad-ba5a-a5f0ab52700d', 'commercial buyer', (select owner_id from public.records where id = 'bf525283-4e8a-42ad-ba5a-a5f0ab52700d')),
  ('eb53495a-edd3-41f0-a5e6-9629ba2f4067', '51958b3b-c8a6-4504-a3a3-cf1755ab456e', 'commercial buyer', (select owner_id from public.records where id = '51958b3b-c8a6-4504-a3a3-cf1755ab456e')),
  ('8de3b15a-8c0f-45ec-9425-43b153e05f9c', '876c62ae-2e26-4960-b361-0f925d5d222c', 'commercial buyer', (select owner_id from public.records where id = '876c62ae-2e26-4960-b361-0f925d5d222c'));
