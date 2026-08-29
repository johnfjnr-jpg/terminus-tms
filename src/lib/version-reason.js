/**
 * What the version reason box asks, and it depends on whether there is a
 * previous version.
 *
 * CLAUDE.md Verification 22: a required field with no reader becomes ceremony.
 * The reason now has a reader - the approval page renders it as prose beside the
 * bridge showing what moved - and that is half of what keeps it honest. The
 * other half is that a question with only one possible answer gets a rote one.
 *
 * "What changed, and why" against a deal that has never been priced invites
 * "initial pricing", and somebody who types that on V0.1 types "update" on
 * V0.10. So a first version asks what the price is BASED ON, which is a real
 * question an approver needs answered, and every later one asks what changed,
 * which is what block 2 is measuring.
 *
 * SHARED RATHER THAN INLINE so the prompt, the placeholder and the refusal
 * message cannot drift apart, and so the rule is testable without a browser.
 */

export const REASON_PROMPTS = {
  first: {
    label: 'What is this price based on?',
    placeholder: 'The quote, the assumptions, the constraints it was built to.',
    refusal: 'A reason is required: what is this price based on?',
  },
  subsequent: {
    label: 'What changed, and why?',
    placeholder: 'What moved since the last version, and what made it move.',
    refusal: 'A reason is required: what changed in this version, and why.',
  },
};

/**
 * @param {number} existingVersionCount
 * @returns {{ label: string, placeholder: string, refusal: string }}
 */
export function reasonPromptFor(existingVersionCount) {
  return (existingVersionCount ?? 0) === 0 ? REASON_PROMPTS.first : REASON_PROMPTS.subsequent;
}
