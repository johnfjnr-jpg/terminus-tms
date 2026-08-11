// Creates one test Opportunity record plus a matching record_revisions
// row, with a payload in the exact shape loadDealInputsFromOpportunity()
// (src/routes/deals.js) expects. Field names and structure mirror that
// function's comment block, which in turn cites Prototype-110826/
// Terminus Ops.dc.html (oppUnits/oppMargins/oppTerms/oppPayment/
// oppFactoring) as the source of truth for the naming.
//
//   node --env-file=.env scripts/seed-test-opportunity.js [owner-email]
//
// owner-email defaults to john+test@terminustechnologies.io (see
// scripts/create-test-user.js) - the record's owner_id must be a real
// auth.users id for records_insert/record_revisions_insert RLS to ever
// allow that user's JWT to read it back via POST /api/deals/submit.
//
// Uses supabaseAdmin (service role) to bypass RLS for the insert itself,
// same sanctioned out-of-band use as scripts/create-test-user.js
// (see src/supabase.js usage log).

import { supabaseAdmin } from '../src/supabase.js'

const ownerEmail = process.argv[2] || 'john+test@terminustechnologies.io'

async function findUserByEmail(email) {
  const perPage = 200
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Failed to list users: ${error.message}`)

    const match = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match

    if (data.users.length < perPage) return null
  }
}

const owner = await findUserByEmail(ownerEmail)
if (!owner) {
  console.error(`No auth user found for ${ownerEmail}. Run scripts/create-test-user.js first.`)
  process.exit(1)
}

// Test figures as specified: 20 SafeSight units (all new infra), 5 AQ
// Sensor, 0 HEMIR; 30% margin explicitly on all four hardware lines;
// two-phase structure with a 24 month recovery period; factoring enabled
// at 1.5% declining balance over 24 months; 36 month contract duration.
// Unit costs and install/hosting rates reuse the reference figures from
// the prototype's product-line and otherCostValues data, for realism.
const payload = {
  // units
  ssExisting: 0,
  ssNew: 20,
  aqm: 5,
  hemir: 0,

  // resolved hardware unit costs (latest batch costs in the prototype's productLinesData)
  ssUnitCost: 2940,
  aqUnitCost: 1090,
  hemirUnitCost: 2480,

  // installation - standard per-unit, not lump sum
  isPerUnit: true,
  installResp: 'Terminus Installation Team',
  inSsExisting: 810,
  inSsNew: 2150,
  inAqm: 340,
  inHemir: 600,

  // hosting, per unit per month
  hoSafesight: 55,
  hoAqm: 20,
  hoHemir: 38,

  // margin - target 30%, explicit override on all four hardware lines
  targetMargin: 30,
  marginOverrides: {
    hwSs: 30,
    hwAqm: 30,
    hwHemir: 30,
    hwWarranty: 30,
  },

  warrantyPct: 2,
  whtPct: 0,
  gstPct: 0,
  grossUp: false,

  // structure / payment
  duration: 36,
  structure: 'twoPhase',
  recoveryMonths: 24,
  invoicing: 'annual',
  milestones: [],

  // lump sum fields unused for this deal
  lumpSumCost: 0,
  contractorMilestones: [],

  // factoring
  factoring: {
    enabled: true,
    ratePct: 1.5,
    termMonths: 24,
    method: 'declining',
  },
}

const { data: record, error: recordErr } = await supabaseAdmin
  .from('records')
  .insert({ record_type: 'opportunity', status: 'Discovery', owner_id: owner.id })
  .select()
  .single()

if (recordErr) {
  console.error(`Failed to create Opportunity record: ${recordErr.message}`)
  process.exit(1)
}

const { data: probDefault } = await supabaseAdmin
  .from('stage_probability_defaults')
  .select('default_probability_pct')
  .eq('record_type', 'opportunity')
  .is('variant', null)
  .eq('stage', 'Discovery')
  .maybeSingle()

const { error: detailsErr } = await supabaseAdmin
  .from('opportunity_details')
  .insert({ record_id: record.id, probability_pct: probDefault?.default_probability_pct ?? null })

if (detailsErr) {
  console.error(`Failed to create opportunity_details: ${detailsErr.message}`)
  process.exit(1)
}

const { error: revErr } = await supabaseAdmin
  .from('record_revisions')
  .insert({ record_id: record.id, revision_number: 1, payload, created_by: owner.id })

if (revErr) {
  console.error(`Failed to create record_revisions: ${revErr.message}`)
  process.exit(1)
}

await supabaseAdmin.from('audit_log').insert({
  record_id: record.id,
  record_type: 'opportunity',
  action: 'created',
  actor_id: owner.id,
  detail: { seeded: true, script: 'seed-test-opportunity.js' }
})

console.log(`Created test Opportunity ${record.id} (owner: ${ownerEmail})`)
