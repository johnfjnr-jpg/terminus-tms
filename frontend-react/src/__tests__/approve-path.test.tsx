// ── H1 AND H2: THE APPROVAL PATH IS REACHABLE FROM THE SCREEN ────────────
//
// Phase 0 measured both defects and named one mechanism each:
//
//   H1  #btn-open-approval carried NO on* props at all. It was a bare button
//       with an id, and nothing in the repository bound a listener to it. Two
//       committed probes asserted its VISIBILITY, which is exactly what a dead
//       button has.
//   H2  #btn-issue-version was HIDDEN, not missing and not disabled, by one
//       clause keyed on `gateApplies`. At a stage with no version-scoped
//       approval track - Qualification, where a deal is first priced - there
//       was no way to raise a minor to a major at all.
//
// Written before either fix, red first.
import { describe, test, expect, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { VersionCard } from '../versions/VersionCard'
import type { AskReporter } from '../versions/VersionCard'
import { aVersion, resetVersionIds } from './version-fixtures'
import type { DealVersion, PendingApproval } from '../versions/model'

let host: HTMLElement
interface Props {
  versions?: DealVersion[]
  pending?: PendingApproval | null
  gateApplies?: boolean
  onSave?: (reason: string) => Promise<void> | void
  onIssue?: () => Promise<void> | void
  onRestore?: (id: string) => Promise<void> | void
  onAsk?: (id: string, label: string, reporter: AskReporter) => void
  onOpenApproval?: () => void
}
let currentRoot: Root
const render = (p: Props) => (
  <VersionCard
    versions={p.versions ?? []}
    pending={p.pending ?? null}
    gateApplies={p.gateApplies ?? true}
    onSave={p.onSave ?? (() => {})}
    onIssue={p.onIssue ?? (() => {})}
    onRestore={p.onRestore ?? (() => {})}
    onAsk={p.onAsk ?? (() => {})}
    onOpenApproval={p.onOpenApproval ?? (() => {})} />
)
const mount = async (p: Props = {}) => {
  resetVersionIds()
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  currentRoot = createRoot(host)
  await act(async () => { currentRoot.render(render(p)) })
}
const el = (id: string) => host.querySelector(`#${id}`) as HTMLButtonElement | null
const must = (id: string) => { const e = el(id); if (!e) throw new Error(`no #${id}`); return e }

describe('H1: the approval button leads somewhere', () => {
  test('H1a: it is named for the ACT, not for a destination', async () => {
    await mount()
    expect(must('btn-open-approval').textContent!.trim()).toBe('Approve pricing')
  })

  test('H1b: and the old name is gone from the card entirely', async () => {
    await mount()
    // The companion to H1a (Verification 14): asserting the new name is
    // present says nothing about whether the old one is still rendered
    // somewhere else on the same card.
    expect(host.textContent).not.toContain('Approval view')
  })

  test('H1c: clicking it calls the handler, which is what it never did', async () => {
    const onOpenApproval = vi.fn()
    await mount({ onOpenApproval })
    await act(async () => { must('btn-open-approval').click() })
    expect(onOpenApproval).toHaveBeenCalledTimes(1)
  })

  test('H1d: it carries the estate treatment for a secondary control', async () => {
    await mount()
    // A replaced control inherits the ROLE of the one it replaces, and a role
    // carries a treatment: this button was btn-secondary before the rename and
    // a bare <button> would render a white browser default on a dark screen.
    expect(must('btn-open-approval').className).toContain('btn-secondary')
  })
})

describe('H2: a minor can be raised to a major from the screen', () => {
  const draft = () => [aVersion({ major: 0, minor: 1, status: 'draft' })]

  test('H2a: the issue control is VISIBLE with a draft to issue, gate or no gate', async () => {
    // The defect exactly: at a stage with no version-scoped track the control
    // was hidden, so the only path to a major version was unreachable.
    await mount({ versions: draft(), gateApplies: false })
    expect(must('btn-issue-version').className).not.toContain('hidden')
  })

  test('H2b: and it is still visible when the gate DOES apply', async () => {
    await mount({ versions: draft(), gateApplies: true })
    expect(must('btn-issue-version').className).not.toContain('hidden')
  })

  test('H2c: clicking it issues', async () => {
    const onIssue = vi.fn()
    await mount({ versions: draft(), gateApplies: false, onIssue })
    await act(async () => { must('btn-issue-version').click() })
    expect(onIssue).toHaveBeenCalledTimes(1)
  })

  test('H2d: with nothing to issue it says so rather than vanishing', async () => {
    // The companion to H2a. A control that disappears when it cannot act is
    // the defect this round is about; one that stays and explains is not.
    await mount({ versions: [], gateApplies: false })
    const b = must('btn-issue-version')
    expect(b.className).not.toContain('hidden')
    expect(b.disabled).toBe(true)
    expect(b.title.length).toBeGreaterThan(0)
  })

  test('H2e: a refusal from the route reaches the screen rather than dying', async () => {
    // PHASE 0 FOUND THE THIRD DEFECT HERE. The host's onIssue fired the POST
    // and never read `r.ok`, so a 409 from the next-version rule or the
    // no-delta refusal was discarded and the list simply reloaded unchanged.
    // The route composes careful sentences that nobody could ever see.
    //
    // The contract is the one `onSave` already has: the handler THROWS and the
    // card renders the message, so there is one way a refusal reaches a person
    // rather than two.
    const onIssue = vi.fn().mockRejectedValue(
      new Error('V1.1 was drafted before V2 was issued, so it is not the next version.'))
    await mount({ versions: draft(), gateApplies: false, onIssue })
    await act(async () => { must('btn-issue-version').click() })
    const f = host.querySelector('#deal-version-feedback')!
    expect(f.className).not.toContain('hidden')
    expect(f.textContent).toContain('not the next version')
  })

  test('H2f: and a successful issue does not leave a refusal on screen', async () => {
    // The companion to H2e: a card that only ever ADDS messages would show the
    // last refusal for ever, which is the same silence wearing the other hat.
    const onIssue = vi.fn().mockResolvedValue(undefined)
    await mount({ versions: draft(), gateApplies: false, onIssue })
    await act(async () => { must('btn-issue-version').click() })
    const f = host.querySelector('#deal-version-feedback')!
    expect(f.textContent).not.toContain('not the next version')
  })
})
