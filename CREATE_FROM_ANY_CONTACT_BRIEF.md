# Create from any contact: brief

Governing docs: CLAUDE.md, the tms-round-method skill,
CREATE_FROM_OWNERSHIP_BRIEF.md (whose R5 this round supersedes for two
paths), DESIGN_PRINCIPLES.md. Branched off `main` at f005c0e, confirmed on
origin by John's ls-remote. This brief's R-series is its own.

## The defect, as reported (John, 2026-11-22)

> Any signed-in user may create an Opportunity from ANY contact they can see,
> whoever owns the contact or its Account. The creator owns the new
> Opportunity. Creation writes the new Opportunity and its own links ONLY; it
> writes nothing on the contact or the Account. Editing a contact or Account
> stays owner-only (unchanged).
>
> Today John gets "This record belongs to another user. You can view it, but
> only its owner can change it." on Create Opportunity from a contact he does
> not own (main f005c0e, not pushed).

## Phase 0 findings (2026-11-22, read-only; report in OneDrive as
## 2026-11-22_CREATE_OPP_FROM_ANY_CONTACT_PHASE_0.md)

- The refusal is the source-owner check inside `create_opportunity_from_contact`
  (`20260908000003`), 42501, mapped to 403. Ruled behaviour since the
  create-from ownership round's R5, not a regression; identical on 40c4c09.
- From the Contacts list the POST is refused 403. From the contact's own screen
  no request is sent: the door disables the menu item.
- The path's only writes keyed on the contact are the `created_opportunity`
  audit row and the `record_freshness` bump its trigger makes. The Account is
  read only.
- The five remaining writes were issued one by one as a non-owner of the
  contact and all five were ADMITTED by today's policies.
- No gate probe exercised a non-owner creating from someone else's contact; the
  create-from probe was retired unwired at PROBE_TRIAGE.

## Rulings of record (John, 2026-11-22: "go with recommendations")

Verbatim.

R1  Opportunity from a contact: any signed-in user, any contact they can see
    (status Qualified, as the route requires). The creator owns it. The
    function writes nothing on the contact or Account. The migration is
    APPROVED as drafted (owner check and the contact-keyed audit row removed;
    nothing else).
R2  Rollback: through the estate's rollback generator and pin test (as
    TERM_QUOTES M3). The draft's restored comment is TRUNCATED (unterminated
    string at "caller must OWN the source Contact;"); generate it from
    20260908000003, never retype it.
R3  Test Bed convert: stays owner-only.
R4  Create Test Bed from a contact: follows R1. Any user, the creator owns the
    bed, nothing written on the contact or Account. Phase 0 its writes the same
    way (fingerprint the contact and Account), and STOP if any write touches
    the contact before changing it.
R5  The contact-history "created_opportunity" row is retired for all
    creators. Accepted.
R6  Qualifying stays an owner-only edit of the contact.
R7  The door: the declared exemption covers exactly the create-Opportunity and
    create-Test-Bed items. The pure test pins that set exactly.
R8  Supersede R5 of CREATE_FROM_OWNERSHIP_BRIEF in DESIGN_PRINCIPLES for these
    two paths, with the reasoning left visible.
R9  Probe probe-create-from-any-contact.mjs as proposed, a gate stage, with
    Test Bed added to checks 1 to 4 and removed from the counterfactuals.
    Calibrate as proposed.
Queued, not this round: the reference code burned by a failed create.

Sequence: spec and brief, migration and rollback committed and STOP for my
review (John applies), tests fail first, function and client, calibration,
probe, full gate, merge --no-ff, merged gate, ls-remote, "ready for John's
push".

## The behaviour, as claims (tests derive from these, not from the code)

C1  A signed-in user who does not own a Qualified contact creates an
    Opportunity from it: 201, from the Contacts list AND from the contact's own
    screen.
C2  The same for a Test Bed (R4), subject to R4's Phase 0 stop.
C3  The new record is owned by the creator, its account_id is the contact's
    Account, and its record_contacts link is held on the new record's side
    (record_id = the new record).
C4  Nothing is written on the contact: its revision, updated_at, owner_id,
    audit_log row count and record_freshness are unchanged by the creation.
C5  Nothing is written on the contact's Account: the same fingerprint,
    unchanged.
C6  Editing the contact stays owner-only: the non-owner's PATCH of it is
    refused and its edit controls stay doored (R6 likewise keeps Qualify
    owner-only).
C7  Test Bed convert stays owner-only (R3).
C8  The door exempts exactly two controls, the contact screen's
    create-Opportunity and create-Test-Bed menu items, by a declared property.
    A pure test pins that set.
C9  The rollback is generated from 20260908000003 and restores it byte for
    byte, pinned by a pure test.

## R4 Phase 0: create-test-bed's writes (2026-11-22). R4'S STOP FIRED

Measured on the owner path (a non-owner is refused today), fixture `p0r4tb`,
fingerprinting the contact and its Account before and after
`POST /contacts/:id/create-test-bed` (201):

    CONTACT  audit_log    [created, linked_account, transition]
                       -> [created, linked_account, transition, created_test_bed]
    CONTACT  record_freshness  01:51:01.943707 -> 01:51:05.971318
    CONTACT  revision, updated_at, owner_id, status    unchanged
    CONTACT  record_contacts rows naming it   0 -> 1   (the bed's own link,
             record_id = the new bed: the shape R1 accepts for Opportunity)
    ACCOUNT  revision, updated_at, owner_id, audit rows, freshness   unchanged

ONE WRITE TOUCHES THE CONTACT: the route's audit_log row
`{ record_id: contact.id, action: 'created_test_bed' }`
(src/routes/contacts.js, the create-test-bed route's audit insert), and through
`audit_log_touch_freshness` it bumps the contact's record_freshness. It is the
twin of the `created_opportunity` row R5 retires. Nothing reads
`created_test_bed` (grep of src, frontend, frontend-react/src, scripts: the
write is its only occurrence).

Per R4, create-test-bed is NOT changed; the round stops for a ruling on that
row. The fixture is torn down (2 records, 0 remaining).

## Review of b834151 and e332bd6 (John, 2026-11-22). Verbatim

M   Migration 20261122000001 APPROVED. John has applied it (begin/commit)
    and recorded the ledger row by hand.
R4 RULING: retire the contact-keyed "created_test_bed" audit row for all
    creators, as R5 does for Opportunity. The bed keeps its own
    created_from_contact row naming the contact. Then remove the route-level
    owner guard on create-test-bed (R4 as briefed);
    create-from-ownership.test.mjs's ruled list drops from four to three, with
    the reason recorded.
Q   Queue, not this round: the create-test-bed route is five separate writes,
    not one transaction, with an unchecked audit insert (the atomic-creation
    rule of record: a creation path is born atomic via an INVOKER function).

Sequence from here: post-apply proof (a non-owner's create succeeds at the
database; the function no longer raises 42501 for a non-owner; nothing is keyed
on the contact), tests fail first, function and client (R7 door exemption for
exactly the two items), R8, the R9 probe and calibration, full gate, merge
--no-ff, merged gate, ls-remote, "ready for John's push".

## The build, against the sequence (2026-11-22)

1. Post-apply proof, at the database (RPC called as the non-owner, RLS in
   force, fixture p1post): 10/10. The non-owner's create succeeds (no 42501);
   owner the creator, account_id the contact's Account, link on the new side,
   ONE audit row on the new Opportunity naming the contact; contact and Account
   fingerprints unchanged; an Account id still raises PT404 (the body runs).
   The fingerprint was shown moving on an injected contact-keyed audit row.
2. Tests first, read red: 5 of 13 failing, each on its ruled change.
3. Function and client (ae1a1c9): create-test-bed drops the contact-keyed row
   and the route guard; loadQualifiedContact stops selecting owner_id (no
   reader left); the door exempts `[data-creates-own-record]`, declared on
   exactly the two items; create-from-ownership's ruled list is three.
4. R8 (ae1a1c9): DESIGN_PRINCIPLES "CREATE FROM ANY CONTACT". FINDING: R5 of
   CREATE_FROM_OWNERSHIP_BRIEF had never been written into DESIGN_PRINCIPLES,
   so the superseded ruling is quoted there for the first time.
5. R9 probe (826eb9e, 0739910), gate stage `browser create from any contact`:
   22/22 on the dev server. Calibrated by
   scripts/create-from-any-contact/calibrate-probe.mjs on a temp copy of HEAD
   served on :3013: first run 7/8 FIRED, injection 7 SILENT (a stylesheet
   rule the JS door duplicates; and 5b read field rows only, not the inputs).
   5b now asserts the 16 inputs; second run 8/8 FIRED by their named checks,
   reverted 22/22.
6. Two probe defects found by the run and fixed: the list re-render detached
   the trigger handle (now a network-idle wait and one retry), and a triple
   click did not select the suggested name, found by opening a screenshot
   (now select-all, and the stored name is asserted).
7. Residue: 18 tags swept across every owner, 0 live.
8. docs/PROBES.md disposition counts had drifted before this round (35 stages,
   158 WIRED typed; 38 and 161 measured); recounted.

Still queued, not built: create-test-bed's five non-atomic writes and its
unchecked audit insert (Q); the reference code a failed create burns.
