-- Terminus TMS: freshness moves OFF the records table. Round 41, tenth walk.
--
-- ─────────────────────────────────────────────────────────────
-- THIS CORRECTS 20260902000001, WHICH BROKE THE WORKFLOW
-- ─────────────────────────────────────────────────────────────
--
-- APPLY THIS. Until it is applied, RAISING A TRANSITION REQUEST FAILS with a
-- 500 on every record, because the previous migration's trigger cannot write.
--
-- WHAT WENT WRONG, measured by the gate rather than reasoned about:
--
--   FAIL  database suite                     91/92, "a concurrent append failed"
--   FAIL  HTTP commercial-gate probe
--   FAIL  HTTP zero-track transition probe   "4. a three-track transition OPENS
--                                             and waits" -> 500 "This record is
--                                             frozen: a transition to Proposal
--                                             is awaiting approval."
--
-- ONE CAUSE, TWO SYMPTOMS: the trigger bumped a column ON public.records.
--
--   1. `refuse_write_while_frozen` is attached to `records` and refuses EVERY
--      write while an open transition request exists. Inserting a transition
--      request fired the freshness bump, the bump was an update to `records`,
--      and the guard saw the request that had just been inserted and refused -
--      taking the insert down with it. THE FEATURE MADE RAISING A REQUEST
--      IMPOSSIBLE, and it did it through a control that was working correctly.
--
--   2. `append_record_revision` holds a pg_advisory_xact_lock and then inserts.
--      Adding an update of the SAME records row inside that transaction put
--      forty concurrent appends in a queue for one row, in an order the
--      advisory lock does not govern. One of forty failed.
--
-- THE LESSON, and it is Architecture 8 arriving from the schema side: a trigger
-- that writes to a heavily-guarded table inherits every guard on it. `records`
-- carries a freeze guard, an immutability guard and an advisory-lock protocol,
-- and a freshness bump has business with none of them.
--
-- SO FRESHNESS GETS ITS OWN TABLE. Nothing else writes it, nothing guards it,
-- and it cannot collide with a protocol it is not part of. The pulse reads it
-- through a join and writes nothing, so the self-adoption trap stays closed by
-- construction.

-- ── Undo the previous migration's mechanism ───────────────────────────────
drop trigger if exists records_touch_own_freshness on public.records;
do $$
declare t text;
begin
  foreach t in array array[
    'record_revisions', 'approvals', 'transition_requests', 'audit_log',
    'deal_sheet_versions', 'record_contacts', 'document_details'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_freshness', t);
  end loop;
end $$;
drop function if exists public.touch_own_freshness();
-- The bump function is REPLACED below rather than dropped, because the new
-- triggers reuse the name.

alter table public.records drop column if exists freshness_at;

-- ── The freshness table ───────────────────────────────────────────────────
create table if not exists public.record_freshness (
  record_id    uuid primary key references public.records(id) on delete cascade,
  freshness_at timestamptz not null default now()
);

comment on table public.record_freshness is
  'Anything about this record changed at this time, including its satellites. '
  'Maintained by trigger only and never written by the application. Deliberately '
  'NOT a column on records: a bump there inherits the freeze guard and the '
  'append advisory lock, and broke both. Round 41 G2/G3.';

alter table public.record_freshness enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                 where tablename = 'record_freshness' and policyname = 'record_freshness_read') then
    -- Mirrors records_select: read access is team-wide, and this table says
    -- strictly less than the record it points at.
    create policy record_freshness_read on public.record_freshness
      for select using (auth.uid() is not null);
  end if;
end $$;

-- Every existing record gets a row, so a reader never has to distinguish
-- "never touched" from "no row yet". Guarded, so a replay is a no-op.
insert into public.record_freshness (record_id, freshness_at)
select r.id, greatest(coalesce(r.updated_at, r.created_at), r.created_at)
from public.records r
on conflict (record_id) do nothing;

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
  -- Architecture 12: the function DERIVES what it acts on, from the row that
  -- fired it, never from an argument.
  if tg_op = 'DELETE' then
    v_record_id := old.record_id;
  elsif tg_table_name = 'records' then
    v_record_id := new.id;
  else
    v_record_id := new.record_id;
  end if;

  if v_record_id is null then
    return coalesce(new, old);
  end if;

  insert into public.record_freshness (record_id, freshness_at)
  values (v_record_id, now())
  on conflict (record_id) do update set freshness_at = now();

  return coalesce(new, old);
end;
$$;

-- ── The records table itself, AFTER so it cannot affect the write ─────────
--
-- AFTER rather than BEFORE, and writing a different table, so this cannot
-- interact with the freeze guard or the immutability guards that run BEFORE on
-- this table. A frozen record refuses its own edit before reaching here, which
-- is correct: nothing changed, so nothing is fresher.
drop trigger if exists records_touch_freshness on public.records;
create trigger records_touch_freshness
  after insert or update on public.records
  for each row execute function public.touch_record_freshness();

-- ── The satellites, all seven ─────────────────────────────────────────────
do $$
declare t text;
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
values ('20260902000002')
on conflict (version) do nothing;
