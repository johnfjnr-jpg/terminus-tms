// ── THE SCORE CONTROL, EXPRESSED ONCE ────────────────────────────────────
//
// V9 replaced the criterion row's <select> with five buttons (R1). Four test
// files read that control 40-odd times, each in the select's own idiom -
// `.value`, `change` events, `option` lists - and every one of them had to move.
//
// They move to HERE rather than each being rewritten in the button's idiom,
// because the next change to this control would otherwise have to find all of
// them again. One definition, imported (Verification 20).
//
// The helpers speak in the language of the CLAIM - what is the score, set the
// score - rather than in the language of whichever widget is currently used to
// express it, which is what makes them survive the next replacement too.
export const scoreGroup = (host: ParentNode, key: string): HTMLElement | null =>
  host.querySelector(`[data-testid="tb-score-levels-${key}"]`)

/** The level button for one value. */
export const scoreButton = (host: ParentNode, key: string, value: string | number): HTMLButtonElement | null =>
  host.querySelector(`[data-testid="tb-score-btn-${key}-${value}"]`)

/**
 * What the control currently SAYS the score is: the drafted value if one is
 * drafted, else the recorded one, else ''.
 *
 * This is the reading the old `select.value` gave, which is why every call site
 * that asked for `.value` can ask for this instead.
 */
export const scoreValue = (host: ParentNode, key: string): string => {
  const g = scoreGroup(host, key)
  if (!g) return ''
  const on = g.querySelector('[aria-checked="true"]')
  return on?.getAttribute('data-level') ?? ''
}

/** Every criterion the card is currently offering a control for. */
export const scoredKeys = (host: ParentNode): string[] =>
  [...host.querySelectorAll('[data-testid^="tb-score-levels-"]')]
    .map((e) => e.getAttribute('data-testid')!.replace('tb-score-levels-', ''))

/** Whether the control is refusing input, which the select expressed as `disabled`. */
export const scoreDisabled = (host: ParentNode, key: string): boolean => {
  const g = scoreGroup(host, key)
  if (!g) return false
  const btns = [...g.querySelectorAll('button')] as HTMLButtonElement[]
  return btns.length > 0 && btns.every((b) => b.disabled)
}
