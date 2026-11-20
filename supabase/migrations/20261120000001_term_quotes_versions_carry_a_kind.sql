-- TERM_QUOTES: a Deal Sheet version carries the pricing method that priced it,
-- and a Closed Won record takes no new version of either method. John's Phase 0
-- rulings, 2026-11-20 (W, P3, P4, P7; TERM_QUOTES_BRIEF.md carries them
-- verbatim). DRAFTED FOR JOHN'S REVIEW. John applies it before any gate run,
-- wrapped in begin/commit, with the ledger row recorded by hand as a SEPARATE
-- statement afterwards (Architecture 10, corrected 2026-09-08: this file does
-- not write its own ledger row).
--
-- ── WHAT IT DOES ─────────────────────────────────────────────────────────
--
-- 1. deal_sheet_versions.kind: 'commercials' | 'term_quote', not null, default
--    'commercials' (P4). The default is TRUE of every existing row: Phase 0
--    measured all 31 live versions Commercials-shaped (W), so no backfill and
--    no compatibility code (R-TQ5).
-- 2. deal_sheet_versions_rates_have_cost_basis BRANCHES BY KIND (P3).
--    commercials: unchanged, rates.rates carries a catalog rate key.
--    term_quote:  rates.params is the term engine's whole parameter object BY
--    VALUE (buildParams in src/lib/term-pricing-settings.js): the seven settings
--    and a non-empty costs object. Batch ids are not relied on, and the batch
--    immutability trigger is NOT changed (P3).
-- 3. deal_sheet_versions_immutable(): kind joins the guarded list, so the
--    draft-to-issued relabel cannot change it (P4). ALSO (implementation
--    position, revisitable): a DRAFT's kind cannot change either. A draft's
--    inputs were priced by one engine; relabelling the method under the same
--    inputs would describe them falsely. A method switch is a new version
--    (R-TQ4), never an edit to an old one.
-- 4. insert_deal_sheet_version gains p_kind default 'commercials' (P4). The old
--    nine-argument signature is DROPPED first, because a tenth defaulted
--    argument beside it would make every existing nine-argument call ambiguous.
--    Numbering stays kind-blind: one sequence per record (P1).
-- 5. A new trigger refuses INSERT, and UPDATE of a draft, for a record whose
--    status is Closed Won, for EVERY role, the service role included (P7,
--    TQ-4). SQLSTATE PT423; the route maps it to 409 with the existing Closed
--    Won wording. An issued row is already refused every change by (3).
--
-- What is NOT here, by ruling: no refusal "while a version awaits approval"
-- (R-TQ4's second clause is WITHDRAWN, P7); close_superseded_reviews is
-- unchanged and kind-blind, so the next submitted major of either kind
-- supersedes an open review, as today.
--
-- Idempotent (Architecture 7): add column if not exists, constraints dropped
-- and re-added by name, functions replaced, the old signature dropped if it
-- exists, the trigger dropped and re-created. Not parse-checked here (CLAUDE.md
-- build discipline 14: this session reaches Postgres only through PostgREST).
-- Rollback: supabase/rollbacks/20261120000001_term_quotes_versions_carry_a_kind.rollback.sql.

-- ── 1. THE KIND ──────────────────────────────────────────────────────────

alter table public.deal_sheet_versions add column if not exists kind text not null default 'commercials';

alter table public.deal_sheet_versions drop constraint if exists deal_sheet_versions_kind_known;
alter table public.deal_sheet_versions add constraint deal_sheet_versions_kind_known
  check (kind in ('commercials', 'term_quote'));

comment on column public.deal_sheet_versions.kind is
  'TERM_QUOTES P4: the pricing method that priced this version. commercials: inputs is the Commercials form '
  'payload and rates.rates the catalog rates, priced by calculateDeal. term_quote: inputs is the term quote''s '
  'inputs (pricing spec v2.1 section 14.2) and rates.params the term engine''s parameter object by value, priced '
  'by priceQuote. Every reader that hands a version to an engine or to pricingChanged branches on it. Defaults to '
  'commercials, which is true of every row written before 2026-11-20 (TERM_QUOTES Phase 0, W). Never changes '
  'after the row is created.';

-- ── 2. THE COST BASIS, BY KIND ───────────────────────────────────────────
--
-- NOT VALID, as before (20260829000007): it binds new rows and updates without
-- re-checking history. Every existing row is commercials by the default, so the
-- commercials branch is the old constraint word for word.
--
-- A CHECK PASSES WHEN IT EVALUATES TO NULL, and the old constraint does: with
-- rates = '{}', rates -> 'rates' is null, so jsonb_typeof(...) = 'object' is
-- null and the row is ADMITTED with no cost basis at all. Two fixtures rely on
-- it today (verify-harness createVersion and version-atomicity's concurrent and
-- stale-revision cases pass p_rates {}); the census flag was right about the
-- intent and wrong about the outcome. The commercials branch keeps that
-- behaviour UNCHANGED here, because tightening it is outside this ruling and
-- turns those fixtures red; it is reported for John's decision. The term_quote
-- branch is wrapped in coalesce(..., false) so a missing params object REFUSES
-- (build discipline 14(a): a construct that cannot carry the error).

alter table public.deal_sheet_versions drop constraint if exists deal_sheet_versions_rates_have_cost_basis;
alter table public.deal_sheet_versions add constraint deal_sheet_versions_rates_have_cost_basis
  check (
    rates is not null
    and (
      (
        kind = 'commercials'
        and jsonb_typeof(rates -> 'rates') = 'object'
        and (rates -> 'rates') ?| array[
          'ssUnitCost', 'aqUnitCost', 'hemirUnitCost',
          'inSsExisting', 'inSsNew', 'inAqm', 'inHemir',
          'hoSafesight', 'hoAqm', 'hoHemir'
        ]
      )
      or (
        kind = 'term_quote'
        and coalesce(
          jsonb_typeof(rates -> 'params') = 'object'
          and (rates -> 'params') ?& array[
            'TERMS', 'COMPARE_TERM', 'PRICE_LADDER_BY_PRODUCT', 'VOLUME_BANDS_BY_PRODUCT',
            'HW_UPFRONT_MARGIN', 'MARGIN_FLOOR', 'CURRENCY', 'costs'
          ]
          and jsonb_typeof(rates -> 'params' -> 'costs') = 'object'
          and (rates -> 'params' -> 'costs') <> '{}'::jsonb,
          false)
      )
    )
  )
  not valid;

-- ── 3. THE IMMUTABILITY GUARD ────────────────────────────────────────────
--
-- 20261117000002's definition, with kind added to the relabel's guarded list
-- and to the draft branch. Nothing else moves.

create or replace function public.deal_sheet_versions_immutable()
returns trigger
language plpgsql
as $$
declare
  v_owner uuid;
begin
  if OLD.status = 'issued' then
    raise exception
      'deal_sheet_versions: V%.% is issued and cannot be changed (id %)',
      OLD.major, OLD.minor, OLD.id
      using errcode = 'restrict_violation';
  end if;

  if NEW.status = 'draft' then
    if NEW.frozen_figures is not null then
      raise exception 'deal_sheet_versions: a draft carries no frozen figures (id %)', OLD.id
        using errcode = 'restrict_violation';
    end if;
    -- TERM_QUOTES: a method switch is a new version, never an edit to an old one.
    if NEW.kind is distinct from OLD.kind then
      raise exception 'deal_sheet_versions: a version''s pricing method cannot change; take a new version (id %)', OLD.id
        using errcode = 'restrict_violation';
    end if;
    return NEW;
  end if;

  if NEW.major is distinct from OLD.major + 1 or NEW.minor is distinct from 0 then
    raise exception
      'deal_sheet_versions: issuing V%.% must produce V%.0, not V%.%',
      OLD.major, OLD.minor, OLD.major + 1, NEW.major, NEW.minor
      using errcode = 'restrict_violation';
  end if;

  if NEW.record_id        is distinct from OLD.record_id
  or NEW.kind             is distinct from OLD.kind
  or NEW.reason           is distinct from OLD.reason
  or NEW.inputs           is distinct from OLD.inputs
  or NEW.rates            is distinct from OLD.rates
  or NEW.sections         is distinct from OLD.sections
  or NEW.batch_id         is distinct from OLD.batch_id
  or NEW.revision_number  is distinct from OLD.revision_number
  or NEW.created_by       is distinct from OLD.created_by
  or NEW.created_by_email is distinct from OLD.created_by_email
  or NEW.created_at       is distinct from OLD.created_at then
    raise exception
      'deal_sheet_versions: issuing may set the status, number, issuer and frozen figures only, and must not alter what the version records (id %)',
      OLD.id
      using errcode = 'restrict_violation';
  end if;

  -- R-FF1 and DESIGN_PRINCIPLES section 3 rule 1: the figures are the SERVER'S,
  -- computed at submission, never a client's. Required on every submission, and
  -- writable only by the service role, so neither the screen nor a direct
  -- PostgREST call can supply them.
  if NEW.frozen_figures is null then
    raise exception 'deal_sheet_versions: issuing must freeze the figures (id %)', OLD.id
      using errcode = 'restrict_violation';
  end if;
  if current_user <> 'service_role' then
    raise exception 'deal_sheet_versions: only the server may freeze figures (id %)', OLD.id
      using errcode = 'insufficient_privilege';
  end if;

  -- The relabel runs as the service role, which bypasses RLS, so the owner
  -- rule the update policy enforced is enforced here: the issuer must own the
  -- record. The route also says so in words before it gets here.
  select r.owner_id into v_owner from public.records r where r.id = NEW.record_id;
  if NEW.issued_by is distinct from v_owner then
    raise exception 'deal_sheet_versions: only the record''s owner may submit its version (id %)', OLD.id
      using errcode = 'insufficient_privilege';
  end if;

  return NEW;
end;
$$;

-- ── 4. THE INSERT FUNCTION, WITH A KIND ──────────────────────────────────
--
-- 20260829000002's definition, with p_kind added LAST and defaulted, so the
-- route's named-argument call is unchanged for Commercials. SECURITY INVOKER,
-- as before, so the deal_sheet_versions_insert policy stays in force.

drop function if exists public.insert_deal_sheet_version(uuid, integer, text, jsonb, jsonb, jsonb, uuid, uuid, text);

create or replace function public.insert_deal_sheet_version(
  p_record_id         uuid,
  p_expected_revision integer,
  p_reason            text,
  p_inputs            jsonb,
  p_rates             jsonb,
  p_sections          jsonb,
  p_batch_id          uuid,
  p_created_by        uuid,
  p_created_by_email  text,
  p_kind              text default 'commercials'
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_current integer;
  v_major   integer;
  v_minor   integer;
  v_row     public.deal_sheet_versions;
begin
  if p_record_id is null then
    raise exception 'insert_deal_sheet_version: p_record_id is required';
  end if;
  if p_created_by is null then
    raise exception 'insert_deal_sheet_version: p_created_by is required';
  end if;
  if p_expected_revision is null then
    raise exception 'insert_deal_sheet_version: p_expected_revision is required';
  end if;
  if p_kind is null then
    raise exception 'insert_deal_sheet_version: p_kind is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_record_id::text, 0));

  select r.revision_number
    into v_current
    from public.record_revisions r
   where r.record_id = p_record_id
   order by r.revision_number desc
   limit 1;

  -- PT409, the same SQLSTATE a stale record write raises, so the route maps one
  -- code rather than two and a conflict never reaches the 500 path.
  if v_current is distinct from p_expected_revision then
    raise exception
      'This Opportunity is at revision %, and the version would have recorded revision %. Reload and take it again.',
      coalesce(v_current, 0), p_expected_revision
      using errcode = 'PT409';
  end if;

  -- The numbering, under the same lock, over EVERY version of the record
  -- whatever its kind (P1: one sequence). major carries forward and minor
  -- increments; major = 0 until something is issued.
  select v.major, v.minor
    into v_major, v_minor
    from public.deal_sheet_versions v
   where v.record_id = p_record_id
   order by v.major desc, v.minor desc
   limit 1;

  insert into public.deal_sheet_versions (
    record_id, kind, major, minor, status, reason, revision_number,
    inputs, rates, sections, batch_id, created_by, created_by_email
  ) values (
    p_record_id, p_kind, coalesce(v_major, 0), coalesce(v_minor, 0) + 1, 'draft',
    p_reason, p_expected_revision,
    p_inputs, p_rates, p_sections, p_batch_id, p_created_by, p_created_by_email
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

comment on function public.insert_deal_sheet_version(uuid, integer, text, jsonb, jsonb, jsonb, uuid, uuid, text, text) is
  'Takes a Deal Sheet version of the given kind (commercials by default) under the same advisory lock '
  'append_record_revision takes, so the revision it records cannot move between being checked and being '
  'written, and two concurrent versions cannot compute the same number. Numbering is one sequence across '
  'kinds (TERM_QUOTES P1). Raises SQLSTATE PT409 when the record is not at the expected revision, and PT423 '
  '(from deal_sheet_versions_closed_won) when the record is Closed Won.';

-- ── 5. CLOSED WON TAKES NO NEW PRICING ───────────────────────────────────
--
-- 'Closed Won' is the stage NAME, as src/lib/pricing-keys.js WON_STAGE and
-- raise_transition_request already identify it (FROZEN_FIGURES decision 2 names
-- the dependency: a renamed won stage disarms this silently). The message is
-- CLOSED_WON_PRICING_REFUSAL word for word, so a direct caller is told what the
-- screen says. Reads records as the invoker: records_select admits every
-- signed-in user, and the service role bypasses RLS, so the read always sees
-- the row. A version on a record nobody can see is refused by the insert
-- policy first.

create or replace function public.deal_sheet_versions_closed_won()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  if TG_OP = 'UPDATE' and OLD.status is distinct from 'draft' then
    return NEW;
  end if;

  select r.status into v_status from public.records r where r.id = NEW.record_id;
  if v_status = 'Closed Won' then
    raise exception 'This deal is Closed Won; its pricing is the won version''s and cannot change.'
      using errcode = 'PT423',
            detail = format('deal_sheet_versions: %s refused on Closed Won record %s', lower(TG_OP), NEW.record_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists deal_sheet_versions_closed_won_trg on public.deal_sheet_versions;
create trigger deal_sheet_versions_closed_won_trg
  before insert or update on public.deal_sheet_versions
  for each row execute function public.deal_sheet_versions_closed_won();
