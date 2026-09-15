// ── THE PANEL WITH ITS OWN STORE, FOR TESTS ONLY ─────────────────────────
//
// R1 lifted `useFieldRows` to `TestBedHost`, because `StageTabs` unmounts each
// panel on a tab switch and the panel owning the store meant every unsaved
// edit was discarded. `TestBedPanel` now takes the controller as a prop.
//
// Three tests render the panel DIRECTLY, without a host. Rather than three
// copies of the same wrapper drifting apart (Verification 20), this is the one
// place that supplies a store for that case.
//
// It is deliberately NOT used by the application: the whole point of the lift
// is that production has exactly one store, owned above the tabs.
import { TestBedPanel } from './TestBedPanel'
import { testBedDescriptors, type TestBedSource } from './descriptors'
import { useFieldRows } from '../field-row/useFieldRows'

type PanelProps = Omit<React.ComponentProps<typeof TestBedPanel>, 'rows'>

export function TestBedPanelForTest(props: PanelProps & { source: TestBedSource }) {
  const rows = useFieldRows(testBedDescriptors(props.source))
  return <TestBedPanel {...props} rows={rows} />
}
