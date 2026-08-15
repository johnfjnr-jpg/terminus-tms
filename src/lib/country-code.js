// Country name -> 3-letter code, for reference_code generation
// (issue_reference_number requires one, see reference-number.js).
//
// Ported from the prototype's own countryToCode() (Terminus Ops.dc.html:
// 7720-7729) rather than invented fresh - checked first, no mapping
// existed anywhere in the live codebase (Milestone 4 audit, 2026-08-15).
//
// The fallback for anything not in the map (first 3 letters of the name,
// uppercased, padded with 'X') is the prototype's own approach, not real
// ISO 3166-1 alpha-3 data - inherited as-is, not fixed here. It can
// produce a wrong or colliding code for a country outside this list (e.g.
// "Vietnam" -> "VIE", the real ISO code is "VNM"). Good enough for the
// countries this map already covers; anything else gets an honest-effort
// but non-authoritative code, same limitation the prototype always had.
const COUNTRY_CODE_MAP = {
  'united kingdom': 'GBR', 'uk': 'GBR', 'ireland': 'IRL', 'united states': 'USA', 'usa': 'USA', 'canada': 'CAN',
  'germany': 'DEU', 'france': 'FRA', 'netherlands': 'NLD', 'singapore': 'SGP', 'australia': 'AUS', 'uae': 'ARE',
  'united arab emirates': 'ARE', 'saudi arabia': 'SAU', 'japan': 'JPN', 'south korea': 'KOR', 'india': 'IND',
}

export function countryToCode(country) {
  const key = (country || '').trim().toLowerCase()
  if (COUNTRY_CODE_MAP[key]) return COUNTRY_CODE_MAP[key]
  const letters = key.replace(/[^a-z]/g, '')
  return letters ? letters.substring(0, 3).toUpperCase().padEnd(3, 'X') : null
}
