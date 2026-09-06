// ── ROUND 5 PHASE 3 ITEM 1c: THE DETECTORS, PROVED ABLE TO FAIL ─────────
//
// The Phase 2 lesson, twice over: a silent verdict is a claim about the
// INJECTION until the injection is shown to violate something. So the
// injection here is the EXACT defect that shipped - Card declared inside the
// render body - not an approximation of it.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = new URL('../../', import.meta.url).pathname
const SNAP = process.env.SNAP
if (!SNAP) throw new Error('SNAP is required')
mkdirSync(SNAP, { recursive: true })
const PANEL = 'frontend-react/src/reference/ReferencePanel.tsx'
const key = SNAP + '/' + PANEL.replaceAll('/', '_')

if (!existsSync(ROOT + PANEL)) throw new Error('panel missing')
const original = readFileSync(ROOT + PANEL)
writeFileSync(key, original)
if (!existsSync(key) || readFileSync(key).length !== original.length) {
  throw new Error('SNAPSHOT NOT VERIFIED')
}
console.log(`snapshot verified  ${PANEL}  ${original.length}B`)

const restore = () => {
  writeFileSync(ROOT + PANEL, readFileSync(key))
  if (!readFileSync(ROOT + PANEL).equals(original)) throw new Error('RESTORE MISMATCH - STOPPING')
}
const sh = (cmd) => {
  const started = Date.now()
  // The child needs PUPPETEER_PATH, which is not a repository dependency.
  // Round 4 lost a whole calibration to this: the probe exited in 111ms and
  // the harness scored it as a detection (Verification 48).
  const env = { ...process.env }
  try { return { green: true, out: execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', env }), ms: Date.now() - started } }
  catch (e) { return { green: false, out: (e.stdout ?? '') + (e.stderr ?? ''), ms: Date.now() - started } }
}
const suite = () => sh('npm --prefix frontend-react run test')
const probe = () => { sh('npm run build:react'); return sh('node --env-file=.env scripts/round5/typing-probe.mjs') }
const line = (o) => (o.match(/Tests {2}.*$/m) ?? o.match(/TYPING: \d+\/\d+/) ?? ['<none>'])[0].trim()
const fired = (o) => [...new Set([...o.matchAll(/^\s*×\s+(.+?)\s+\d+ms$/gm)].map((m) => m[1].trim()))].slice(0, 3)
const probeFails = (o) => (o.match(/^ {2}FAIL .*$/gm) ?? []).slice(0, 3).map((l) => l.trim().slice(0, 95))

console.log('\nBASELINE')
sh('npm run build:react')
const bs = suite(), bp = probe()
console.log(`  suite ${bs.green ? 'GREEN' : '*** RED ***'}  ${line(bs.out)}`)
console.log(`  probe ${bp.green ? 'GREEN' : '*** RED ***'}  ${line(bp.out)}  ${bp.ms}ms`)
if (!bs.green || !bp.green) {
  console.log(fired(bs.out).join('\n'))
  console.log(bp.out.split('\n').slice(-6).join('\n'))
  process.exit(1)
}
const BASE_MS = bp.ms

// ── THE INJECTION: Card back INSIDE the render body ─────────────────────
const src = readFileSync(ROOT + PANEL, 'utf8')
const HOISTED = /\/\*\*\n \* A titled card\.[\s\S]*?\n\}\n\n(?=export function ReferencePanel)/
if (!HOISTED.test(src)) throw new Error('ANCHOR NOT FOUND: the hoisted Card')
const inlined = src.replace(HOISTED, '').replace(
  `  const rows = useFieldRows(fields)`,
  `  const Card = ({ title, testId, children }: {
    title: string, testId: string, children: React.ReactNode
  }) => (
    <section className="pg-card" data-testid={testId}>
      <p className="pg-card-title">{title}</p>
      {children}
    </section>
  )
  const rows = useFieldRows(fields)`)
if (inlined === src) throw new Error('INJECTION DID NOT APPLY')
writeFileSync(ROOT + PANEL, inlined)

const is = suite(), ip = probe()
restore()
sh('npm run build:react')

console.log('\nINJECTED  Card declared inside the render body (the shipped defect)')
console.log(`  suite ${is.green ? 'SILENT' : 'DETECTED'}  ${line(is.out)}`)
for (const f of fired(is.out)) console.log(`    fired  ${f}`)
console.log(`  probe ${ip.green ? 'SILENT' : 'DETECTED'}  ${line(ip.out)}  ${ip.ms}ms`)
for (const f of probeFails(ip.out)) console.log(`    ${f}`)
// Verification 48: a run far under the baseline has not run.
if (!ip.green && ip.ms < BASE_MS / 3) console.log('  *** the probe failed suspiciously fast; check it ran')

console.log('\nFINAL REVERTED RUN')
const fs2 = suite(), fp = probe()
console.log(`  suite ${fs2.green ? 'GREEN' : '*** NOT GREEN ***'}  ${line(fs2.out)}`)
console.log(`  probe ${fp.green ? 'GREEN' : '*** NOT GREEN ***'}  ${line(fp.out)}`)
console.log(`  ${readFileSync(ROOT + PANEL).equals(original) ? 'identical' : '*** DIFFERS ***'}  ${PANEL}`)

const ok = !is.green && !ip.green && fs2.green && fp.green
console.log(ok
  ? '\nBOTH DETECTORS FIRE ON THE REAL DEFECT, and both come back green.'
  : '\n*** A DETECTOR DID NOT BEHAVE ***')
process.exit(ok ? 0 : 1)
