-- System roles: who may change the system's own configuration. TERM_PRICING
-- round, ruling R-TP6 (John, 2026-10-01).
--
-- Built exactly as DESIGN_PRINCIPLES.md designs it (the `system_roles` row in
-- the schema table): `user_id`, `role`, with `admin` the single general
-- permission. Deliberately separate from `roles`, which grants permission over
-- records, and whose check constraint cannot hold 'admin' at all (measured at
-- Phase 0).
--
-- ── WHO WRITES IT ────────────────────────────────────────────────────────
--
-- NOBODY THROUGH THE APPLICATION. Select-only RLS, own row only, and no route
-- writes it (R-TP6). Granting admin stays an editor action. That is the point:
-- the permission that guards configuration is not itself configurable from the
-- screen it guards.
--
-- ── SEEDED WITH JOHN ONLY ────────────────────────────────────────────────
--
-- The same user id track_approvers seeds. The insert is guarded so a replay
-- adds nothing (Architecture 7), and it carries a foreign key, so it fails
-- loudly rather than silently if that user is ever absent.
--
-- ── APPLY ────────────────────────────────────────────────────────────────
--
-- By hand, before 20261001000002, which references this table. This file does
-- NOT write its own ledger row (Architecture 10, corrected 2026-09-08): record
-- it as a separate statement after applying, or use `supabase db push`, which
-- writes the row itself. Not parse-checked here (CLAUDE.md rule 14).

create table if not exists public.system_roles (
  user_id  uuid not null references auth.users(id),
  role     text not null check (role in ('admin')),
  primary key (user_id, role)
);

comment on table public.system_roles is
  'System-wide roles. admin = may change system configuration (first use: '
  'term_pricing_settings). Written only in the editor; no route writes it.';

alter table public.system_roles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'system_roles' and policyname = 'system_roles_select_own'
  ) then
    create policy system_roles_select_own on public.system_roles
      for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

insert into public.system_roles (user_id, role)
select '75425a02-4750-470b-bcdc-fe83d0b01ac2'::uuid, 'admin'
where not exists (
  select 1 from public.system_roles s
  where s.user_id = '75425a02-4750-470b-bcdc-fe83d0b01ac2'::uuid and s.role = 'admin'
);

-- Self-check: exactly one admin, and it is John.
do $$
begin
  if (select count(*) from public.system_roles where role = 'admin') <> 1
     or not exists (select 1 from public.system_roles
                    where user_id = '75425a02-4750-470b-bcdc-fe83d0b01ac2'::uuid and role = 'admin') then
    raise exception 'system_roles: expected exactly one admin, John';
  end if;
end $$;
