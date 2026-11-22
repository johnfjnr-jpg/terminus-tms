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
