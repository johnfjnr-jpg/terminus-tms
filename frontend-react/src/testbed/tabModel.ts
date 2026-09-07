// ── T: THE TAB STRIP ────────────────────────────────────────────────────
//
// Round 7 Phase 2b, from the T enumeration.

/**
 * T1: TEN TABS, and only eight of them are stages.
 *
 * The stage names are DATA in the vanilla's static markup and are declared here
 * once. They are not derived from the fetched stage list, deliberately: the
 * strip must be clickable before that fetch lands, which is the whole reason
 * T4's race exists.
 */
export const STAGE_NAMES = [
  'Qualification',
  'Pre-Site Assessment',
  'Site Assessment',
  'Installation and Commissioning',
  'Monitoring and Analysis',
  'Review and Completion',
  'Decommissioning',
  'Closed',
] as const

const STAGE_PREFIX = 'stage-'

/** `Pre-Site Assessment` carries a hyphen, so the key is a PREFIX, not a split. */
export const tabKey = (stage: string) => STAGE_PREFIX + stage
export const isStageTab = (key: string) => key.startsWith(STAGE_PREFIX)
export const stageOf = (key: string) =>
  isStageTab(key) ? key.slice(STAGE_PREFIX.length) : null

export interface TabDef { key: string, label: string }

export const TB_TABS: TabDef[] = [
  { key: 'reference', label: 'Reference' },
  { key: 'commercials', label: 'Commercials' },
  ...STAGE_NAMES.map((s) => ({ key: tabKey(s), label: s })),
]

export const STAGE_TABS = TB_TABS.filter((t) => isStageTab(t.key))

/**
 * T2: THE EIGHT STAGE TABS SHARE ONE PHYSICAL PANEL.
 *
 * Which is why every stage switch is a LOAD rather than a reveal, and why the
 * P1 token guard is required rather than defensive.
 */
export const paneFor = (key: string) =>
  isStageTab(key) ? 'tb-tab-stage-detail' : `tb-tab-${key}`

/**
 * T5: the landing tab, in precedence order, and it is FOUR branches.
 *
 * T4 is the second one: `userPicked` exists because the strip is clickable
 * before the record's own default runs, and a real click in that window was
 * silently overwritten. Confirmed live in Round 5 Phase 7.
 */
export function landingTab({ landing, fresh, userPicked, openTab }: {
  landing: string | null
  fresh: boolean
  userPicked: boolean
  openTab: string | null
}): string {
  if (landing) return tabKey(landing)
  if (fresh && !userPicked) return 'reference'
  // A RELOAD re-applies the open tab, which preserves it AND refreshes it.
  // Leaving the switch out keeps the tab and shows stale content.
  if (openTab) return openTab
  return 'reference'
}

/**
 * T6: the feedback clears on a tab CHANGE, not on a re-apply.
 *
 * Every reload activates a tab, including the branch that re-selects the one
 * already open, so clearing on any activation would erase the message a failed
 * score save writes before reloading - the one case where a failure must
 * survive a reload, because the reload is part of reporting it.
 */
export const shouldClearFeedback = (last: string | null, next: string) =>
  last !== null && last !== next

/**
 * T7: Next Stage is gated on the OPEN TAB, and the tab changes with no
 * re-render, so this is called from the activate hook.
 *
 * With no next stage the LABEL changes rather than a hint appearing. Round 8
 * Phase 4 removed the hint and recorded that the distinction survives in the
 * label, which is why the label is part of this return rather than the caller's.
 */
export function nextStageState(
  state: { currentStage: string, nextStage: string | null } | null,
  activeTab: string | null,
): { disabled: boolean, label: string } {
  if (!state) return { disabled: true, label: 'Next Stage' }
  if (!state.nextStage) return { disabled: true, label: 'Final stage' }
  return {
    disabled: activeTab !== tabKey(state.currentStage),
    label: 'Next Stage',
  }
}
