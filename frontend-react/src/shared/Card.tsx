// ── THE ESTATE'S CARD, IN ONE PLACE ──────────────────────────────────────
//
// `.pg-card` with a title. It was declared inside `testbed/TestBedPanel.tsx`
// and imported from there by `TestBedBand`, which was fine while the Test Bed
// was its only consumer. The Opportunity band is the second, and importing a
// card out of another surface's PANEL would drag that panel's dependencies
// across a module boundary for four lines of markup.
//
// ONE DEFINITION, IMPORTED, which is Verification 20's own remedy: the
// alternative is a second card component that agrees today and drifts later.
// `TestBedPanel` re-exports this name, so every existing caller is unchanged
// and nothing had to be re-pointed.
import type { ReactNode } from 'react'

export function Card({ title, testId, children }: {
  title: string
  testId: string
  children: ReactNode
}) {
  return (
    <div className="pg-card" data-testid={testId}>
      <div className="pg-card-title">{title}</div>
      {children}
    </div>
  )
}
