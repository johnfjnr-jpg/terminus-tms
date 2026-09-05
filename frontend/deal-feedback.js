// ── SHARED BY THE DEAL FORM AND THE VERSION MACHINERY ──────────────────────
//
// This module exists because the split of Round 3 Session D2c found a function
// that clears ONE ELEMENT OWNED BY EACH SIDE: `#deal-feedback` belongs to the
// form, `#deal-version-feedback` belongs to the versions card. Both halves call
// it, so neither half can own it without reaching across the boundary.
//
// It is NOT in the ruled seam, and it is not a candidate for one. The seam is
// what the version machinery needs the FORM to do; this is a leaf that touches
// two elements and holds no state, so a single shared definition is cheaper and
// safer than a seam member or a second copy. Verification 20: a second reader of
// one value always drifts, and two copies of a two-element clear is exactly that
// shape.
//
// It does not belong in `src/lib` either. Those modules are shared with the
// SERVER and none of them touches the DOM; this one is browser-only by nature.

// ── FEEDBACK IS CLEARED ON LOAD AND ON THE NEXT ACTION. Round 41, finding 2 ─
//
// Neither element was ever cleared. "Saved (revision 24)." sat on screen for
// SEVEN HOURS AND THIRTY-EIGHT MINUTES through eight later writes, and the
// version error survived navigating away and back, because navigating in this
// application re-renders a panel's contents rather than rebuilding the DOM.
// Only a browser refresh cleared them, which is the one thing a person does not
// do when a message is telling them something.
//
// TWO MOMENTS, AND BOTH ARE NEEDED. On load, because a message about the last
// record is not about this one. Before the next action, because a message about
// the last attempt is not about this one either, and the second is what makes a
// failure legible: the screen goes quiet, then says what happened.
export function clearDealFeedback() {
  const fb = document.getElementById('deal-feedback')
  if (fb) { fb.textContent = ''; fb.className = '' }
  const vf = document.getElementById('deal-version-feedback')
  if (vf) { vf.textContent = ''; vf.className = 'hidden' }
}
