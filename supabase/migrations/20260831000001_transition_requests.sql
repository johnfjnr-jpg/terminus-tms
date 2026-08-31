-- Terminus TMS: the stage approvals workflow. Round 41, walk findings.
--
-- ─────────────────────────────────────────────────────────────
-- WHAT THIS REPLACES, AND WHY IT IS A DELETION RATHER THAN A FIX
-- ─────────────────────────────────────────────────────────────
--
-- Approvals were keyed to a RECORD REVISION, and two rounds ruled differently
-- about what that meant: Round 7 made them stage-scoped, so an approval survived
-- every edit; Round 38 made the Commercial track version-scoped, so any revision
-- after an approval voided it. Both were correct where they were made and
-- nothing detected the conflict (CLAUDE.md Verification 23).
--
-- The re-price-and-version walk then failed on the third symptom of the same
-- root: a record advanced three revisions under the user's own hand, through
-- panels whose writes do not participate in the revision handshake, while the
-- Commercials tab held an older number.
--
-- ─────────────────────────────────────────────────────────────
-- THE MODEL: A REQUEST IS OF A FROZEN STATE
-- ─────────────────────────────────────────────────────────────
--
-- A salesperson REQUESTS a transition. The record freezes. Approvals bind to the
-- REQUEST, not to a revision, so there is no revision for a later edit to move
-- out from under them. Any rejection closes the request and unfreezes. When every
-- required track has approved, the transition executes.
--
-- The scope question disappears rather than being answered: with nothing editable
-- while a request is open, "does this approval still describe the deal" has one
-- answer and it is yes.
--
-- ─────────────────────────────────────────────────────────────
-- AN EXTENSION OF THE RECORDS ENGINE, NOT A FORK
-- ─────────────────────────────────────────────────────────────
--
-- transition_requests is keyed to `records`, like every other satellite table,
-- and carries `record_type` only so the freeze trigger can resolve fast. The
-- workflow is enabled for opportunity today and that is ROUTING, not schema: the
-- object is generic so a later record type is configuration.
--
-- Architecture 7: every statement here is idempotent.

-- ─────────────────────────────────────────────────────────────
-- 1. THE REQUEST
-- ─────────────────────────────────────────────────────────────

create table if not exists public.transition_requests (
  id                uuid primary key default gen_random_uuid(),
  record_id         uuid not null references public.records(id) on delete restrict,
  record_type       text not null,
  from_stage        text not null,
  to_stage          text not null,
  -- 'transition' freezes the record and executes on full approval.
  -- 'review' is the reissue case: same object, no freeze, no transition.
  kind              text not null default 'transition' check (kind in ('transition', 'review')),
  status            text not null default 'open' check (status in ('open', 'approved', 'rejected', 'withdrawn')),
  -- The revision this request is OF. Meaningful because the record cannot move
  -- while the request is open.
  frozen_revision   integer not null check (frozen_revision > 0),
  -- Proposal -> Evaluation approves an ISSUED VERSION rather than a revision.
  frozen_version_id uuid references public.deal_sheet_versions(id) on delete restrict,
  requested_by      uuid not null references auth.users(id),
  requested_at      timestamptz not null default now(),
  closed_by         uuid references auth.users(id),
  closed_at         timestamptz,
  close_reason      text,
  -- A REJECTION AND A WITHDRAWAL BOTH NEED A REASON, and it is a table check
  -- rather than a route rule: the route can be bypassed by the service role and
  -- this cannot. Ruled by the business 2026-08-31.
  constraint transition_requests_reason_on_close check (
    status in ('open', 'approved')
    or (close_reason is not null and length(btrim(close_reason)) > 0)
  ),
  -- A closed request records who closed it and when, or it is not evidence of
  -- anything. Same shape as deal_sheet_versions_issued_complete.
  constraint transition_requests_close_complete check (
    (status = 'open' and closed_by is null and closed_at is null)
    or (status <> 'open' and closed_by is not null and closed_at is not null)
  )
);

-- ONE OPEN TRANSITION REQUEST PER RECORD, in the database rather than in a
-- route. A review request does not freeze, so it is not constrained here: a
-- record may carry several.
create unique index if not exists transition_requests_one_open
  on public.transition_requests (record_id)
  where status = 'open' and kind = 'transition';

create index if not exists transition_requests_record
  on public.transition_requests (record_id, status);

create index if not exists transition_requests_open_queue
  on public.transition_requests (status, requested_at)
  where status = 'open';

comment on table public.transition_requests is
  'A request to move a record to another stage, approved track by track. While a '
  'transition request is open the record is FROZEN: refuse_write_while_frozen() '
  'refuses every write to the tables that carry its state, for every role.';

-- ─────────────────────────────────────────────────────────────
-- 2. APPROVALS BIND TO THE REQUEST
-- ─────────────────────────────────────────────────────────────
--
-- The column is nullable and the 882 existing rows keep a null. They are HISTORY
-- and the gate does not read them, ruled by the business 2026-08-31. Nothing is
-- deleted and nothing is migrated: an approval that meant something under the
-- old model still says who decided what and when.

alter table public.approvals
  add column if not exists request_id uuid references public.transition_requests(id) on delete restrict;

-- (request, track), NOT (request, track, approver). One approval per track is
-- the point of the model, so a second approver on the same track is refused
-- rather than silently added beside the first.
create unique index if not exists approvals_one_per_request_track
  on public.approvals (request_id, track)
  where request_id is not null;

comment on column public.approvals.request_id is
  'The transition request this approval decides. Null on the 882 rows that '
  'predate the workflow; those are history and no gate reads them.';

-- ─────────────────────────────────────────────────────────────
-- 3. WHO MAY APPROVE A TRACK, AS DATA
-- ─────────────────────────────────────────────────────────────
--
-- Ruled by the business 2026-08-31. Today one person holds all three tracks, and
-- that is exactly why it is a TABLE rather than a constant: the moment a second
-- approver exists the answer changes without a deploy.
--
-- Roles per opportunity are later work and populate this same table with a
-- record_id rather than a null, which is why record_id exists now and is
-- nullable: a null means "on every record of this type".

create table if not exists public.track_approvers (
  id          uuid primary key default gen_random_uuid(),
  record_type text not null,
  track       text not null,
  -- Null means every record of this type. A value scopes the approver to one
  -- record, which is what roles-per-opportunity will write.
  record_id   uuid references public.records(id) on delete cascade,
  user_id     uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create unique index if not exists track_approvers_unique
  on public.track_approvers (record_type, track, coalesce(record_id, '00000000-0000-0000-0000-000000000000'::uuid), user_id);

comment on table public.track_approvers is
  'Who may approve a track. record_id null means every record of that type; a '
  'value scopes it to one record, which is how roles per opportunity will land. '
  'DELEGATION OF RESPONSIBILITY is a deferred item and will be its own table '
  'pointing at this one, not a second kind of row here.';

-- The seed. John on all three tracks, every opportunity.
insert into public.track_approvers (record_type, track, record_id, user_id)
select 'opportunity', t, null, '75425a02-4750-470b-bcdc-fe83d0b01ac2'::uuid
from (values ('Commercial'), ('Technical'), ('Legal')) as v(t)
where not exists (
  select 1 from public.track_approvers a
  where a.record_type = 'opportunity' and a.track = v.t
    and a.record_id is null and a.user_id = '75425a02-4750-470b-bcdc-fe83d0b01ac2'::uuid
);

-- ─────────────────────────────────────────────────────────────
-- 4. THE FREEZE, AS A TRIGGER
-- ─────────────────────────────────────────────────────────────
--
-- A TRIGGER AND NOT A POLICY, and not a route guard, for the reason
-- 20260827000007 already measured: Postgres exempts BYPASSRLS roles from every
-- policy and Supabase's service role has it, so a USING (false) policy refuses
-- the application and nothing else. Triggers fire for every role.
--
-- PER-TABLE RESOLVERS, AND THE DEFAULT IS REFUSE. The first draft of this
-- function read coalesce(new.record_id, old.record_id) for every table. Measured
-- against the sixteen write endpoints, TWO TABLES HAVE NO record_id COLUMN:
-- record_contact_stances reaches its record through record_contacts, and
-- `records` is keyed by id. On both, that draft would have returned early and
-- PERMITTED every write the freeze exists to refuse. It failed OPEN, which is
-- the wrong direction, and it was reachable from four of the sixteen endpoints.
--
-- So each table names how it reaches its record, and a table this function is
-- attached to without a resolver RAISES rather than permits.

create or replace function public.refuse_write_while_frozen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record uuid;
  v_to_stage text;
  v_row record;
begin
  v_row := coalesce(new, old);

  -- THE RESOLVER. Named per table, and the else branch refuses.
  if tg_table_name = 'records' then
    v_record := v_row.id;
  elsif tg_table_name in ('record_revisions', 'opportunity_details', 'deal_sheet_versions', 'record_contacts') then
    v_record := v_row.record_id;
  elsif tg_table_name = 'record_contact_stances' then
    select rc.record_id into v_record
    from public.record_contacts rc
    where rc.id = v_row.record_contact_id;
  else
    raise exception
      'refuse_write_while_frozen is attached to %, which has no resolver. '
      'Add one rather than letting the freeze pass silently.', tg_table_name
      using errcode = 'PT500';
  end if;

  if v_record is null then
    return v_row;
  end if;

  select tr.to_stage into v_to_stage
  from public.transition_requests tr
  where tr.record_id = v_record
    and tr.status = 'open'
    and tr.kind = 'transition'
  limit 1;

  if v_to_stage is null then
    return v_row;
  end if;

  -- PT423, deliberately not PT409. A conflict says "reload and try again"; a
  -- freeze says "this is waiting for somebody else", and the two need different
  -- words on the screen.
  raise exception
    'This record is frozen: a transition to % is awaiting approval. '
    'Withdraw the request to edit it.', v_to_stage
    using errcode = 'PT423';
end $$;

comment on function public.refuse_write_while_frozen() is
  'Refuses every write to a record with an open transition request, for every '
  'role including the service role. approvals and audit_log carry no trigger: '
  'they are the writes the freeze exists to permit.';

-- ─────────────────────────────────────────────────────────────
-- 5. ATTACHED TO THE SIX TABLES THAT CARRY RECORD STATE
-- ─────────────────────────────────────────────────────────────
--
-- Measured from the sixteen write endpoints rather than listed from memory.
-- approvals and audit_log are deliberately absent.
--
-- `records` is UPDATE only: an insert creates a record that cannot yet have a
-- request, and a delete is refused by foreign keys anyway.

do $$
declare t text;
begin
  foreach t in array array['record_revisions', 'opportunity_details', 'deal_sheet_versions',
                           'record_contacts', 'record_contact_stances']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_frozen_trg', t);
    execute format(
      'create trigger %I before insert or update or delete on public.%I '
      'for each row execute function public.refuse_write_while_frozen()',
      t || '_frozen_trg', t);
  end loop;
end $$;

drop trigger if exists records_frozen_trg on public.records;
create trigger records_frozen_trg
  before update on public.records
  for each row execute function public.refuse_write_while_frozen();

-- ─────────────────────────────────────────────────────────────
-- 6. RLS
-- ─────────────────────────────────────────────────────────────
--
-- Readable by any authenticated user, like approvals: a request and its
-- outcome are part of the record's history. Writes go through the routes, which
-- are the only place the "requester may never approve their own request" rule
-- can be expressed, since it compares two rows.

alter table public.transition_requests enable row level security;
alter table public.track_approvers enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'transition_requests' and policyname = 'transition_requests_read') then
    create policy transition_requests_read on public.transition_requests
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'track_approvers' and policyname = 'track_approvers_read') then
    create policy track_approvers_read on public.track_approvers
      for select to authenticated using (true);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- AND THE LEDGER ROW, IN THE SAME PASTE
-- ─────────────────────────────────────────────────────────────
--
-- Architecture 10. Applying this through the Supabase dashboard does NOT write
-- to supabase_migrations.schema_migrations, so the schema and the ledger would
-- disagree from that moment and nothing in the application could see it. One
-- paste, two statements: safe under both paths, because `supabase db push`
-- writes the row itself and the ON CONFLICT makes this a no-op.
insert into supabase_migrations.schema_migrations (version)
values ('20260831000001')
on conflict (version) do nothing;
