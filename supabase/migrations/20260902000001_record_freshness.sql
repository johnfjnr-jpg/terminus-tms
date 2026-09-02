-- Terminus TMS: one freshness timestamp per record, maintained by trigger.
-- Round 41, tenth walk G2/G3. Ruled by the business 2026-09-02.
--
-- ─────────────────────────────────────────────────────────────
-- THE THREE-INSTANCE CLASS THIS CLOSES
-- ─────────────────────────────────────────────────────────────
--
-- The F4 background poll asks "has anything about this record changed" and read
-- two facts to answer it: records.status and max(record_revisions.revision_number).
-- That fact set turned out to be a CLAIM about which events matter, and it was
-- wrong three times in one feature:
--
--   1. A transition changes status and writes NO revision. Measured: before and
--      after a real transition, revision 2 both times, Qualification ->
--      Solution Alignment. Found by calibration.
--   2. The pulse's own response was adopted as a revision by the client's
--      adopt-and-warn hook, so the held value advanced before the comparison
--      ran. Measured: held revision 1 -> 2 with zero re-reads. Found by
--      calibration.
--   3. Approvals, raises and withdrawals touch NEITHER status nor revision.
--      Measured on the running app with the poll confirmed ticking: an approval
--      landed and the screen re-read 0 times in 16 seconds. Found by a walk,
--      because the probe had been built from the same assumption as the feature
--      and inherited its blind spot exactly.
--
-- ONE QUESTION, ONE SOURCE. A single trigger-maintained timestamp makes "did
-- anything about this record change" answerable without enumerating event types,
-- so the poll cannot be blind to an event CLASS again. This is Verification 43 -
-- read from the same source the enforcement writes - applied to freshness.
--
-- THE TRIGGER IS THE ENFORCEMENT, NOT APPLICATION CODE. Same reasoning as the
-- immutability and freeze triggers already in this schema: a trigger fires for
-- every role including BYPASSRLS, and for every writer including a dashboard
-- paste or a future route nobody has written yet. Bumping a column from the
-- application would be correct for every caller that exists and wrong for the
-- one about to be built (Architecture 8), which is the exact failure this
-- migration is repairing.
--
-- ─────────────────────────────────────────────────────────────
-- A NEW COLUMN RATHER THAN records.updated_at
-- ─────────────────────────────────────────────────────────────
--
-- `records.updated_at` already exists and NOTHING READS IT: measured, zero
-- references across src/ and frontend/. It was still the wrong column to reuse,
-- because the two answer different questions. `updated_at` means "this row
-- changed"; `freshness_at` means "anything about this record changed". Reusing
-- one name for both would make a later reader of `updated_at` silently wrong
-- about which it had, and they are not equal: an approval bumps the second and
-- must not bump the first.
--
-- ─────────────────────────────────────────────────────────────
-- WHICH TABLES, ENUMERATED FROM THE SCHEMA
-- ─────────────────────────────────────────────────────────────
--
-- Every table carrying record_id, found by querying rather than by memory:
-- record_revisions, approvals, transition_requests, audit_log,
-- deal_sheet_versions, record_contacts, document_details. All seven get the
-- trigger. audit_log is included deliberately: it is written on transitions and
-- decisions, so it is a real signal, and it is never written on a read path.
--
-- THE PULSE CANNOT FIRE ON ITSELF, and it needs no exclusion to be safe. The
-- route is a SELECT; it writes nothing, so no trigger fires. The
-- self-adoption trap in instance 2 was a CLIENT-side hook adopting the
-- response, which is fixed separately in app.js and is unrelated to this.

-- ── The column ────────────────────────────────────────────────────────────
alter table public.records
  add column if not exists freshness_at timestamptz not null default now();

-- Backfill, so an existing record is not permanently "fresher" or staler than
-- the truth. Guarded, so a replay is a no-op (Architecture 7).
update public.records
  set freshness_at = greatest(coalesce(updated_at, created_at), created_at)
  where freshness_at is null;

comment on column public.records.freshness_at is
  'Anything about this record changed at this time, including its satellites. '
  'Maintained by trigger only; never written by the application. Round 41 G2/G3.';

-- ── The bump ──────────────────────────────────────────────────────────────
create or replace function public.touch_record_freshness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id uuid;
begin
  -- Architecture 12: the function DERIVES what it acts on. The record id comes
  -- from the row that fired the trigger, never from an argument.
  if tg_op = 'DELETE' then
    v_record_id := old.record_id;
  else
    v_record_id := new.record_id;
  end if;

  if v_record_id is null then
    return coalesce(new, old);
  end if;

  update public.records
    set freshness_at = now()
    where id = v_record_id;

  return coalesce(new, old);
end;
$$;

-- The records table itself. A row update bumps its own freshness.
create or replace function public.touch_own_freshness()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Guarded against recursion: the satellite trigger updates records, which
  -- would fire this, which would update records again. Bumping only when the
  -- new value is not already now() would be fragile; comparing the OLD and NEW
  -- freshness directly is exact.
  if new.freshness_at is distinct from old.freshness_at then
    return new;
  end if;
  new.freshness_at := now();
  return new;
end;
$$;

drop trigger if exists records_touch_own_freshness on public.records;
create trigger records_touch_own_freshness
  before update on public.records
  for each row execute function public.touch_own_freshness();

-- ── The satellites, all seven ─────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'record_revisions', 'approvals', 'transition_requests', 'audit_log',
    'deal_sheet_versions', 'record_contacts', 'document_details'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_freshness', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I '
      'for each row execute function public.touch_record_freshness()',
      t || '_touch_freshness', t);
  end loop;
end $$;

-- Architecture 10: the ledger row, in the same paste.
insert into supabase_migrations.schema_migrations (version)
values ('20260902000001')
on conflict (version) do nothing;
