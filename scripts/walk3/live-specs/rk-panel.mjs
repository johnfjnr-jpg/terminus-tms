// R-K live direction B: THE PANEL SCOPE.
//
// The move is scoped to a panel that DECLARES itself, so that a document-wide
// query can never reach another record resident in the same shell. Removing
// the declaration must take the Commercials panel's whole keyboard pass with
// it, and this proves the attribute is load-bearing on the real screen rather
// than decorative.
export default {
  probe: 'scripts/walk3/probe-rk-live.mjs',
  run: 'rk-panel',
  injections: [
    { id: 'R-K the Commercials panel stops declaring itself',
      file: 'frontend-react/src/testbed/CommercialsCards.tsx',
      find: '<div className="ref-cards" data-field-panel="commercials" data-testid="tb-commercials-cards">',
      replace: '<div className="ref-cards" data-testid="tb-commercials-cards">',
      expect: ['the Commercials panel declares itself'] },
  ],
}
