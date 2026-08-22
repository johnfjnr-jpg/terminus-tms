# Documentation amendments, 2026-08-22, revision B

**Supersedes Amendment 4 of `DOC_AMENDMENTS_2026-08-22.md`.** Amendments 1,
2 and 3 in that file are unchanged and still apply.

Amendment 4 was written on the belief that `PROTOTYPE_SPECIFICATION.md` and
`CURRENT_STATE.md` made claims that could not both be true. Further reading
of `DESIGN_PRINCIPLES.md`, which already carried the answer, narrows it
considerably. The revised version is below, plus a new Amendment 5
correcting `PROTOTYPE_SPECIFICATION.md` Section 3.

**Evidence basis.** All of this is read from documents in the repo, not from
the database. `DESIGN_PRINCIPLES.md` carries a dated entry at 2026-08-16
under Deferred scope, beginning "Terminus staff directory, 2026-08-16".
That entry is the source for most of what follows. **One question remains
open and needs a real query**, stated as such rather than inferred.

---

## Amendment 4, revised. `DESIGN_PRINCIPLES.md` Deferred scope

**Why.** The staff directory exists and is documented. What is not
documented, and what the Opportunity work depends on, is whether the four
Authority fields store a reference to a staff row or the staff member's
name as text. That is a narrower and more useful finding than the original.

**Anchor.** The first bullet under `## Deferred scope`, beginning:

    - **JWT "issued in the future" rejection, rare and unreproduced.**

**Insert immediately above that bullet:**

    - **The staff dropdowns constrain input but may not create a reference,
      and nothing records which. Raised 2026-08-22 while scoping Bid Review
      routing for Opportunity. OPEN, one query settles it.**

      The 2026-08-16 entry in this section records the Terminus staff
      directory: a small `terminus_staff` reference table holding name and
      title, seeded with the seven real staff names by migration, `GET`-only,
      no admin UI, replacing the free-text Terminus Lead and
      Commercial/Technical/Legal Authority fields with dropdowns on both
      Test Bed and Opportunity. **All of that is settled and none of it is in
      question.**

      **What is in question is what the selection stores.** Every genuine
      reference in this system carries `_id` in its key: `account_id`,
      `industry_id`, `installer_account_id`, `parent_record_id`. The four
      staff fields are `lead`, `commercial`, `technical` and `legal`, plain
      payload keys in `SALESPERSON_WRITABLE_KEYS`, with the Test Bed
      equivalents `terminusLead`, `commercialAuthority`, `technicalAuthority`
      and `terminusLegalOwner` in `TEST_BED_WRITABLE_KEYS`. **None carries
      `_id`.** The same 2026-08-16 entry records clearing two wrong values,
      "Boon Sain" and "Ryan Wan", from `commercialAuthority` and
      `technicalAuthority`, which are name strings, though that describes the
      state being cleaned rather than the state after.

      **The question, and it is one query:** read a live record's payload and
      check whether `lead` holds a UUID or a name.

      **If it holds a name, the dropdown is an input constraint rather than a
      directory reference**, and three consequences follow. A staff member
      leaving, or a spelling correction in `terminus_staff`, leaves every
      historical record pointing at a string that no longer resolves to
      anyone. Nothing can be counted per person reliably. And **Bid Review
      cannot route to a person**, which is the reason this was raised: the
      Opportunity model puts a Sales Lead approval at three stages and a Bid
      Review approval at the gate into Proposal, and `routing_rules` holds
      zero rows.

      **Not a defect, and not scheduled.** For display and for constrained
      entry a name string is adequate, which is presumably why it was built
      that way. It becomes load-bearing only when something routes off it.
      Recorded now so that the round which builds routing meets this note
      rather than the consequence.

      **Score attribution is NOT affected and is sound.** A score entry's
      author is written server-side from the authenticated session and never
      accepted from the client, settled in Round 11. Who recorded a score and
      who is named as Sales Lead on the record are two different
      attributions, and only the second is in question here.

---

## Amendment 5, new. `PROTOTYPE_SPECIFICATION.md` Section 3, stale premise and stale conclusion

**Why.** Section 3 states that no staff directory record type exists
anywhere in this system, and then records the build decision that follows
from it: the four Authority fields stay free text with no dropdown swap.
**Both statements are now false.** The directory was built on 2026-08-16 and
the fields were converted to dropdowns in the same change.

This is not a tidiness correction. A reader of Section 3 today is told the
fields are free text and would build accordingly. Section 3 carries a green
status marker, so `CLAUDE.md` build-discipline rule 4 does not require an
extraction pass before building against it, which makes the stale text more
dangerous rather than less.

**Anchor 1**

    Lead/Contact/Account model. There is no staff directory record type
    anywhere in this system. Same finding, same reasoning, as Test Bed's
    own Owner-field decision in Milestone 3, caught before build this time
    rather than after.

**Replace with**

    Lead/Contact/Account model. There was no staff directory record type
    anywhere in this system at the time. Same finding, same reasoning, as
    Test Bed's own Owner-field decision in Milestone 3, caught before build
    this time rather than after.

    **SUPERSEDED 2026-08-16, recorded here 2026-08-22.** A staff directory
    was subsequently built: `terminus_staff`, a small reference table
    holding name and title, seeded with the seven real staff names by
    migration, `GET`-only API, no admin UI, following the same governance
    pattern as `industries` and `stage_definitions`. See the "Terminus staff
    directory, 2026-08-16" entry under Deferred scope in
    `DESIGN_PRINCIPLES.md` for the full record. The reasoning above remains
    correct about why these fields are not Contact records. It is no longer
    correct that no staff population exists.

**Anchor 2**

    built for Contact-to-Account linking, not a new one. **Terminus Lead,
    Commercial Authority, Technical Authority, and Legal Authority stay
    free text**, unchanged from their original field names, no
    Contact-dropdown swap, since these were never mislabeled as client
    contacts in the first place, unlike Test Bed's fields, which needed
    renaming as well as re-scoping.

**Replace with**

    built for Contact-to-Account linking, not a new one. **Terminus Lead,
    Commercial Authority, Technical Authority, and Legal Authority were
    built as free text**, unchanged from their original field names, no
    Contact-dropdown swap, since these were never mislabeled as client
    contacts in the first place, unlike Test Bed's fields, which needed
    renaming as well as re-scoping.

    **SUPERSEDED 2026-08-16, recorded here 2026-08-22. All four are now
    dropdowns**, sourced from `terminus_staff`, on Opportunity and on Test
    Bed. **Account carries a fifth staff-sourced field**, its own
    `terminusLead`, populated from the same list through the shared Account
    Details panel, so the directory feeds three record types rather than
    two. The decision NOT to make them Contact records stands and was
    correct; what changed is that they are no longer unconstrained text. The
    same change fixed a real latent bug in `refFieldRow`, Opportunity's
    field-rendering function, which lacked the leading blank `<option>` that
    Test Bed's equivalent already had, so an unset field's edit-mode dropdown
    silently pre-selected the alphabetically-first name.

    **What these fields store is not recorded anywhere and is an open
    question**, raised 2026-08-22 under Deferred scope in
    `DESIGN_PRINCIPLES.md`. The dropdown constrains entry. Whether the
    payload holds a reference to a staff row or the name as text is
    unverified, and it determines whether approval routing can ever key off
    these fields. **Do not assume either answer from the presence of the
    dropdown.**

---

## Verification for this change

1. Each anchor matched exactly once before editing. Confirm with `grep -ac`
   on the anchor's first line. Use `grep -a`, per Verification rule 12.
2. `grep -n "^## " PROTOTYPE_SPECIFICATION.md` returns the same heading
   count and the same headings as before. No heading created, moved or
   consumed.
3. Section 3's status marker is unchanged. **It stays green.** The section
   is still fully extracted; two of its statements are now marked as
   superseded, which is a different thing from the section being
   incompletely known.
4. **No em dash in any text this change introduces.** The em dash count is
   unchanged at 28 in `PROTOTYPE_SPECIFICATION.md` and zero in every other
   file. **The 28 are pre-existing and this criterion must not be written as
   zero for that file**, which is what an earlier draft of this line said and
   what would have failed the moment it was checked. They sit in section
   headings, including Section 3's own, and removing them is a deferred item
   rather than this round's work.
5. `CURRENT_STATE.md` unchanged and untouched.
6. **The open question is not answered in either document.** If the query
   gets run during this change, the answer lands as a new dated entry in
   `DESIGN_PRINCIPLES.md` and both notes above are updated to point at it.
   Do not resolve it by inference from the field names.
