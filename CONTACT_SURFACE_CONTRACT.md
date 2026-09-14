# The contact record surface: behaviour contract

**Written BEFORE the swap, and the re-pointed tests derive from THIS, never
from the rewritten component.** Verification 47's component clause: a
replacement and its tests derived from the source being replaced will agree
with themselves. This round exists because Round B refused to do that in a
rush.

Each behaviour is stated as a requirement about the SCREEN - what a person
can do and what the system must record - not as a description of any
component. Where the current implementation satisfies a requirement by an
accident of its shape, the requirement is written without that shape.

---

## The rows

- **C1.** Every field in the contact census renders, and renders **exactly
  once**. A field that renders twice has two editors of one value.
- **C2.** A lookup field shows the **name**. An id never reaches the screen.
- **C3.** The Summary field accepts **multi-line** text.
- **C4.** The contact's name appears as the screen's heading **and remains
  editable**. The heading is a display, not a substitute for the field.
- **C5.** Fields the route can write but this surface does not own -
  `legalEntity`, `followUpDate` - **render nowhere**.

## The save

- **C6.** Only **changed** fields are sent.
- **C7.** The lookup is sent as its **column**, never as a payload key. The
  route rejects a payload key it does not own, so this is the difference
  between a save and a silent refusal.
- **C8.** **One notes-history entry per save session**, naming every field
  that changed, **prepended** to the existing history, which is preserved.
  Not one entry per field.
- **C9.** The note names a lookup **by name**. An id never reaches the notes
  history.
- **C10.** The save carries the record's **expected revision**, read from the
  record itself.
- **C11.** **Nothing dirty sends nothing.** Opening an editor and closing it
  unchanged is not a save.
- **C12.** A refusal because the record moved shows the **shell's**
  stale-write treatment, which carries a reload control. A surface wording
  its own sentence tells somebody to reload and gives them no way to.

## Qualification

- **C13.** A clean qualify transitions the record and returns to the contacts
  list, leaving **no tint**.
- **C14.** A refusal naming blocked fields **tints those fields**.
- **C15.** A blocked **lookup** tints the lookup.
- **C16.** A blocked **account** tints the **account card**, not a field row.
  The account is not a row.
- **C17.** A blocker that cannot be placed on the screen is **said out
  loud**, never silently dropped.
- **C18.** Resolving a blocked field **clears its tint**, and clearing is not
  a re-attempt: it reports fewer blockers, never success.

## Leaving

- **C19.** A **Qualified** contact returns to the contacts list; an
  **unqualified** one returns to leads. The destination follows the record's
  **current** status, not the status the screen was opened with.

## The account

- **C20.** A record with a linked account shows the **account's name**.
  **Linked-but-unresolved and not-linked are different states** and must read
  differently: collapsing them is what hid the defect Round B found on all
  ten live contacts.

## View mode - THIS ROUND'S ADDITION

- **C21.** On a record with nothing missing, **no completion framing
  appears**. No "please complete", no to-do voice.
- **C22.** The primary control reads as a **detail-view save**. "Save and
  continue" names a step that does not exist here.
- **C23.** **Marking is still governed by the server's blocking list, not by
  the mode.** Round B's own recorded fault: suppressing markers *always* is
  stronger than the requirement and deletes the qualification tinting. The
  mode governs **framing**; the server governs **marks**.

---

## What the contract does NOT specify, deliberately

- **Which component renders any of it.** C1-C23 are satisfiable by more than
  one shape, which is the point.
- **The interaction idiom** - click-to-edit rows versus always-open inputs.
  Both satisfy every requirement above. That is a design decision, recorded
  in the phase report where it is taken, not smuggled in here.
- **Where stage progression, park and create-from live.** Those capabilities
  are outside this surface's contract and are governed by the round's
  unresolved R4.
