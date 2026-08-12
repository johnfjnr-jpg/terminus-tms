-- Terminus TMS: broaden SELECT to team-wide read access
--
-- Read-access only. Ownership (records.owner_id), and every INSERT/UPDATE
-- policy, stays exactly as it is - nobody gains the ability to edit
-- another owner's record, approve on their behalf, or write an audit_log/
-- record_revisions entry as anyone but themselves. Only the SELECT
-- policies on these six tables change, from owner-scoped to
-- any-authenticated-user, matching the pattern already used for
-- industries/stage_definitions/stage_gate_rules/stage_probability_defaults/
-- approval_tracks/routing_rules/conversion_criteria.
--
-- Six tables, confirmed via a full audit of every SELECT policy in the
-- schema cross-referenced against every table the app's routes actually
-- query: records, record_revisions, opportunity_details, record_contacts,
-- approvals, audit_log. document_details (already unconditionally open,
-- FOR ALL, a pre-existing inconsistency) and roles (self-scoped, not
-- queried by any route today) are deliberately untouched - out of scope,
-- confirmed with John before writing this migration.

drop policy "records_select" on public.records;
create policy "records_select" on public.records
  for select using (auth.uid() is not null);

drop policy "record_revisions_select" on public.record_revisions;
create policy "record_revisions_select" on public.record_revisions
  for select using (auth.uid() is not null);

drop policy "opportunity_details_select" on public.opportunity_details;
create policy "opportunity_details_select" on public.opportunity_details
  for select using (auth.uid() is not null);

drop policy "record_contacts_select" on public.record_contacts;
create policy "record_contacts_select" on public.record_contacts
  for select using (auth.uid() is not null);

-- approvals_select and audit_log_select were already approver-or-owner /
-- actor-or-owner (a partial allowance), so broadening to any authenticated
-- user is a strict superset - no prior access is lost, only widened.
drop policy "approvals_select" on public.approvals;
create policy "approvals_select" on public.approvals
  for select using (auth.uid() is not null);

drop policy "audit_log_select" on public.audit_log;
create policy "audit_log_select" on public.audit_log
  for select using (auth.uid() is not null);
