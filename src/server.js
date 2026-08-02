import Fastify from 'fastify'
import FastifyStatic from '@fastify/static'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { requireAuth } from './middleware/auth.js'
import recordsRoutes from './routes/records.js'
import transitionsRoutes from './routes/transitions.js'
import approvalsRoutes from './routes/approvals.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } })

// Serve the frontend from /frontend at the site root.
// API routes registered below take priority over static files.
await fastify.register(FastifyStatic, {
  root: join(__dirname, '..', 'frontend'),
  prefix: '/'
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
})

const port = parseInt(process.env.PORT ?? '3000', 10)
try {
  await fastify.listen({ port, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
