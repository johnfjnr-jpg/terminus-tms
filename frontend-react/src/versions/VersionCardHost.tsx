import { useCallback, useEffect, useRef, useState } from 'react'
import { VersionCard } from './VersionCard'
import type { AskReporter } from './VersionCard'
import type { DealVersion, PendingApproval } from './model'
import { versionLabel } from './model'
import { scheduleReconciliation, refusalStatement } from '../../../src/lib/milestone-schedule.js'
import { resolveRates, frozenRates } from '../../../src/lib/rate-resolution.js'

// ── THE VERSION CARD'S DATA AND ACTIONS ──────────────────────────────────
//
// Round 4 Phase 2. The card renders; this fetches, writes, and talks to the
// seam. The split is deliberate: every behaviour Phase 0 enumerated is testable
// against the card with no network, and the writes are testable here.
//
// THE SEAM IS THE INTERFACE, EVEN REACT TO REACT. This host consumes whatever
// seam it is handed and never reaches around it into the form, because the
// form's one-line revert hands this card a VANILLA adapter and the card must
// work against both. That is the round's governing constraint.

export interface VersionSeam {
  freezeCurrentState(): Promise<{
    payload: Record<string, unknown>
    contractorMilestones: unknown[]
    catalogRates: Record<string, unknown>
  }>
  hasUnsavedChanges(): boolean
  readContractorMilestones(): unknown[]
  populateForm(payload: Record<string, unknown>): void
  recompute(): unknown
}

interface Api {
  (method: string, path: string, body?: unknown):
  Promise<{ ok: boolean, status?: number, data?: unknown }>
}

declare global {
  interface Window {
    getOppLoadedRevision?: () => number | null
    openDiscardConfirm?: (onDiscard: () => void) => void
    oppPendingPricingApproval?: () => PendingApproval | null
    oppVersionGateApplies?: () => boolean
    requestPricingApproval?: (id: string, label: string, reporter?: AskReporter) => void
    oppCurrentVersionRejection?: () => unknown
    oppRefreshVersionActions?: () => void
  }
}

export function VersionCardHost({ opportunityId, seam, api }: {
  opportunityId: string
  seam: VersionSeam
  api: Api
}) {
  const [versions, setVersions] = useState<DealVersion[]>([])
  // A render tick, so the two outward feeds can force a re-read the way the
  // vanilla's `renderVersionList()` did.
  const [, bump] = useState(0)
  const latest = useRef<DealVersion[]>([])
  latest.current = versions

  const load = useCallback(async () => {
    const r = await api('GET', `/api/opportunities/${opportunityId}/deal-sheet-versions`)
    setVersions(r.ok && Array.isArray(r.data) ? r.data as DealVersion[] : [])
  }, [api, opportunityId])

  useEffect(() => { void load() }, [load])

  // ── THE TWO OUTWARD FEEDS, with the vanilla's semantics exactly ────────
  //
  // app.js calls both at moments IT chooses and never caches the answer, and it
  // says why at each site: the versions load after the rejection banner first
  // runs, and this card renders before stage-approvals resolve.
  useEffect(() => {
    window.oppCurrentVersionRejection = () => {
      const issued = (latest.current ?? []).filter((v) => v.status === 'issued')
      if (!issued.length) return null
      const current = issued[0]
      if (current?.approval?.state !== 'rejected') return null
      return {
        label: versionLabel(current),
        decidedAt: current.approval.decidedAt ?? null,
        revision: current.approval.revisionApproved ?? null,
      }
    }
    window.oppRefreshVersionActions = () => bump((n) => n + 1)
    return () => {
      delete window.oppCurrentVersionRejection
      delete window.oppRefreshVersionActions
    }
  }, [])

  const onSave = async (reason: string) => {
    // THE REFUSALS RUN BEFORE THE FREEZE, so a refused version writes nothing.
    // That is why the base comes from recompute() and not from the freeze: the
    // freeze SAVES, and refusing must not.
    const rec = scheduleReconciliation(
      seam.readContractorMilestones() as { usd?: number }[],
      Number((seam.recompute() as { lumpSumCost?: number })?.lumpSumCost ?? 0),
    ) as { hasSchedule: boolean, issuable: boolean, reconciles: boolean, incompleteStatement: string }
    if (rec.hasSchedule && !rec.issuable) throw new Error(rec.incompleteStatement)
    if (rec.hasSchedule && !rec.reconciles) {
      throw new Error(refusalStatement(rec, 'The contractor payment schedule') as string)
    }

    const alsoSaved = seam.hasUnsavedChanges()
    let frozen
    try {
      frozen = await seam.freezeCurrentState()
    } catch {
      throw new Error('The pricing could not be saved, so no version was taken.')
    }
    const pricedWith = frozenRates(resolveRates(frozen.payload, frozen.catalogRates))
    const r = await api('POST', `/api/opportunities/${opportunityId}/deal-sheet-versions`, {
      inputs: frozen.payload, reason, rates: pricedWith,
      expected_revision: window.getOppLoadedRevision?.() ?? null,
    })
    if (!r.ok) {
      const detail = (r.data as { error?: string } | undefined)?.error ?? 'The version could not be saved.'
      throw new Error(alsoSaved
        ? `Your pricing was saved, but the version was not taken: ${detail} Try taking the version again.`
        : detail)
    }
    await load()
  }

  const onIssue = async () => {
    const issued = latest.current.find((v) => v.status === 'issued')
    const highest = issued?.major ?? 0
    const draft = latest.current.find((v) => v.status === 'draft' && v.major === highest)
    if (!draft) return
    await api('POST', `/api/deal-sheet-versions/${draft.id}/issue`)
    await load()
  }

  const onRestore = async (versionId: string) => {
    const go = async () => {
      const r = await api('POST', `/api/deal-sheet-versions/${versionId}/restore`)
      if (!r.ok) return
      const data = r.data as { inputs?: Record<string, unknown> }
      seam.populateForm(data.inputs ?? {})
      seam.recompute()
    }
    // RESTORE REFUSES-OR-DISCARDS rather than forcing a save first, and it asks
    // through the same discard dialogue the rest of the application uses.
    if (seam.hasUnsavedChanges()) { window.openDiscardConfirm?.(() => { void go() }); return }
    await go()
  }

  return (
    <VersionCard
      versions={versions}
      pending={window.oppPendingPricingApproval?.() ?? null}
      gateApplies={window.oppVersionGateApplies?.() !== false}
      onSave={onSave}
      onIssue={onIssue}
      onRestore={onRestore}
      onAsk={(id, label, reporter) => window.requestPricingApproval?.(id, label, reporter)} />
  )
}
