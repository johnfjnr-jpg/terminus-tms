-- Terminus TMS: Customer Documents, the discriminator. Round 11 Phase 6,
-- 2026-08-19. Written idempotently per Architecture rule 7.
--
-- Client-supplied reference material: site drawings, QHSE guidelines,
-- anything Terminus needs from the client's side. Requested three times by
-- the business. This version is a pasted URL, not a browser upload, so it
-- needs no Workspace decision, no service account and no folder structure.
--
-- WHY A DISCRIMINATOR RATHER THAN ABSENCE, which is what the brief first
-- proposed ("a variant that no gate rule names"). Two of the three
-- constraints hold by construction: completable_documents is derived from
-- gate rules, and the document_status branch matches on variant plus status,
-- so a name no rule mentions can satisfy neither. THE CLOSED LIFECYCLE PANEL
-- IS THE EXCEPTION AND IT IS DELIBERATE. Round 10 Phase 7 built
-- lifecycle-documents as union-not-intersection: a document child whose
-- variant matches no catalogue entry is surfaced under its own heading
-- rather than silently dropped, precisely because the two tables hold names
-- as independent free strings. Excluding Customer Documents by absence would
-- invert the one behaviour that panel was built to guarantee.
--
-- FOUR CONSUMERS READ THIS COLUMN POSITIVELY, and this list is the complete
-- one. Phase 0 found three by reading the document endpoints; the fourth was
-- found by grepping for record_type = 'document' before building:
--
--   src/routes/test-beds.js   document-requirements -> completable_documents
--   src/routes/test-beds.js   lifecycle-documents   -> the Closed panel
--   src/routes/test-beds.js   complete-document     -> the existence check
--   src/routes/transitions.js document_status       -> THE GATE ITSELF
--
-- The fourth is the load-bearing one. Nine document_status rules match on
-- variant, and nine catalogue names exist that a person could type by
-- accident. Without the filter a client file named "NDA" would satisfy the
-- NDA gate on transition 2: a document nobody at Terminus reviewed releasing
-- a gate that exists to prove somebody did. That is the same outcome as
-- Round 9 Phase 6.1, reached by naming rather than by status.
--
-- A READER OMITTING THE FILTER CANNOT BE CAUGHT BY AN INVARIANT. The
-- constraint below protects against a writer omitting the kind; nothing
-- protects against a future query over a Test Bed's document children that
-- forgets to say which kind it wants. That is a code property, not a data
-- property. The mitigation is that all four call sites change in the same
-- commit as this migration and are named here, which is a discipline rather
-- than a guarantee, and it is recorded as an accepted weakness.

alter table public.records
  add column if not exists document_kind text;

comment on column public.records.document_kind is
  'Documents only. ''terminus'' for Terminus''s own stage documents, which '
  'gate transitions; ''customer'' for client-supplied reference material, '
  'which gates nothing. Every consumer of document records filters on this '
  'POSITIVELY - excluding by absence would invert lifecycle-documents'' '
  'deliberate union-not-intersection behaviour, and would let a client file '
  'named after a catalogue document satisfy that document''s gate.';

-- Backfill before the constraint, so every pre-existing document is
-- explicitly Terminus's own rather than implicitly so.
update public.records
   set document_kind = 'terminus'
 where record_type = 'document'
   and document_kind is null;

-- Vocabulary guard. Deliberately a CHECK rather than a lookup table: two
-- values, both structural, neither admin-configurable, and the standing rule
-- against creating a second home for a decision applies.
alter table public.records
  drop constraint if exists records_document_kind_valid;
alter table public.records
  add constraint records_document_kind_valid
  check (document_kind is null or document_kind in ('terminus', 'customer'));

-- Presence guard, scoped to documents.
--
-- NOT VALID, and the deleted_at escape is not decoration. This project has
-- already locked a batch of legacy Test Beds out of being edited AT ALL,
-- including out of soft-delete, with a NOT VALID CHECK added against
-- existing data: NOT VALID defers the initial scan and exempts nothing
-- afterwards, so every later write is checked against the full row image.
-- The escape is what keeps a historical row soft-deletable.
--
-- The gap this leaves is real and is covered by an invariant in Phase 7
-- rather than by this constraint: no LIVE document may carry a null kind.
alter table public.records
  drop constraint if exists records_document_kind_required;
alter table public.records
  add constraint records_document_kind_required
  check (record_type <> 'document' or document_kind is not null or deleted_at is not null)
  not valid;

create index if not exists records_document_kind_idx
  on public.records (parent_record_id, document_kind)
  where record_type = 'document';
