-- Terminus TMS: Initial Schema
-- Apply via:
--   npx supabase db push          (Supabase CLI — applies migrations)
--   npx supabase db seed          (run seeds/001_smoke_test.sql after this)
-- Or paste the full file into the Supabase Dashboard SQL editor.

-- ─────────────────────────────────────────────────────────────
-- Tables
-- Order: approval_tracks first (referenced by FK in other tables)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.approval_tracks (
  track_name  text        primary key,
  description text,
  created_at  timestamptz not null default now()
);
comment on table public.approval_tracks is
  'Admin-managed list of approval tracks (Commercial, Technical, Legal, etc.). '
  'Not hardcoded in application code — adding a new track is a data edit.';

create table if not exists public.records (
  id               uuid        primary key default gen_random_uuid(),
  record_type      text        not null,
  parent_record_id uuid        references public.records(id) on delete restrict,
  status           text        not null,
  owner_id         uuid        not null references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.records is
  'Core generic table. Every business object — lead, opportunity, deal, expense, '
  'asset, anything — is a record distinguished by record_type.';

create table if not exists public.record_revisions (
  id              uuid        primary key default gen_random_uuid(),
  record_id       uuid        not null references public.records(id) on delete restrict,
  revision_number integer     not null,
  payload         jsonb       not null default '{}',
  created_by      uuid        not null references auth.users(id),
  created_at      timestamptz not null default now(),
  unique (record_id, revision_number)
  -- Immutable: no UPDATE or DELETE RLS policies are defined. Writes are
  -- blocked by RLS deny-by-default once a row is inserted.
);

create table if not exists public.approvals (
  id              uuid        primary key default gen_random_uuid(),
  record_id       uuid        not null references public.records(id) on delete restrict,
  revision_number integer     not null,
  track           text        not null references public.approval_tracks(track_name),
  tier            integer,
  approver_id     uuid        not null references auth.users(id),
  decision        text        not null check (decision in ('approved', 'rejected')),
  comment         text,
  decided_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  -- One decision per (record, revision, track, approver).
  -- Tier-based tracks (Commercial) may have multiple rows with different approver_ids
  -- and tiers; direct tracks (Technical, Legal) have one row per revision.
  unique (record_id, revision_number, track, approver_id)
);

create table if not exists public.audit_log (
  id          uuid        primary key default gen_random_uuid(),
  record_id   uuid        not null references public.records(id) on delete restrict,
  record_type text        not null,
  action      text        not null,
  actor_id    uuid        not null references auth.users(id),
  timestamp   timestamptz not null default now(),
  detail      jsonb       not null default '{}'
  -- Immutable: no UPDATE or DELETE RLS policies are defined.
);
comment on table public.audit_log is
  'One table, one shape, for every record type. A compliance view queries here, '
  'never per-module tables.';

create table if not exists public.roles (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id),
  record_id   uuid        references public.records(id) on delete cascade,
  record_type text,
  track       text        references public.approval_tracks(track_name),
  role        text        not null check (role in ('owner', 'reviewer', 'approver', 'viewer')),
  created_at  timestamptz not null default now()
  -- record_id null = type-wide default role (e.g. "Technical approver for all opportunities")
  -- record_id set = instance-specific assignment (e.g. "CTO is Technical approver on this deal")
);

create table if not exists public.routing_rules (
  id            uuid        primary key default gen_random_uuid(),
  record_type   text        not null,
  track         text        not null references public.approval_tracks(track_name),
  condition     jsonb       not null default '{}',
  required_tier integer     not null,
  created_at    timestamptz not null default now()
);
comment on table public.routing_rules is
  'Maps a condition (e.g. discount band) to the required approval tier within a track. '
  'Only relevant for tracks with tier escalation (Commercial). Direct tracks skip this.';

create table if not exists public.stage_gate_rules (
  id                 uuid        primary key default gen_random_uuid(),
  record_type        text        not null,
  variant            text,
  from_stage         text        not null,
  to_stage           text        not null,
  requirement_type   text        not null check (
                       requirement_type in ('document_status', 'approval_obtained', 'child_record_status')
                     ),
  requirement_detail jsonb       not null default '{}',
  created_at         timestamptz not null default now()
);
comment on table public.stage_gate_rules is
  'Configurable gate rules. Adding a new requirement for any transition is a data edit '
  'here, not a code change. All requirement rows for a transition must be satisfied '
  '(AND logic); none have a required ordering (parallel).';

create table if not exists public.conversion_criteria (
  id               uuid        primary key default gen_random_uuid(),
  from_record_type text        not null,
  to_record_type   text        not null,
  condition        jsonb       not null default '{}',
  created_at       timestamptz not null default now()
);
comment on table public.conversion_criteria is
  'Criteria for converting between record types (e.g. Lead → Opportunity). '
  'Kept separate from stage_gate_rules because type conversion is a different '
  'action from progressing within a type.';

-- ─────────────────────────────────────────────────────────────
-- updated_at trigger (records only — other tables are append-only)
-- ─────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger records_updated_at
  before update on public.records
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────

create index if not exists records_record_type_idx        on public.records(record_type);
create index if not exists records_owner_id_idx           on public.records(owner_id);
create index if not exists records_parent_record_id_idx   on public.records(parent_record_id);
create index if not exists record_revisions_record_id_idx on public.record_revisions(record_id);
create index if not exists approvals_record_id_idx        on public.approvals(record_id, revision_number);
create index if not exists approvals_approver_id_idx      on public.approvals(approver_id);
create index if not exists audit_log_record_id_idx        on public.audit_log(record_id);
create index if not exists audit_log_actor_id_idx         on public.audit_log(actor_id);
create index if not exists roles_user_id_idx              on public.roles(user_id);
create index if not exists roles_record_id_idx            on public.roles(record_id);
create index if not exists stage_gate_rules_lookup_idx    on public.stage_gate_rules(record_type, from_stage, to_stage);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────

alter table public.records             enable row level security;
alter table public.record_revisions    enable row level security;
alter table public.approval_tracks     enable row level security;
alter table public.approvals           enable row level security;
alter table public.audit_log           enable row level security;
alter table public.roles               enable row level security;
alter table public.routing_rules       enable row level security;
alter table public.stage_gate_rules    enable row level security;
alter table public.conversion_criteria enable row level security;

-- records
-- M1: owner-only SELECT/UPDATE. M2: expand SELECT to also cover roles table
-- (e.g. approvers assigned to a record can see it even if not the owner).
create policy "records_select" on public.records
  for select using (auth.uid() = owner_id);

create policy "records_insert" on public.records
  for insert with check (auth.uid() = owner_id);

create policy "records_update" on public.records
  for update using (auth.uid() = owner_id);

-- record_revisions: immutable — no UPDATE or DELETE policies (deny-by-default)
create policy "record_revisions_select" on public.record_revisions
  for select using (
    auth.uid() = (select owner_id from public.records where id = record_id)
  );

create policy "record_revisions_insert" on public.record_revisions
  for insert with check (
    auth.uid() = created_by
    and auth.uid() = (select owner_id from public.records where id = record_id)
  );

-- approval_tracks: read-only for all authenticated users; written via migration only
create policy "approval_tracks_select" on public.approval_tracks
  for select using (auth.uid() is not null);

-- approvals: immutable once submitted — no UPDATE or DELETE policies
create policy "approvals_select" on public.approvals
  for select using (
    auth.uid() = approver_id
    or auth.uid() = (select owner_id from public.records where id = record_id)
  );

-- M1: any authenticated user can record a decision where they are the approver.
-- This allows the smoke-test flow (single user as both owner and approver).
-- M2: tighten to also require a matching row in public.roles(user_id, track, role='approver').
create policy "approvals_insert" on public.approvals
  for insert with check (auth.uid() = approver_id);

-- audit_log: immutable — no UPDATE or DELETE policies
create policy "audit_log_select" on public.audit_log
  for select using (
    auth.uid() = actor_id
    or auth.uid() = (select owner_id from public.records where id = record_id)
  );

create policy "audit_log_insert" on public.audit_log
  for insert with check (auth.uid() = actor_id);

-- roles: users see their own assignments only; M2 will let record owners see all roles on their records
create policy "roles_select" on public.roles
  for select using (auth.uid() = user_id);

-- routing_rules, stage_gate_rules, conversion_criteria: read-only config tables
create policy "routing_rules_select" on public.routing_rules
  for select using (auth.uid() is not null);

create policy "stage_gate_rules_select" on public.stage_gate_rules
  for select using (auth.uid() is not null);

create policy "conversion_criteria_select" on public.conversion_criteria
  for select using (auth.uid() is not null);

-- ─────────────────────────────────────────────────────────────
-- Seed: approval tracks
-- Kept in migration (not seeds/) because stage_gate_rules has an FK to this
-- table — any seed file that inserts gate rules depends on these rows existing.
-- ─────────────────────────────────────────────────────────────

insert into public.approval_tracks (track_name, description) values
  ('Internal',   'Internal sign-off and management approval'),
  ('Commercial', 'Commercial/sales authority, tiered by discount level'),
  ('Technical',  'Technical authority review'),
  ('Legal',      'Legal review and sign-off'),
  ('Finance',    'Finance authority review')
on conflict (track_name) do nothing;
