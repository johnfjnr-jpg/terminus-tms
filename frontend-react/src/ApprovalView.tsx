import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useShell } from './ShellContext'
import { approvalPageQuery } from './queries'

const VIEW = 'opportunity-approval'

export function ApprovalView({ oppId }: { oppId: string }) {
  const shell = useShell()
  const { data, isPending, isError, error } = useQuery(approvalPageQuery(shell, oppId))

  // ── detailLoaded FIRES ON EVERY EXIT PATH ──────────────────────────────
  //
  // Round 41 item K: the view stops hiding its body whatever happened. The
  // vanilla file used try/finally around several early returns; the React
  // equivalent is "the moment the query stops being pending", which covers
  // success and failure with one condition rather than two call sites that
  // could drift apart.
  useEffect(() => {
    if (!isPending) shell.detailLoaded(VIEW)
  }, [isPending, shell])

  if (isPending) return <p className="pg-item-note">Loading the approval page…</p>

  // isError RENDERED, NEVER SWALLOWED, and it carries the SERVER's sentence.
  // Phase 2 adds the five blocks; what must already be true is that a failure
  // says so and does not leave stale content behind it.
  if (isError) {
    return (
      <p className="msg-error" data-testid="approval-error">
        {error instanceof Error ? error.message : 'The approval page could not be loaded.'}
      </p>
    )
  }

  // PHASE 1 IS A PLACEHOLDER, DELIBERATELY. The five blocks are Phase 2, built
  // against the twelve-point list and the thirteen endpoint shapes. Rendering
  // an approximation of them here would be a second implementation to reconcile.
  return (
    <div data-testid="approval-view">
      <p className="pg-card-title">
        Approval{data?.record?.reference ? ` · ${data.record.reference}` : ''}
      </p>
      <p className="pg-item-note">
        The approval blocks arrive in Phase 2. This shell confirms the mount, the
        query and the error slot.
      </p>
    </div>
  )
}
