import { createRemoteJWKSet, jwtVerify } from 'jose'

// Module-level singletons: env vars are loaded before any module code runs
// when the server is started with `node --env-file=.env src/server.js`.
// jose caches the JWKS response and handles key rotation automatically.
const jwks = createRemoteJWKSet(new URL(process.env.SUPABASE_JWKS_URL))
const issuer = new URL(process.env.SUPABASE_URL).origin + '/auth/v1'

export async function requireAuth(request, reply) {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'unauthorized' })
  }

  const token = authHeader.slice(7)
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer })
    request.user = { id: payload.sub, email: payload.email }
    request.jwt = token
  } catch {
    return reply.code(401).send({ error: 'unauthorized' })
  }
}
