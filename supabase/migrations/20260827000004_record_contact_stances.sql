-- Terminus TMS: where a contact stands on a deal, and what they want.
-- Round 35 Phase 4.
--
-- ─────────────────────────────────────────────────────────────
-- THE ASSESSMENT SCORE PATTERN, IN A TABLE RATHER THAN A PAYLOAD, AND WHY
-- THAT IS THE SAME SHAPE RATHER THAN A SECOND ONE
-- ─────────────────────────────────────────────────────────────
--
-- A score entry (src/lib/score-entry.js) is { at, by, value, comment? }
-- appended to an array in the record's payload through
-- append_record_revision, never mutated, and the current score is the last
-- entry. That shape is: append-only, carrying who and when, optional free
-- text beside the value, current value = latest.
--
-- THIS TABLE IS THAT SHAPE. What differs is the medium, and the medium is
-- chosen by where the data belongs:
--
--   A SCORE BELONGS TO THE RECORD. An Opportunity has a score for a
--   criterion, the Opportunity has a payload, and the payload is the natural
--   home.
--
--   A STANCE BELONGS TO THE LINK. record_contacts has no payload. Storing
--   link data in the record's payload keyed by link uuid means opaque
--   top-level keys, and an orphaned key every time a link is removed, with
--   nothing to clean it up. append_record_revision merges shallowly at the
--   top level, so the alternative - one nested object read and rewritten
--   whole - reintroduces exactly the lost-update race that function exists to
--   remove.
--
-- Stated plainly as a reasoned departure from the literal instruction:
-- the pattern followed is the score entry's shape, not its storage. An
-- append-only table carrying created_by and created_at is also the dominant
-- shape in this schema already - record_revisions, approvals, audit_log and
-- record_contacts itself are all exactly that - so this is not a new kind of
-- object.
--
-- ─────────────────────────────────────────────────────────────
-- THE NOTE LIVES HERE, BESIDE THE STANCE, FOR THE SAME REASON `comment`
-- LIVES BESIDE `value`
-- ─────────────────────────────────────────────────────────────
--
-- "Buying committee mapped" asks who else has a say AND WHAT DOES EACH OF
-- THEM WANT. Round 35 Phase 2 recorded that no enumeration answers the second
-- half and that a free-text line per contact is what it needs.
--
-- It lands in this phase rather than the next because it has the same
-- mutability question stance has, and answering that question twice in two
-- phases is how a second shape gets invented. A score entry already carries
-- an optional free-text `comment` beside its value; this is that slot.
--
-- SO AN ENTRY IS ONE OBSERVATION about this person on this deal: where they
-- stand, optionally what they want, at a time, by someone. Updating only the
-- note appends an entry repeating the stance, which is honest rather than
-- wasteful: it is a new observation made at a new time by a named person, and
-- that is exactly what the Organisational lens is scored against.
--
-- ─────────────────────────────────────────────────────────────
-- ON DELETE CASCADE, AND WHERE THE HISTORY GOES INSTEAD
-- ─────────────────────────────────────────────────────────────
--
-- Removing a contact from a deal must stay possible, so this cannot be
-- RESTRICT: a link with any stance recorded would become permanent.
--
-- Cascade destroys the entries, so the removal endpoint writes the stance
-- history it is about to destroy into audit_log.detail before deleting.
-- audit_log references records, not this table, so that copy survives. The
-- history is preserved in the table whose job is preserving it.
--
-- REMOVE AND STANCE-CHANGE ARE DIFFERENT OPERATIONS AND CANNOT BECOME THE
-- SAME ONE. They touch different tables: removing deletes a record_contacts
-- row, changing a stance inserts here. There is no path that does one while
-- meaning the other, which is a property of the shape rather than of the
-- care taken at the call site.

create table if not exists public.record_contact_stances (
  id                 uuid        primary key default gen_random_uuid(),
  record_contact_id  uuid        not null references public.record_contacts(id) on delete cascade,
  stance_id          uuid        not null references public.contact_stances(id),
  note               text,
  created_by         uuid        not null references auth.users(id),
  created_at         timestamptz not null default now()
);

comment on table public.record_contact_stances is
  'Append-only observations about one linked Contact on one deal: where they '
  'stand, optionally what they want, at a time, by someone. The current '
  'stance is the latest row. Same shape as an assessment score entry '
  '(append-only, who and when, optional free text beside the value) held in a '
  'table rather than a payload because a stance belongs to the link and '
  'record_contacts has no payload. No UPDATE or DELETE policy: append-only is '
  'enforced by RLS, not by discipline at the call site.';

comment on column public.record_contact_stances.note is
  'What this person wants, in their own terms. The second half of the live '
  'Organisational criterion "Buying committee mapped: who else has a say, and '
  'what does each of them want", which no enumeration can answer. Optional, '
  'exactly like a score entry''s comment.';

create index if not exists record_contact_stances_link_idx
  on public.record_contact_stances (record_contact_id, created_at desc);

alter table public.record_contact_stances enable row level security;

-- Scoped through the link to the parent record's owner, matching
-- record_contacts' own three policies exactly rather than inventing a
-- different rule one table further out.
drop policy if exists "record_contact_stances_select" on public.record_contact_stances;
create policy "record_contact_stances_select" on public.record_contact_stances
  for select using (
    auth.uid() = (
      select r.owner_id from public.records r
      join public.record_contacts rc on rc.record_id = r.id
      where rc.id = record_contact_id
    )
  );

drop policy if exists "record_contact_stances_insert" on public.record_contact_stances;
create policy "record_contact_stances_insert" on public.record_contact_stances
  for insert with check (
    auth.uid() = created_by
    and auth.uid() = (
      select r.owner_id from public.records r
      join public.record_contacts rc on rc.record_id = r.id
      where rc.id = record_contact_id
    )
  );

-- NO UPDATE POLICY AND NO DELETE POLICY, deliberately, same convention as
-- record_revisions, approvals and audit_log. An observation recorded about a
-- person is corrected by recording a new one, not by editing the old one:
-- the point of a stance history is that it shows when the reading changed.
