import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellProvider } from './ShellContext'
import { shellServices } from './shell-services'
import { ApprovalView } from './ApprovalView'
import { AccountView } from './account/AccountView'

// ── WHAT THIS BUNDLE DOES THIS ROUND, AND NOTHING ELSE ───────────────────
//
// It registers ONE global, `window.loadApprovalPage`, which the vanilla router
// already calls at app.js:186. The vanilla shell stays the shell and the
// router; React owns one container.
//
// The revert is restoring one script tag, and that stays true only while this
// file adds exactly one global and touches nothing else.

const APPROVAL_VIEW = 'opportunity-approval'
const ACCOUNT_VIEW = 'account-detail'

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

// ONE ROOT PER CONTAINER, REUSED. createRoot on a container that already has
// one warns and leaks, and the router calls these on every navigation.
const roots = new Map<string, Root>()

declare global {
  interface Window {
    loadApprovalPage?: (oppId: string) => void
    loadAccountDetail?: (accountId: string) => void
  }
}

// The registration shape both surfaces share. `detailLoaded` fires on the two
// paths the component itself can never reach - no container, and a mount that
// throws - which is Round 41 item K at the layer above the view.
function register(view: string, render: (id: string) => React.ReactElement) {
  return function (id: string): void {
    try {
      const container = document.getElementById(`view-${view}`)
      if (!container) { shellServices.detailLoaded(view); return }
      let root = roots.get(view)
      if (!root) { root = createRoot(container); roots.set(view, root) }
      root.render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <ShellProvider services={shellServices}>{render(id)}</ShellProvider>
          </QueryClientProvider>
        </StrictMode>,
      )
    } catch (err) {
      shellServices.detailLoaded(view)
      throw err
    }
  }
}

window.loadApprovalPage = register(APPROVAL_VIEW, (id) => <ApprovalView oppId={id} />)
window.loadAccountDetail = register(ACCOUNT_VIEW, (id) => <AccountView accountId={id} />)
