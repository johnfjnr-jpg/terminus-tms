-- Terminus TMS: Installer and Test Bed Tech Team. Round 11 Phase 5,
-- 2026-08-19. Written idempotently per Architecture rule 7.
--
-- BASELINE: 59 stage_gate_rules total, 43 on test_bed, measured immediately
-- before this migration rather than taken from any figure in the brief.
--
-- THE CONVERSION IS GREENFIELD, established by survey before writing this
-- rather than assumed. Across all 154 Test Bed records, live and soft
-- deleted, current revision of each:
--   * ZERO LIVE records hold `installer` or `techTeam`.
--   * 6 soft-deleted probe fixtures hold `installer`, every value synthetic
--     ("edit-1787026407283", "R6P3 Installer Co 1786972238063"), none
--     matching any of the 10 live Account names.
--   * `techTeam` has NEVER held a value on any record, live or deleted.
-- So there is nothing to map and nothing to lose. This is the opposite of
-- Round 10 Phase 3's Installation Environment case, where a soft-deleted
-- record held a legacy free-text value that a narrowed picklist would
-- silently clear on the next save.

-- ---------------------------------------------------------------------------
-- Installer: a dedicated column, not a payload key and not parent_record_id
-- ---------------------------------------------------------------------------
--
-- INSTALLER IS A LINK TO AN ACCOUNT, confirmed with the business. Where the
-- client installs with their own staff that is the Test Bed's own Account;
-- where a Terminus contractor installs it is that contractor's Account. NO
-- PICKLIST: client-installed versus contractor-installed becomes an
-- observable fact rather than a typed label, since it is simply whether
-- installer_account_id equals account_id.
--
-- A dedicated column follows the precedent this project already set twice.
-- `account_id` on test_bed exists rather than reusing `parent_record_id`
-- because that column already had one exclusive meaning, and
-- `parent_account_id` exists on records for Account-to-Account for the same
-- reason. This is a SECOND account relationship on the same record, so
-- overloading `account_id` would make it ambiguous to read back.
alter table public.records
  add column if not exists installer_account_id uuid references public.records(id);

comment on column public.records.installer_account_id is
  'Test Bed only: the Account whose people perform the installation. Equal to '
  'account_id when the client installs with their own staff, different when a '
  'contractor does. Deliberately a link rather than a picklist, so '
  'client-installed versus contractor-installed is an observable fact rather '
  'than a typed label. Also begins the evidence trail for ISO 9001 Clause 8.4 '
  'on externally provided processes.';

create index if not exists records_installer_account_id_idx
  on public.records (installer_account_id)
  where installer_account_id is not null;

-- ---------------------------------------------------------------------------
-- Both gate the exit from Installation and Commissioning
-- ---------------------------------------------------------------------------
--
-- An installation cannot be complete without recording who did it.
--
-- Installer uses payload_field_required against a REAL COLUMN, which that
-- branch already supports for parent_record_id and industry_id; this
-- migration's companion code change adds installer_account_id to the same
-- set. Tech Team uses contact_role_linked, the same branch the three Client
-- Buyer gates use, with a new role value.
insert into public.stage_gate_rules (record_type, variant, from_stage, to_stage, requirement_type, requirement_detail)
select 'test_bed', null, 'Installation and Commissioning', 'Monitoring and Analysis', v.rtype, v.detail
from (values
  ('payload_field_required', '{"field": "installer_account_id", "label": "Installer"}'::jsonb),
  ('contact_role_linked',    '{"role": "Test Bed Tech Team"}'::jsonb)
) as v(rtype, detail)
where not exists (
  select 1 from public.stage_gate_rules r
  where r.record_type = 'test_bed'
    and r.from_stage = 'Installation and Commissioning'
    and r.to_stage = 'Monitoring and Analysis'
    and r.requirement_type = v.rtype
    and r.requirement_detail = v.detail
);
