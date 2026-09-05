// ── IS THE ENVIRONMENT REACHABLE? DNS AND TCP AS SEPARATE STEPS ──────────
//
// Round 2 Phase 0 item 4. On 2026-09-05 a gate reported the database suite
// failing 91 of 92 over 821 SECONDS, and every HTTP stage failing. It read as
// findings. It was a stuck DNS entry on a VPN resolver.
//
// WHY DNS AND TCP ARE SEPARATE NAMED STEPS, and this is the whole design: they
// fail differently and the DIFFERENCE is the diagnosis.
//
//   DNS fails, TCP untestable  -> a resolver problem. The service is fine.
//                                 Flush the cache or check the VPN.
//   DNS works, TCP refused     -> the host is up and the port is shut.
//   DNS works, TCP times out   -> a firewall or a black hole in between.
//   both work, query fails     -> a real service or credential problem, which
//                                 is the only case that is about this system.
//
// Diagnosed as one step, all four look identical: "cannot reach the database".
//
// AND THE VPN IS RECORDED WHETHER OR NOT IT IS THE CAUSE. A VPN resolver with
// a stuck entry is indistinguishable from the service being down until
// measured, so the note belongs in the output every time rather than being
// remembered by whoever is debugging at the time.
import dns from 'node:dns/promises'
import net from 'node:net'
import { spawnSync } from 'node:child_process'

const URL_STR = process.env.SUPABASE_URL
if (!URL_STR) {
  console.error('FAIL  SUPABASE_URL is not set. Run with --env-file=.env')
  process.exit(1)
}
const parsed = new URL(URL_STR)
const host = parsed.hostname
// THE PORT COMES FROM THE URL. It was hardcoded to 443, which is right for
// every Supabase URL and made the TCP branch impossible to calibrate: a
// deliberately closed port in the URL was silently replaced by an open one, so
// the check passed on a case built to fail it. Found by the calibration, which
// is what a calibration is for.
const port = Number(parsed.port) || (parsed.protocol === 'http:' ? 80 : 443)
const fail = (step, detail, remedy) => {
  console.error('')
  console.error(`  ENVIRONMENT, NOT FINDINGS. ${step} failed for ${host}.`)
  console.error('')
  console.error(`  ${detail}`)
  console.error('')
  console.error(`  ${remedy}`)
  console.error('')
  console.error('  No suite has been run. Nothing here is a defect in this repository.')
  console.error('')
  process.exit(1)
}

// ── STEP 3 FIRST, because it is context for whatever the other two say ────
const tunnels = (spawnSync('ifconfig', [], { encoding: 'utf8' }).stdout ?? '')
  .split('\n').filter((l) => /^(utun|tun|tap|ppp)\d+:/.test(l)).length
const resolvers = (spawnSync('scutil', ['--dns'], { encoding: 'utf8' }).stdout ?? '')
  .split('\n').filter((l) => l.includes('nameserver[0]')).map((l) => l.split(':').pop().trim())
const uniqueResolvers = [...new Set(resolvers)]
const vpnLikely = tunnels > 0 || uniqueResolvers.some((r) => /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(r))
console.log(`  vpn: ${vpnLikely ? 'ACTIVE OR LIKELY' : 'none detected'} (${tunnels} tunnel interfaces, resolvers ${uniqueResolvers.join(', ') || 'unknown'})`)

// ── STEP 1: DNS ───────────────────────────────────────────────────────────
let address
const t0 = Date.now()
try {
  address = (await dns.lookup(host)).address
  console.log(`  dns: ${host} -> ${address} in ${Date.now() - t0}ms`)
} catch (err) {
  fail('DNS resolution', `getaddrinfo ${err.code} after ${Date.now() - t0}ms.`,
    vpnLikely
      ? 'A VPN is active. Its resolver is the first suspect: a stuck entry looks exactly like the service being down. Try toggling the VPN, then: sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder'
      : 'Flush the resolver: sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder')
}

// ── STEP 2: TCP ───────────────────────────────────────────────────────────
const t1 = Date.now()
await new Promise((resolve) => {
  const sock = net.connect({ host: address, port, timeout: 8000 })
  sock.on('connect', () => { console.log(`  tcp: ${address}:${port} open in ${Date.now() - t1}ms`); sock.destroy(); resolve() })
  sock.on('timeout', () => { sock.destroy()
    fail('TCP connect', `${address}:${port} did not answer within 8000ms, though DNS resolved.`,
      'DNS is fine, so this is not a resolver problem: a firewall or the network path is dropping the connection.') })
  sock.on('error', (err) => { sock.destroy()
    fail('TCP connect', `${address}:${port} -> ${err.code}, though DNS resolved.`,
      err.code === 'ECONNREFUSED'
        ? 'The host answered and refused the port. That is the service, not the network.'
        : 'DNS is fine, so this is not a resolver problem.') })
})

console.log(`PASS  ${host} reachable: dns and tcp both answered`)
