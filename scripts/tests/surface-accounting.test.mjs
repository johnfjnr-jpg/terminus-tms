// ── THE CENSUS-COMPLETENESS DETECTOR ────────────────────────────────────
//
// Round 6 Phase 2b, from the Phase 2 scope discovery. It is a STANDING PHASE 0
// ITEM: run it against a surface before planning its migration.
//
// ── WHAT WENT WRONG WITHOUT IT ──────────────────────────────────────────
//
// Phase 0 censused the Contact surface's FIELDS - twice, with two instruments,
// reconciled - and the fifth-contact checklist and an 18-injection sweep all
// passed. The swap then removed five working capabilities from the screen,
// because none of them is a field: the notes history, the park form, unqualify,
// delete and the account-details modal, 524 of 1,327 lines.
//
// They were not four measures with a shared gap. They were ONE QUESTION - are
// the rows right? - asked four ways. Verification 33.
//
// ── WHAT THIS ASKS INSTEAD ──────────────────────────────────────────────
//
// Not "are the fields covered" but "is every top-level name in this file
// accounted for by some named capability". A name nobody has claimed is a
// capability nobody has enumerated, which is exactly what a field census
// cannot see.
//
// AND IT COUNTS `window.X = function` DECLARATIONS, which Phase 0's own
// keyword-anchored inventory did not: it matched function/var/const/let at line
// start and reported 61 names where there are 76. Verification 50's clause - a
// declaration form can hide a member from every scan - and it hid fifteen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ROOT = new URL('../../', import.meta.url)

/** Every top-level name, by every declaration form the file uses. */
export function topLevelNames(source) {
  const out = []
  for (const [i, line] of source.split('\n').entries()) {
    let m = line.match(/^(?:async\s+)?function\s+([A-Za-z0-9_$]+)/)
    if (m) { out.push({ name: m[1], form: 'function', line: i + 1 }); continue }
    m = line.match(/^window\.([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?function/)
    if (m) { out.push({ name: m[1], form: 'window', line: i + 1 }); continue }
    m = line.match(/^(const|let|var)\s+([A-Za-z0-9_$]+)/)
    if (m) out.push({ name: m[2], form: m[1], line: i + 1 })
  }
  return out
}

// ── THE CONTACT SURFACE'S CAPABILITIES ──────────────────────────────────
//
// `migrated` is a claim this file does not check - it is the round's own
// bookkeeping, and the report is where it is evidenced.
const CAPABILITIES = {
  'view-lifecycle': {
    migrated: true,
    names: ['cdContactId', 'cdContact', 'cdPayload', 'cdLoadedRevision', 'cdReturnView',
      'loadContactDetail', 'loadContactDetailInner', 'renderContactDetail',
      'wireCdFieldInputs', 'wireCdOnce'],
  },
  'field-rows': {
    migrated: true,
    names: ['cdEdits', 'cdWired', 'CD_COLUMN_FIELDS', 'CD_NAME_FIELD', 'CD_CONTACT_FIELDS',
      'CD_SOURCE_FIELD', 'CD_ADDRESS_FIELDS', 'CD_SUMMARY_FIELD', 'CD_ALL_FIELDS',
      'cdFieldLabel', 'cdChangeSentence', 'cdAccountName', 'cdIndustryName',
      'cdColumnFieldRow', 'cdFieldRow', 'setVal', 'cdCurrentValue', 'openCdField',
      'discardCdField', 'onCdFieldInput', 'updateCdEditBar', 'cdHasDirtyEdits',
      'saveCdFields'],
  },
  'stage-actions': {
    // WAS PARTIAL, and the accounting is what surfaced it: renderCdActions
    // draws Qualify, Park AND Move to Unqualified where the React panel had
    // only Qualify. StageActions carries all three now, plus create and delete.
    migrated: true,
    names: ['renderCdActions'],
  },
  qualify: {
    migrated: true,
    names: ['cdCurrentBlocking', 'cdBlockingFieldValue', 'refreshCdBlockedFields',
      'renderCdBlockedFields', 'attemptContactQualifyFromDetail'],
  },
  'account-link': {
    migrated: true,
    names: ['renderCdAccountCard', 'openCdLinkAccountPanel', 'findAccountMatches',
      'renderCdLinkResults', 'cdLinkInFlight', 'linkCdAccount', 'performLinkCdAccount'],
  },
  'notes-history': {
    migrated: true,
    names: ['renderCdNotes', 'cdNoteOpen', 'onCdAddNoteClick', 'performCdAddNote',
      'discardCdNote', 'resetCdNoteInput'],
  },
  park: {
    migrated: true,
    names: ['cdParkKeydownHandler', 'cdParkDirty', 'clearCdParkUnsavedWarning',
      'openCdParkForm', 'requestCloseCdParkForm', 'closeCdParkForm', 'saveCdParkForm',
      'performSaveCdParkForm'],
  },
  unqualify: {
    migrated: true,
    names: ['attemptContactUnqualifyFromDetail', 'performContactUnqualify'],
  },
  'delete-and-create': {
    migrated: true,
    names: ['renderCdCreateDelete', 'deleteContactFromDetail'],
  },
  'account-details-modal': {
    migrated: true,
    names: ['accountDetailsKeydownHandler', 'accountDetailsParentId', 'accountDetailsOpenerId',
      'setAccountDetailsMode', 'openAccountDetailsModal', 'closeAccountDetailsModal',
      'showAccountDetailsView', 'openAccountDetailsViewModal',
      'renderAccountDetailsParentResults', 'selectAccountDetailsParent', 'saveAccountDetails'],
  },
  layout: {
    // NOT MIGRATED, and it is the second thing the accounting found beyond the
    // five the screenshot showed. syncCdBelowGridWidth keeps the below-grid
    // block aligned to the card grid, which is invisible in a flat column and
    // becomes visible the moment the cards exist.
    migrated: false,
    names: ['syncCdBelowGridWidth'],
  },
}

const SOURCE = () => readFileSync(new URL('frontend/contact-detail.js', ROOT), 'utf8')

test('the scan sees every declaration FORM, including window assignment', () => {
  // CALIBRATED on the form Phase 0 missed. Without this the instrument
  // undercounts by fifteen and reports a complete accounting of two thirds of
  // the file.
  const found = topLevelNames(SOURCE())
  const forms = new Set(found.map((f) => f.form))
  assert.ok(forms.has('window'),
    'no window.X = function declaration was seen, which is the form that hid '
    + 'fifteen names from the Phase 0 inventory')
  assert.ok(forms.has('function') && forms.has('let') && forms.has('const'),
    `expected every keyword form, saw ${[...forms].join(', ')}`)
  assert.ok(found.length >= 70, `only ${found.length} top-level names parsed`)
})

test('EVERY top-level name is claimed by an enumerated capability', () => {
  const claimed = new Map()
  for (const [cap, { names }] of Object.entries(CAPABILITIES)) {
    for (const n of names) {
      assert.ok(!claimed.has(n), `${n} is claimed by both ${claimed.get(n)} and ${cap}`)
      claimed.set(n, cap)
    }
  }
  const unclaimed = topLevelNames(SOURCE()).map((f) => f.name).filter((n) => !claimed.has(n))
  assert.deepEqual(unclaimed, [],
    'these top-level names belong to no enumerated capability, which means a '
    + 'capability nobody has written down: ' + unclaimed.join(', '))
})

test('and every enumerated name still exists, so the map cannot rot', () => {
  // The other direction. A capability listing a name the file no longer has is
  // an accounting of something that is not there, and it would mask a real gap
  // by making the totals look right.
  const present = new Set(topLevelNames(SOURCE()).map((f) => f.name))
  const missing = []
  for (const [cap, { names }] of Object.entries(CAPABILITIES)) {
    for (const n of names) if (!present.has(n)) missing.push(`${cap}: ${n}`)
  }
  assert.deepEqual(missing, [], 'enumerated names that no longer exist: ' + missing.join(', '))
})

test('every capability declares whether it is migrated', () => {
  for (const [cap, v] of Object.entries(CAPABILITIES)) {
    assert.equal(typeof v.migrated, 'boolean', `${cap} does not say whether it is migrated`)
  }
})
