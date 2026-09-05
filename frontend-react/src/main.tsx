import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellProvider } from './ShellContext'
import { shellServices } from './shell-services'
import { ApprovalView } from './ApprovalView'

// ── WHAT THIS BUNDLE DOES THIS ROUND, AND NOTHING ELSE ───────────────────
//
// It registers ONE global, `window.loadApprovalPage`, which the vanilla router
// already calls at app.js:186. The vanilla shell stays the shell and the
// router; React owns one container.
//
// The revert is restoring one script tag, and that stays true only while this
// file adds exactly one global and touches nothing else.

const VIEW = 'opportunity-approval'
const CONTAINER_ID = `view-${VIEW}`

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Invalidation is the only refresh mechanism this round, so nothing
      // refetches on a window focus underneath somebody mid-decision.
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
})

let root: Root | null = null

declare global {
  interface Window {
    loadApprovalPage?: (oppId: string) => void
  }
}

window.loadApprovalPage = function (oppId: string): void {
  // ── detailLoaded ON EVERY EXIT PATH, INCLUDING THIS ONE ────────────────
  //
  // The component fires it when the query settles. That covers the ordinary
  // paths and not this one: if the container is missing or mounting throws,
  // the component never renders and nothing would ever un-hide the view - the
  // exact failure Round 41 item K was about, reintroduced at a new layer.
  try {
    const container = document.getElementById(CONTAINER_ID)
    if (!container) {
      shellServices.detailLoaded(VIEW)
      return
    }
    // ONE ROOT, REUSED. createRoot on a container that already has one warns
    // and leaks; the router calls this on every navigation to the view.
    if (!root) root = createRoot(container)
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <ShellProvider services={shellServices}>
            <ApprovalView oppId={oppId} />
          </ShellProvider>
        </QueryClientProvider>
      </StrictMode>,
    )
  } catch (err) {
    shellServices.detailLoaded(VIEW)
    throw err
  }
}
