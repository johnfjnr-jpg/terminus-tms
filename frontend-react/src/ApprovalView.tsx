import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useShell } from './ShellContext'
import { approvalPageQuery } from './queries'
import type { ApprovalPage } from './approval-types'
import {
  AskBlock, MovedBlock, ExposuresBlock, CostBasisBlock, NotRecordedBlock,
} from './ApprovalBlocks'

const VIEW = 'opportunity-approval'

// ── THE FRAME IS RENDERED HERE, NOT LEFT TO index.html ───────────────────
//
// MEASURED IN PHASE 1 AND ONLY UNDERSTOOD IN PHASE 2: createRoot CLEARS its
// container on first render, so the static markup inside
// #view-opportunity-approval - the back button, the eyebrow, the title, the
// five card headings - is destroyed the moment React mounts. Phase 1's probe
// read the container's innerText as the placeholder ALONE and nobody noticed
// what was missing, because a placeholder is expected to look bare.
//
// So React owns the whole view and reproduces the frame exactly: same classes,
// same ids, same headings, same order. The markup STAYS in index.html
// untouched, dead while the bundle is loaded, because that is what makes the
// Phase 5 revert one script tag rather than two changes. Same arrangement as
// frontend/opportunity-approval.js staying in tree unloaded, and it is a
// deliberate second copy with a named reason.
function Frame({ oppId, children, title, subtitle, stateTag }: {
  oppId: string
  children?: React.ReactNode
  title?: string
  subtitle?: string
  stateTag?: string | null
}) {
  const shell = useShell()
  return (
    <>
      <div className="detail-head">
        <div>
          <button className="btn-text" id="btn-back-from-approval" type="button"
            onClick={() => shell.navigate('opportunity-detail', oppId)}>
            Back to the Opportunity
          </button>
          <p className="eyebrow" style={{ marginTop: 16 }}>Commercial approval</p>
          <h1 id="appr-title">{title ?? ''}</h1>
          <p className="sub" id="appr-subtitle">{subtitle ?? ''}</p>
        </div>
        <div id="appr-state-tag">{stateTag ? <span className="tag">{stateTag}</span> : null}</div>
      </div>
      {children}
    </>
  )
}

function Card({ id, eyebrow, children }: { id: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="card" id={id}>
      <p className="eyebrow">{eyebrow}</p>
      <div>{children}</div>
    </div>
  )
}

export function ApprovalView({ oppId }: { oppId: string }) {
  const shell = useShell()
  const { data, isPending, isError, error } = useQuery(approvalPageQuery(shell, oppId))

  // ── detailLoaded FIRES ON EVERY EXIT PATH ──────────────────────────────
  //
  // Round 41 item K: the view stops hiding its body whatever happened. The
  // vanilla file used try/finally around several early returns; the React
  // equivalent is "the moment the query stops being pending", which covers
  // success and failure with one condition rather than two call sites that
  // could drift apart. main.tsx covers the two paths that never reach here at
  // all: no container, and a mount that throws.
  useEffect(() => {
    if (!isPending) shell.detailLoaded(VIEW)
  }, [isPending, shell])

  if (isPending) {
    return <Frame oppId={oppId}><p className="pg-item-note">Loading the approval page…</p></Frame>
  }

  // isError RENDERED, NEVER SWALLOWED, and it carries the SERVER's sentence.
  //
  // A DEMONSTRABLE DEPARTURE FROM THE VANILLA, and it is required by brief
  // point 5 rather than chosen: the vanilla set the error line and RETURNED,
  // leaving whatever the five blocks last rendered on screen. On a second
  // failed load that is a live error sentence above another deal's figures.
  // Here the blocks do not render at all, and the frame does, so the approver
  // still has the way back.
  if (isError) {
    return (
      <Frame oppId={oppId}>
        <p id="appr-error" className="msg-error" data-testid="approval-error">
          {error instanceof Error ? error.message : 'The approval page could not be loaded.'}
        </p>
      </Frame>
    )
  }

  const page = data as unknown as ApprovalPage
  const rec = page.ask.record

  // ── THE STALENESS SENTENCE ─────────────────────────────────────────────
  //
  // meta.revisionNumber is the revision this page was BUILT at, read by the
  // route at request time. getOppLoadedRevision is the shell's own held value
  // and comes through the seam rather than off window, which is the only
  // difference from the vanilla. Round 41 walk item F: a number with no claim
  // about currency is one somebody assumes is current.
  const known = shell.getOppLoadedRevision()
  const moved = Number.isInteger(known) && (known as number) > page.meta.revisionNumber

  const subtitle =
    `${rec.reference ?? 'no reference'} · ${rec.stage ?? ''} · `
    + `priced at revision ${page.meta.revisionNumber}`
    + (moved ? ` · the record has since moved to revision ${known}, so reload before deciding` : '')

  return (
    <Frame
      oppId={oppId}
      title={rec.name ?? rec.reference ?? 'Opportunity'}
      subtitle={subtitle}
      stateTag={page.ask.version?.approval?.state ?? null}
    >
      <div data-testid="approval-view">
        <Card id="appr-block-ask" eyebrow="1. The ask">
          <AskBlock ask={page.ask} />
        </Card>
        <Card id="appr-block-moved" eyebrow="2. What moved it">
          <MovedBlock moved={page.moved} target={page.target} />
        </Card>
        <Card id="appr-block-exposures" eyebrow="3. Risk terms, as exposures">
          <ExposuresBlock exposures={page.exposures} />
        </Card>
        <Card id="appr-block-costbasis" eyebrow="4. Cost basis, and its age">
          <CostBasisBlock costBasis={page.costBasis} />
        </Card>
        <Card id="appr-block-notrecorded" eyebrow="5. What is not recorded">
          <NotRecordedBlock rows={page.notRecorded} />
        </Card>
      </div>
    </Frame>
  )
}
