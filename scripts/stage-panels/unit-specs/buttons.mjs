// The two actions lose their class again, which is the state a 1920 capture
// found: white browser defaults on a dark screen, every other assertion green.
const I = (id, file, find, replace, expect) => ({ id, file, find, replace, expect })
export default {
  name: 'buttons',
  testFiles: ['src/__tests__/stage-panels-walk2.test.tsx', 'src/__tests__/testbed-walk2-layout.test.tsx'],
  injections: [
    I('Next Stage loses its class', 'frontend-react/src/testbed/StageTabs.tsx',
      '              <button type="button" className="btn-sm btn-primary"\n                data-testid="tb-next-stage-btn"',
      '              <button type="button"\n                data-testid="tb-next-stage-btn"',
      ['the Next Stage control is not a browser default']),
    I('Convert loses its class', 'frontend-react/src/testbed/ConvertPanel.tsx',
      '        ? <button type="button" className="btn-ghost btn-sm" data-testid="tb-convert-trigger"',
      '        ? <button type="button" data-testid="tb-convert-trigger"',
      ['Convert to Opportunity carries the ghost treatment the vanilla gave it']),
  ],
}
