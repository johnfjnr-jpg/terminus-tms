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
// R1 part 2: IT RENDERS BOTH HALVES OF THE SURFACE, and that is the point
// rather than a convenience. Sensor Counts and Commercials moved to the
// Commercials tab, so the Test Bed's 28 editable rows now live in two
// components that share one store. A door test asking "can every row be
// opened on a record I own" is a claim about the SURFACE, not about one
// component, and a wrapper rendering only the panel would have quietly
// reduced that claim from 28 rows to 16 while still reading green.
import { TestBedPanel } from './TestBedPanel'
import { CommercialsCards } from './CommercialsCards'
import { TestBedBand } from './TestBedBand'
import { testBedDescriptors, type TestBedSource } from './descriptors'
import { useFieldRows } from '../field-row/useFieldRows'
import { EditBar } from '../field-row/EditBar'

type PanelProps = Omit<React.ComponentProps<typeof TestBedPanel>, 'rows'>

export function TestBedPanelForTest(
  { onSave, ...props }: PanelProps & { source: TestBedSource, onSave?: (c: Record<string, string>) => void },
) {
  const fields = testBedDescriptors(props.source)
  const rows = useFieldRows(fields)
  return (
    <>
      {/* THE BAND IS PART OF THE SURFACE TOO, and it is here for exactly the
          reason CommercialsCards is. The Summary row moved out of
          `TestBedPanel` into the header's band, and the door suite's whole
          claim is about the SURFACE - "can every row be opened on a record I
          own" - not about one component. A wrapper rendering only the panel
          would have quietly reduced that claim from 28 rows to 27 while
          still reading green.

          IT DID NOT READ GREEN, which is the point worth recording: the
          population assertion added this round went red the moment the row
          moved, before anybody looked at a screen. That is the first time it
          fired on a real change rather than on an injection. */}
      <TestBedBand source={props.source} rows={rows} />
      <TestBedPanel {...props} rows={rows} />
      <CommercialsCards rows={rows} fields={fields} />
      {/* The bar is part of the surface and moved to the host with the store,
          for the reason recorded at its render site: inside the Reference
          panel it vanished on a tab switch, leaving the moved cost rows with
          no way to save. A wrapper standing in for the host renders it. */}
      <EditBar rows={rows} onSave={onSave ?? (() => {})} saveId="tb-react-save-all" />
    </>
  )
}
