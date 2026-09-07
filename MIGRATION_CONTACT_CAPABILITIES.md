# The Contact surface's remaining capabilities, as behaviours

**Round 6 Phase 2b, 2026-09-07.** Written from `frontend/contact-detail.js`
before any of it was built, in the B-style the Qualify workflow was enumerated
in at Phase 0.

**Why this document exists.** Phase 0 censused FIELDS and the swap removed five
working capabilities from the screen. The census-completeness detector now
catches that class before a swap; this is the enumeration it should have
produced.

---

## N. THE NOTES HISTORY

**N1.** The list is **append-only and latest first**, never truncated. Each row
shows *when*, *who* and *what*. Empty reads `No notes yet.`

**N2. One control does double duty.** Idle, it opens the input. Open and
non-empty, it submits. **Open and empty it is disabled**, so the empty state
cannot reach the submit branch - which is what makes one button safe rather
than two elements with one id.

**N3. Available at EVERY stage** - Unqualified, Parked, Qualified alike - unlike
the field-edit notes, which only exist because a save happened.

**N4. It writes to the SAME history** as field-edit notes and the park note.
One list, three authors.

**N5. It carries the revision handshake.**

**N6. A 409 RELOADS AND KEEPS THE TYPED TEXT.** The reload shows the note that
beat this one and re-arms the screen with a current revision, so a second click
lands. Losing what the person typed at that moment would be the worst possible
response to a race.

**N7. A dirty surface is asked first.** The add ends in a reload, which would
silently discard any other field left open and dirty.

**N8. Discard closes and clears.**

**N9. The input resets on every fresh render**, or a stale open input persists
onto whatever contact loads next.

---

## P. THE PARK FORM

**P1. Park requires BOTH a follow-up date and a reason.** Each has its own
sentence: `Follow-up date is required.` and `A reason for parking is required.`

**P2. It is TWO writes in order:** a PATCH carrying `followUpDate` and the note,
then the transition to `Parked`. **The note is written before the move**, so a
failed transition leaves the reason recorded rather than lost.

**P3. The note reads** `Contact parked. Follow up on <date>. <reason>`.

**P4. The PATCH carries the revision handshake**, and its 409 says so.

**P5. A failed transition reports in the form**, which stays open.

**P6. THE TWO DISMISSALS ARE DELIBERATELY DIFFERENT.** Backdrop click is an
*accidental* dismissal and is **refused outright** - the Save button is
highlighted, a warning appears, and the form stays open. Cancel and Escape are
*intentional* leave actions and get a real choice, through the shared discard
dialogue.

**P7. Dirtiness is tracked from the fields**, not from having opened the form.

**P8. THE FORM CLOSES BEFORE THE DISCARD DIALOGUE OPENS.** Found by testing in
the vanilla: the park form is a fixed full-screen popup, so leaving it open
under the confirm modal meant *"Keep editing"* left the person stuck - unable to
reach the Save button they had gone back to use.

**P9. Focus-trapped per INTERACTION_STANDARDS section 4**, which uses Park as
its own worked example: focus to the first field on open, Tab cycles within the
form, Escape closes as Cancel does.

---

## U. UNQUALIFY

**U1.** A transition to `Unqualified`, then the list and the record are
re-read.

**U2. A dirty surface is asked first**, same reason as N7.

**U3. It is offered only when the contact is not already Unqualified.**

---

## D. DELETE, AND CREATE

**D1. Delete is `DELETE /api/contacts/:id`**, then the list is re-read and the
screen returns to **the return view** - so a deleted lead goes back to leads and
a deleted contact to contacts.

**D2. A failed delete does nothing and says nothing.** Recorded as it is rather
than improved: a migration moves behaviour. **Named as a divergence candidate
for Phase 3.**

**D3. Create is offered ONLY on a Qualified contact**, and offers a Test Bed or
an Opportunity.

---

## A. THE ACCOUNT-DETAILS MODAL

**A1. Two modes, one modal.** `new` is a creation form; `view` shows a linked
Account read-only.

**A2. It opens automatically when Qualify is blocked on the Account AND the
company matches no existing Account** - because there is nothing to reconcile
against and the search step would be an empty list plus a "create" row the
person has to click anyway. **When it does match, the lighter link panel opens
instead.**

**A3. The name is required.**

**A4. The reference number reads `Not yet generated` until the Account exists.**

**A5. It can name a PARENT account**, searched by the same substring rule the
link panel uses.

**A6. Backdrop click closes it.**

---

## What this enumeration is NOT

**It is not a promise to reproduce every detail.** Two are already flagged as
divergence candidates: D2's silent failure, and whether the park form should
remain a full-screen popup on a surface that no longer has a card grid to cover.

**And it does not cover `syncCdBelowGridWidth`**, the seventh capability the
accounting flagged. That one exists to keep a block aligned to the card grid,
so it is a consequence of the layout decision rather than a behaviour of its
own, and it is settled by whatever the rebuilt surface does about cards.
