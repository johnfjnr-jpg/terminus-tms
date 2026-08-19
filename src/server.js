import Fastify from 'fastify'
import FastifyStatic from '@fastify/static'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { requireAuth } from './middleware/auth.js'
import recordsRoutes from './routes/records.js'
import transitionsRoutes from './routes/transitions.js'
import approvalsRoutes from './routes/approvals.js'
import leadsRoutes from './routes/leads.js'
import opportunitiesRoutes from './routes/opportunities.js'
import dealsRoutes from './routes/deals.js'
import testBedsRoutes from './routes/test-beds.js'
import stageDefinitionsRoutes from './routes/stage-definitions.js'
import industriesRoutes from './routes/industries.js'
import scoringRoutes from './routes/scoring.js'
import terminusStaffRoutes from './routes/terminus-staff.js'
import accountsRoutes from './routes/accounts.js'
import contactsRoutes from './routes/contacts.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } })

// Serve the frontend from /frontend at the site root.
// API routes registered below take priority over static files.
await fastify.register(FastifyStatic, {
  root: join(__dirname, '..', 'frontend'),
  prefix: '/'
})

// Serve src/lib at /lib so the browser can import the exact same
// deal-calculator.js the server uses for live client-side preview
// (src/routes/deals.js imports the same file from disk) — never a
// copy, so the two can't drift apart. decorateReply: false because
// @fastify/static was already decorated by the registration above.
await fastify.register(FastifyStatic, {
  root: join(__dirname, 'lib'),
  prefix: '/lib/',
  decorateReply: false
})

// ── Public routes (no auth) ───────────────────────────────────────────────────

fastify.get('/health', async () => ({ ok: true, timestamp: new Date().toISOString() }))

// Returns public Supabase config so the frontend can initialise its client
// without hardcoding values. Both fields are intentionally public:
//   supabaseUrl      — project hostname, not a secret
//   supabaseAnonKey  — the publishable key, powerless without a valid user JWT
fastify.get('/api/config', async () => ({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_PUBLISHABLE_KEY
}))

// ── Authenticated routes ──────────────────────────────────────────────────────
// The onRequest hook inside this scoped plugin applies only to routes registered
// within it. The public routes above are unaffected.

await fastify.register(async function authenticatedRoutes(app) {
  app.addHook('onRequest', requireAuth)
  app.register(recordsRoutes, { prefix: '/api' })
  app.register(transitionsRoutes, { prefix: '/api' })
  app.register(approvalsRoutes, { prefix: '/api' })
  app.register(leadsRoutes, { prefix: '/api' })
  app.register(opportunitiesRoutes, { prefix: '/api' })
  app.register(dealsRoutes, { prefix: '/api/deals' })
  app.register(testBedsRoutes, { prefix: '/api' })
  app.register(stageDefinitionsRoutes, { prefix: '/api' })
  app.register(industriesRoutes, { prefix: '/api' })
  app.register(scoringRoutes, { prefix: '/api' })
  app.register(terminusStaffRoutes, { prefix: '/api' })
  app.register(accountsRoutes, { prefix: '/api' })
  app.register(contactsRoutes, { prefix: '/api' })
})

const port = parseInt(process.env.PORT ?? '3000', 10)
try {
  await fastify.listen({ port, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
