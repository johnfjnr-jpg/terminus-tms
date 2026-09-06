# Migration Round 4, Phase 1: the card, behind the line

**Nothing is registered.** The vanilla version card is still the loaded one, and
two guards now keep it that way until Phase 2 changes it deliberately.

---

## 1. What was built

| file | what |
|---|---|
| `frontend-react/src/versions/model.ts` | the card's logic: range, label, author, when, approval line, track line, issue view, ask view, reason prompt, empty state |
| `frontend-react/src/versions/VersionCard.tsx` | the render, carrying all eleven ids the vanilla owns |
| `frontend-react/src/__tests__/version-fixtures.ts` | the approval-line fixture builder |
| `frontend-react/src/__tests__/version-card.test.tsx` | **36 tests**, one per behaviour family, named against Phase 0's enumeration |

**Values go through the shared presenters.** `reasonPromptFor` and
`namedChangedKeys` are imported from `src/lib` and never restated, so the
question the box asks, the refusal it gives when blank, and the way changed keys
are named cannot drift from the vanilla or from the approval page.

**ESCAPING IS COMPOSITION, and the file says so.** The vanilla builds the list
with `innerHTML` and calls `escapeSheet` on every interpolation. There is no
`escapeSheet` in the React card and there must never be one: a reason carrying
markup is text because React puts it in a text node, and adding an escaper would
mean something had started being built as markup again.

---

## 2. The reporter interface, which Phase 0's finding forced

Phase 0 measured that `app.js` disables `#btn-request-pricing-approval` and
writes `#pricing-approval-state` **directly by id**, four times, while a request
is in flight. Against a React card those writes are overwritten by the next
render, silently, and the button re-enables itself mid-request.

The card therefore hands over an **interface** rather than its DOM:

```ts
onAsk(versionId, label, { onStart(), onResult(message, ok) })
```

The card owns both elements throughout; the requester says when it starts and
what happened. `onStart` disables the button and sets `Requesting...`;
`onResult` releases it and writes the outcome.

**Asserted, and it is the test that matters most in this phase:** after
`onStart`, a **re-render of the same tree** must leave the button disabled and
still reading `Requesting...`. That is the exact failure a naive port would
have, and the injection that removes `asking` from the disabled expression fires
it.

**The `app.js` dual-mode change is Phase 2's**, as instructed. Nothing in
`app.js` was touched.

---

## 3. The fixture builder

`aVersion(spec)` builds a version in any state, and
`allFixtureOnlyVersions()` produces **one in each of the six a walk cannot
reach**, each recorded with why:

| state | why a walk cannot produce it |
|---|---|
| `approved` | needs a decision from somebody who is not the requester |
| `rejected` | same rule, opposite decision |
| `superseded` | approved, then the pricing moved: it inherits approved's blocker |
| `unknown` | an approved version whose comparison is not comparable |
| `unapprovable` | taken before versions recorded their revision; no live path makes one |
| `inconsistent` | documented in the evaluator as unreachable by construction |

**One builder, because they are one family** - they differ only in the approval
object hanging off a version, and six separate builders would be six chances to
build one wrongly.

**The four walkable states are deliberately NOT built here.** A fixture
duplicating draft, issued, restored-from and none would be a second definition
of what the walk already proves, and Phase 2 and 3 cover them live.

**Non-zero by construction:** every field a behaviour reads gets a distinct,
non-empty value, and `revisionApproved` defaults to `37` precisely because
nothing else in the fixtures uses it, so a line reading the wrong field cannot
match by luck.

---

## 4. Calibration: 15 injections, all firing

Verified-snapshot harness over the two source files, restore checked after each,
final reverted run green.

**The four the brief names, all fired:**

| injection | caught by |
|---|---|
| a state's controls leak: an approved version is offered for asking again | `an already-approved version says so and does not offer to ask again` |
| the newest-draft targeting is wrong: the latest draft, not the newest | `I1: the target is the newest draft, NOT the latest one` |
| an unescaped reason, emitted as markup | `W7: a reason carrying markup is TEXT, never markup` |
| the range note drifts: it counts the total, not the hidden | `R4: the note counts what is hidden, and pluralises on THAT` |

**And one per remaining family:** the toggle showing at the floor, an issued
version reporting its creator, a restore lost from a rejected row, superseded
reading as approved, the track line on every row, a rejection reading like an
approval, a blank reason written anyway, a refused save discarding the reason,
the feedback classes losing exclusivity, the card taking the button back, and
the empty state ceasing to name the act.

### TWO CAME BACK SILENT FIRST, and Verification 51 says that is the finding

**`W6: a rejected version loses its restore control` was SILENT.** The injection
hid the control; the test asserted `querySelector('[data-restore-version]')` is
not null, and **a hidden element still matches a selector**. Presence is not
availability. The assertion now checks the control is not hidden, not disabled,
and not inside a hidden parent, and the injection fires.

**`N3: a refused save throws the typed reason away` was SILENT**, and that one
was my injection rather than the test: it reordered two statements on the
SUCCESS path, where the refused case never reaches either. Rebuilt to clear the
reason inside the `catch`, it fires.

---

## 5. Behind the line, and how that is kept

| guard | where |
|---|---|
| the bundle registers no `initOpportunityDealVersions` | `version-card.test.tsx` |
| the vanilla card's script tag is still LIVE, not commented | `live-form.test.mjs`, extended |

**The second went into `live-form.test.mjs` rather than the React suite**,
because that file already owns the question "which file is loaded" and asking it
twice would be a second reader of one fact. It also inverts at the swap, exactly
as the form's did, and is written to say so.

---

## 6. Surprises

- **A hidden element satisfies a presence assertion.** The W6 silence is the
  general lesson: `querySelector` answers about the document, not about what a
  person can use.
- **`import.meta.url` is not a file URL under vite**, so a React test cannot
  read a repository file the way a Node test can. That is what pushed the
  loaded-file guard to where it belonged anyway.
- **Six fixture states against a default range of five renders five.** Two tests
  failed on that and both were mine: the range was doing its job, and the tests
  now open the range before counting rows.
- **`namedChangedKeys` joins three with commas and appends ` and N more` with no
  comma before the `and`.** My assertion restated a rule I had guessed; it now
  matches the shape the shared reader actually produces.
