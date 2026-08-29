// The version reason asks a different question on a first version. Round 38.
// Runs under `npm test` - pure, no DOM.
//
// CLAUDE.md Verification 22. The reason was required at three layers and read in
// one place: a caption. A field that must be filled and is never read teaches
// the person filling it that the content does not matter, and the content is
// what the requirement was for.
//
// Both halves are tested: the reason now HAS a reader (the approval page renders
// it as prose beside the bridge, covered in approval-page.test.mjs), and the
// question changes with the situation, which is this file.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reasonPromptFor, REASON_PROMPTS } from '../../src/lib/version-reason.js'

test('a FIRST version asks what the price is based on', () => {
  const p = reasonPromptFor(0)
  assert.equal(p, REASON_PROMPTS.first)
  assert.match(p.label, /based on/)
  assert.match(p.refusal, /based on/)
})

test('a SUBSEQUENT version asks what changed', () => {
  // The discriminating half. One prompt for both situations is the thing that
  // produced "initial pricing" on V0.1 and "update" on V0.10.
  for (const n of [1, 2, 10]) {
    const p = reasonPromptFor(n)
    assert.equal(p, REASON_PROMPTS.subsequent, `${n} existing versions`)
    assert.match(p.label, /changed/)
  }
})

test('the two prompts are genuinely different in all three parts', () => {
  // Label, placeholder and refusal live together so they cannot drift apart. If
  // any pair matched, the field would ask one question wearing two names.
  for (const part of ['label', 'placeholder', 'refusal']) {
    assert.notEqual(REASON_PROMPTS.first[part], REASON_PROMPTS.subsequent[part], part)
  }
})

test('a missing count is treated as a first version, not as a later one', () => {
  // Failing closed: asking "what changed" when nothing is known about the
  // history is the question that cannot be answered honestly.
  assert.equal(reasonPromptFor(undefined), REASON_PROMPTS.first)
  assert.equal(reasonPromptFor(null), REASON_PROMPTS.first)
})

test('neither refusal is the server fallback', () => {
  // The route answers a neutral sentence because it is the fallback for a caller
  // that is not the screen, and it must not assert "what changed" at somebody
  // pricing a deal for the first time.
  const SERVER = 'A reason is required for every version.'
  assert.notEqual(REASON_PROMPTS.first.refusal, SERVER)
  assert.notEqual(REASON_PROMPTS.subsequent.refusal, SERVER)
})
