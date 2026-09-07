// ── A MIGRATED SURFACE MAY NOT REUSE AN ID THE MARKUP STILL CARRIES ──────
//
// Round 6 Phase 1, from a defect this round introduced and measured.
//
// The React Reference bar was given `id="ref-save-all"` so the shell's reason
// dialogue could return focus to it. The dialogue does
// `document.getElementById(returnTo)?.focus()`, and MEASURED IN THE BROWSER
// there were then TWO elements with that id: the vanilla's tab-action button
// lives in #opp-tab-actions, which sits OUTSIDE the #ref-vanilla block the swap
// hides. getElementById returns the first in document order, so focus went to
// the vanilla button in a different container.
//
// The swap hides a surface; it does not remove every id the old markup owns.
// A scan cannot see the runtime DOM, so this asserts the STATIC half: no id a
// React component declares may already exist in index.html.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url)

const walk = (dir) => readdirSync(new URL(dir + '/', ROOT), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`)
    : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []))

const markupIds = () => {
  const html = readFileSync(new URL('frontend/index.html', ROOT), 'utf8')
  return new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))
}

test('the scan can see an id in the markup at all', () => {
  const ids = markupIds()
  assert.ok(ids.size > 100, `only ${ids.size} ids parsed from index.html`)
  assert.ok(ids.has('ref-save-all'),
    'the vanilla id this rule was written about is gone, so re-derive the rule')
})

/**
 * IDS A REACT COMPONENT MAY SHARE WITH THE MARKUP, each with its reason.
 *
 * The rule is not "never reuse an id": it is "never reuse an id that will
 * still be in the document when yours is". `createRoot` CLEARS its container
 * on first render, so every id inside a mount container is destroyed the
 * moment React mounts and cannot collide with anything React then renders.
 *
 * ApprovalView is the whole-view case: React owns #view-opportunity-approval
 * and REPRODUCES the frame - same classes, same ids, same order - because
 * createRoot destroyed the original. The markup stays in index.html, dead
 * while the bundle is loaded, so the revert is one script tag.
 *
 * The Reference bar was NOT that case, which is why this file exists: the
 * clashing button lives in #opp-tab-actions, outside the block the swap hides,
 * so both were in the document at once and getElementById returned the wrong
 * one.
 */
const DISPOSED = {
  'frontend-react/src/ApprovalView.tsx':
    'INSIDE THE MOUNT CONTAINER. React owns #view-opportunity-approval whole '
    + 'and reproduces the static frame, because createRoot clears the container '
    + 'on first render and destroyed the original. Nothing survives to collide.',
  'frontend-react/src/account/AccountView.tsx':
    'INSIDE THE MOUNT CONTAINER, same as ApprovalView and by the same '
    + 'mechanism, measured rather than assumed: main.tsx register() does '
    + 'createRoot(document.getElementById(`view-${view}`)), so a whole-view '
    + 'migration owns its container and every static id in it is cleared on '
    + 'first render.',
  'frontend-react/src/deal/DealPanel.tsx':
    'LATENT, AND MEASURED AS SUCH. The deal panel mounts into a SUB-CONTAINER '
    + 'and the swap HIDES #deal-form-vanilla rather than clearing it, so both '
    + 'copies of #latch-all really are in the document at once - the same '
    + 'arrangement as the Reference bar. It is latent rather than live because '
    + 'NOTHING resolves these ids by getElementById: measured across frontend, '
    + 'frontend-react and scripts, the only readers are data-testid lookups '
    + 'inside the mounted host. Architecture 8 exactly - correct for every '
    + 'caller that exists. The day something reaches for document.getElementById '
    + '("latch-all") it gets the hidden vanilla one.',
  'frontend-react/src/contact/ContactPanel.tsx':
    'Same as ContactHost above, and confirmed by the same swap.',
  'frontend-react/src/contact/StageActions.tsx':
    'Same as ContactHost: rendered inside the container createRoot owns, and '
    + 'the ids are the vanilla\'s on purpose - a whole-view migration '
    + 'reproduces the frame.',
  'frontend-react/src/contact/ParkForm.tsx':
    'Same as ContactHost. The park form renders inside the view container, so '
    + 'its cd-park-* ids replace the static ones rather than joining them.',
  'frontend-react/src/deal/intake.tsx':
    "LATENT, and it belongs to the deal panel arrangement rather than to "
    + "this file: see the DealPanel entry. The swap HIDES the vanilla block "
    + "instead of clearing it, so both copies sit in the document, and "
    + "nothing resolves these ids by getElementById.",
  'frontend-react/src/deal/panelParts.tsx':
    "LATENT, and it belongs to the deal panel arrangement rather than to "
    + "this file: see the DealPanel entry. The swap HIDES the vanilla block "
    + "instead of clearing it, so both copies sit in the document, and "
    + "nothing resolves these ids by getElementById.",
  'frontend-react/src/deal/section36.tsx':
    "LATENT, and it belongs to the deal panel arrangement rather than to "
    + "this file: see the DealPanel entry. The swap HIDES the vanilla block "
    + "instead of clearing it, so both copies sit in the document, and "
    + "nothing resolves these ids by getElementById.",
  'frontend-react/src/deal/section4.tsx':
    "LATENT, and it belongs to the deal panel arrangement rather than to "
    + "this file: see the DealPanel entry. The swap HIDES the vanilla block "
    + "instead of clearing it, so both copies sit in the document, and "
    + "nothing resolves these ids by getElementById.",
  'frontend-react/src/deal/section5.tsx':
    "LATENT, and it belongs to the deal panel arrangement rather than to "
    + "this file: see the DealPanel entry. The swap HIDES the vanilla block "
    + "instead of clearing it, so both copies sit in the document, and "
    + "nothing resolves these ids by getElementById.",
  'frontend-react/src/versions/VersionCard.tsx':
    "LATENT, same arrangement: the version card mounts into its own "
    + "sub-container beside a hidden vanilla block, and nothing resolves "
    + "its ids by getElementById.",
}

/**
 * THE TEST THAT DECIDES WHICH LIST A FILE BELONGS IN, stated because the next
 * surface will ask it: does the clashing id live INSIDE the container this
 * component mounts into? Whole-view migrations registered through main.tsx
 * do - createRoot clears them. A panel mounted into a sub-container does NOT
 * own the ids around it, and the Reference bar is the instance.
 */

test('no React component declares an id the markup already carries', () => {
  const clashes = []
  for (const f of walk('frontend-react/src')) {
    if (f.includes('__tests__')) continue
    // COMMENTS STRIPPED. Verification 39: this file's own comments name
    // `ref-save-all` twice, and a raw scan would report the guard as the fault.
    const code = readCode(new URL(f, ROOT))
    if (f in DISPOSED) continue
    for (const m of code.matchAll(/\bid="([^"{]+)"/g)) {
      if (markupIds().has(m[1])) clashes.push(`${f}: ${m[1]}`)
    }
    for (const m of code.matchAll(/saveId="([^"]+)"/g)) {
      if (markupIds().has(m[1])) clashes.push(`${f}: saveId ${m[1]}`)
    }
  }
  assert.deepEqual(clashes, [],
    'a migrated component reuses an id index.html still carries, so '
    + 'getElementById will return whichever comes first in the document')
})

// AND THE LEDGER MAY NOT ROT. A disposed file that has stopped clashing is a
// stale exemption, and the next real clash in it would be waved through.
test('every disposed file still actually clashes, so no exemption is dead', () => {
  const ids = markupIds()
  for (const f of Object.keys(DISPOSED)) {
    const code = readCode(new URL(f, ROOT))
    // BOTH DECLARATION FORMS, or the guard reports a live exemption dead.
    // ContactPanel clashes only through `saveId`, which is how an id reaches
    // the shared edit bar, and scanning one shape asked the wrong question.
    const hits = [...code.matchAll(/\b(?:id|saveId)="([^"{]+)"/g)]
      .map((m) => m[1]).filter((i) => ids.has(i))
    assert.ok(hits.length > 0,
      `${f} is exempted and no longer shares any id with the markup: drop the entry`)
  }
})
