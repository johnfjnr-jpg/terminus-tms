# Hygiene round (walk 7): close-out

Branch `hygiene-1`, off `main` at `4941ee1`, confirmed equal to `origin/main`
by `git ls-remote` against the real remote rather than the local tracking ref.

Rule 18 governs: **this round ends "ready for John's push"** and nothing is
pushed from the session.

---

## STEP 1 - F1, and it was four defects rather than one

John reported that the Key customer contacts picker "does not pull the linked
account's contacts into the dropdown". Reproduced on his own records before
anything was changed, hard-reloaded first.

**R-W3 SHIPPED AND ITS SCOPING WORKS.** `f1fb4a9` is an ancestor of `main`,
the request goes out as `?account_id=`, and it comes back with exactly the
right rows: 4 of 4 for the account, verified against the database. All 18 live
opportunities carry an `account_id` and every one of those accounts holds
contacts, so an empty picker had no data explanation.

**WHAT JOHN WAS LOOKING AT.** The dropdown read `Choose a contact` and then
four blank lines.

| | The defect | Age |
|---|---|---|
| **contacts** | rendered `c.name`; the route answers record rows with the name at `payload.name` | since `da207cf`, never worked |
| **roles** | rendered `r.name`; `/contact-roles` answers `{id, label}` | same |
| **stances** | rendered `s.name`; `/contact-stances` answers `{id, label}` | same |
| **the role option's value** | was the name, so even a correct label posted the wrong thing | same |
| **Add** | posted `role`; the route takes exactly one of `role_id` or `role_other` and refuses otherwise | same |
| **the linked list** | asked `GET /opportunities/:id/key-contacts`, **which does not exist** - 404 on every load | same |

**NONE OF IT IS R-W3's DOING.** R-W3 corrected WHICH contacts arrive, never
their labels.

**THE CAUSE IS ONE MISTYPE.** `KcVocabItem { id, name }` was written for the
two vocabulary TABLES, which really do carry a top-level `name`, and all three
fetches were typed as it. Five readers of `/api/contacts` exist and four are
correct: the Test Bed's own picker reads `c.payload?.name ?? c.id`, and both
contact screens read payload. The Opportunity picker was the only one reading
a field the route does not return.

**THE LINKED LIST NEEDED NO NEW ROUTE.** `GET /opportunities/:id` already
returns `key_contacts` on the record the host's same load fetches, so the
second request was a second reader of a value the first one carried, and the
only one of the two that could fail. One request now, mapped.

**WHY ADD AND THE LIST ARE PART OF F1** rather than carried findings: build
discipline 10's own limit. Both were broken before this round and neither was
REACHABLE, because no contact could be meaningfully chosen from a list of
blank lines. Making the picker correct makes them the next thing John hits.

**NO TEST COULD HAVE CAUGHT ANY OF IT.** The R-W3 tests assert the PATH, not
the rendered options; the api stub returned `[]` for every path, so no test
had ever supplied a contact; and the host's stub answered `key-contacts` with
`{ ok: true, data: [] }`, which made a route that does not exist look like a
route with nothing in it. That stub answers 404 now, as the real server does.

**Evidence.** Seven new tests, red-first, each failing on its own assertion.
Live 10/10 across five statuses at 1440 and 1240 on John's records, and 15/15
on an owned fixture including the Add driven through the UI and read back from
the database: `record_contacts` 1 to 2, carrying the required `role_id`.

---

## STEP 2 - F2: it does not fit, and the floor is 664px

| | Floor | Free beside Key Dates | |
|---|---|---|---|
| 1440 | 664px | 640px | short by **24px** |
| 1240 | 664px | 440px | short by **224px** |

Not built. The floor is reported, which is what F2 asks for.

**THREE MEASURES DISAGREED AND TWO WERE MINE BEING WRONG.** `scrollWidth`
against `clientWidth` says FITS at any width, because a table compresses
rather than overflowing. Card HEIGHT said NO WRAPPING at 440px while the
screenshot showed every name on two lines: the table is `width:100%`, so
`max-content` on the card never lets it reach its natural width and both sides
were equally wrapped. The honest measure counts LINE BOXES with a Range over
each cell, against a deliberately wide reference render.

**AND THE FIXTURE WAS THE WRONG POPULATION.** Short fixture names gave 633px
and said FITS at 1440. The live records hold "Wong Guang Shing".

**AND THE FLOOR MOVED BETWEEN RUNS**, 598px then 664px on the same content,
because fonts had not settled at the first paint. It waits for
`document.fonts.ready` now and reads 664px in three consecutive runs.

---

## STEP 3 - the ledger

| | Disposition | State |
|---|---|---|
| 1 | `#ref-vanilla` removed, dependents re-pointed | **done** |
| 2 | `ref-save-feedback` renamed apart | **done** |
| 3 | `.tab-action-idle` deleted | **done** |
| 4 | `input.input-invalid` deleted | **done** |
| 5 | empty contractor schedule suppressed | **done** |
| 6 | 1240 chevron clip fixed at its mechanism | **done** |
| 7 | PO factoring toggle left alone | **untouched, by ruling** |
| 8 | the tax line | **order and wording done; ONE LINE short by 33px, reported** |
| 9 | units-audit tail | **L7 install half, L8, L10 closed; L7 main half, L12, C9 listed** |
| 10 | stale unwired probes deleted | **five, not eight - see below** |

### 1: what the removal actually cost

118 lines. Its two order-assertion dependents both rest on "getElementById
returns the first in document order", and both are now true for a better
reason: the `ref-*` ids have left the live duplicate-id list entirely.

**AND A DEPENDENT NOBODY HAD ENUMERATED, found by driving the screen.**
`app.js` still WROTE to four cells inside the block. With the markup gone the
first threw and the whole Opportunity view sat at `is-loading` with the
Reference tab empty. The live readers for those figures are in
`#opp-headline` and always were, so the four lines wrote to a strip nobody
could see. Verification 43's clause from the other direction: when a
retirement removes markup, find what WROTE it.

### 10: five, and the eight are the reason

A name-based grep for `ref-vanilla` among unwired probes returns **exactly
eight**, and every one is a WORKING probe that merely names the block in an
exclusion filter - including the three walk 6 committed as its own evidence.
Deleting those would have destroyed the evidence for the round before this one.

What is genuinely dead is a probe that DEPENDS on something removed, and there
are five. Two wait on conditions that can never be satisfied again, which is
Verification 7's inverse and reads as a feature that has stopped working. Both
retirement claims checked with comments stripped: gone, and 0 referrers each.

### 8: the 33px, and why they are not taken

Measured with the labels stacked: 155 + 201 + 75 plus gaps is 463px against
roughly 430px of usable card. Inline it was 590px and the row hung 146px
OUTSIDE its card. The three ways to close the remainder are all design
choices, so they are reported: shorten the gross-up label, which is 201px of
the 463; let the Tax card span two columns, free at 1440 and impossible at
1240; or raise `.terms-cards`'s deliberate 460px cap, which dresses every card
in the section. It wraps rather than overflows in the meantime.

---

## Housekeeping

- **Fixtures torn down**, re-queried by OWNER: 132 of 132 live records walked,
  **zero created in the last five hours**, three owners all real accounts.
- **Walk 5's close-out was already in OneDrive**, complete at 139 lines,
  delivered 2026-09-20 23:05. Not duplicated.

---

## Exit gate

| Point | Answered |
|---|---|
| F1 established, then fixed in full | **Yes**, and it was four defects rather than one |
| F2 measured at 1440 and 1240 with real content | **Yes.** Floor 664px; does not fit at either |
| Every ledger item built, ruled or listed | **Yes** |
| Red-first where behaviour moved | **Yes**, every fix |
| Guards calibrated both directions | **Yes**, and the restores are byte-identical |
| Live proof at 1440 and 1240 | **Yes** |
| Screenshots opened and read | **Yes**, and three changed the work |
| Database read-back where written | **Yes**, the Add |
| Fixtures torn down, re-queried | **Yes** |
| `CURRENT_STATE.md` regenerated | see below |
| Full gate, branch and merged | see below |
| Pushed | **No push from the session** |
