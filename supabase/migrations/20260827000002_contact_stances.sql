-- Terminus TMS: the Key Customer Contacts stance vocabulary. Round 35 Phase 2.
--
-- Seven stances on TWO AXES. Configuration only: nothing writes to this table
-- in this phase, and the panel that reads it arrives in Phase 3.
--
-- ─────────────────────────────────────────────────────────────
-- WHY STANCE IS A SECOND FIELD AT ALL
-- ─────────────────────────────────────────────────────────────
--
-- Role is the function, stance is where they stand. The two are separate
-- because the ten names the business first gave were not all the same kind of
-- thing: Procurement, Legal, IT, Cyber Sec, QHSE and DPO are functions someone
-- holds whatever we are selling, while Champion is a posture that only exists
-- in relation to this deal.
--
-- With role alone a champion who is also the technical buyer takes two rows.
-- With both, one person is one row carrying two facts.
--
-- AND STANCE IS WHAT THE ORGANISATIONAL LENS IS SCORED AGAINST. Round 33
-- configured eight Organisational criteria, five of which are questions about
-- people, and a job title answers none of the hard ones:
--
--   Economic Buyer identified   Who can say yes and release the money
--   Champion identified         Who inside is selling this when we are not there
--   Internal pain owner         Whose problem is this, and what does it cost them
--   Buying committee mapped     Who else has a say, and what does each of them want
--   Political dynamics          Who gains and who loses if this goes ahead
--
-- ─────────────────────────────────────────────────────────────
-- ONE FIELD OR TWO: TESTED AGAINST THOSE CRITERIA, NOT DECIDED FROM THE SHAPE
-- ─────────────────────────────────────────────────────────────
--
-- The question is whether the seven values compete for one slot. Worked
-- through as pairs, asking of each whether a real person could hold both and
-- whether any criterion above needs them to:
--
--   Champion   + Supporter   NO. Both are points on one scale of active
--                            support. Allowing both makes the scale mean
--                            nothing.
--   Supporter  + Blocker     NO. A direct contradiction.
--   Champion   + Sceptic     NO. Someone selling this internally is not
--                            hedging on it.
--   Pain Owner + Champion    YES, and it is the most common good case: the
--                            person whose problem it is is often the one
--                            selling it inside.
--   Pain Owner + Blocker     YES, AND A CRITERION NEEDS IT. The head of
--                            operations owns the problem and blocks because
--                            the fix costs their team headcount. "Political
--                            dynamics: who gains and who loses" exists to
--                            capture exactly that, and one field would record
--                            either the ownership or the opposition and lose
--                            the fact that they are the same person.
--   Pain Owner + Unknown     YES. We know whose problem it is and not yet
--                            where they stand.
--
-- SO SIX VALUES ARE MUTUALLY EXCLUSIVE AND PAIN OWNER IS ORTHOGONAL TO ALL OF
-- THEM. Neither "one field" nor "two fields" is the answer as stated. One
-- field cannot express Pain Owner + Blocker. Two hardcoded fields would put
-- Pain Owner in the schema, so the next orthogonal stance, a Gatekeeper who
-- controls access or a Coach who feeds us information, would need a migration
-- rather than a row, which is the hardcoding this project rules out.
--
-- ONE VOCABULARY, TWO AXES, AND A LINK ROW CARRIES AT MOST ONE VALUE PER AXIS.
-- The axis lives in the data, so a third axis is a row and a fourth stance on
-- an existing axis is a row.
--
--   disposition  where they stand toward the deal. Exactly one, always
--                present, defaulting to Unknown on a new row.
--   stake        what they hold in it regardless of where they stand.
--                Optional. Pain Owner is its only member today.
--
-- No CHECK constraint enumerating the axes, deliberately, for the same reason
-- closed_lost_reasons took a foreign key over a CHECK: a CHECK writes today's
-- answer into the schema and makes tomorrow's a migration. Phase 3 groups the
-- picker by whatever axes it finds.
--
-- ─────────────────────────────────────────────────────────────
-- WHAT THIS STILL CANNOT EXPRESS, RECORDED RATHER THAN PAPERED OVER
-- ─────────────────────────────────────────────────────────────
--
-- "Buying committee mapped" asks who else has a say AND WHAT DOES EACH OF THEM
-- WANT. The list plus role plus stance answers the first half and no
-- enumeration answers the second. Adding stance values until it does would
-- produce a vocabulary nobody can apply consistently. A free-text line per
-- contact is what that half needs, and it is Phase 3's to place, not this
-- table's to fake.

create table if not exists public.contact_stances (
  id          uuid        primary key default gen_random_uuid(),
  label       text        not null unique,
  axis        text        not null,
  sort_order  integer     not null,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.contact_stances is
  'The Key Customer Contacts stance vocabulary: where a person stands on this '
  'deal, as distinct from the function they hold, which is contact_roles. Two '
  'axes, because six of the seven values compete for one slot and Pain Owner '
  'is orthogonal to all of them: someone can own the problem AND block the '
  'fix, and "Political dynamics" exists to record that. A link row carries at '
  'most one value per axis. Admin-managed as rows, same deferral as '
  'contact_roles.';

comment on column public.contact_stances.axis is
  'Which values compete. Two today: "disposition", where they stand toward '
  'the deal, exactly one and always present; and "stake", what they hold in '
  'it regardless of where they stand, optional. Deliberately not a CHECK and '
  'not a lookup table: a third axis should be a row, not a migration.';

comment on column public.contact_stances.sort_order is
  'Global across axes, and contiguous within each, so ORDER BY sort_order '
  'gives correct order inside a group as well as a stable overall order.';

comment on column public.contact_stances.active is
  'False retires a stance from the picker without deleting it, same reason as '
  'contact_roles.active: a stance recorded on a live deal is still the truth '
  'about that deal.';

alter table public.contact_stances enable row level security;

-- Team-wide read only, matching contact_roles and closed_lost_reasons. No
-- write policy: admin-only, expressed in RLS rather than only in a route.
drop policy if exists "contact_stances_select" on public.contact_stances;
create policy "contact_stances_select" on public.contact_stances
  for select using (auth.uid() is not null);

-- WHERE NOT EXISTS, per Round 20 Phase 0, so a replay is provably a no-op.
--
-- Unknown sorts last on its axis and is the default on a new row: a contact
-- just added is someone we have not placed yet, and recording that honestly is
-- worth more than a Neutral that cannot be told apart from a real judgement.
insert into public.contact_stances (label, axis, sort_order)
select v.label, v.axis, v.sort_order
from (values
  ('Champion',   'disposition', 10),
  ('Supporter',  'disposition', 20),
  ('Neutral',    'disposition', 30),
  ('Sceptic',    'disposition', 40),
  ('Blocker',    'disposition', 50),
  ('Unknown',    'disposition', 60),
  ('Pain Owner', 'stake',       70)
) as v(label, axis, sort_order)
where not exists (
  select 1 from public.contact_stances s where s.label = v.label
);
