/**
 * The chart stories in a right-to-left layout (`Guides/Charts`, the direction toolbar set to `rtl`).
 * jsdom has no layout and no 2D canvas, so the charts' axes and legends cannot be read here (the
 * real-browser pass of the story checks the reversed axes); this runs both stories under `dir="rtl"`
 * to prove they render there, with their image name and data table, and pass axe.
 */
import { render, screen } from '@testing-library/react';
import { composeStories, setProjectAnnotations } from '@storybook/react';
import preview from '../../.storybook/preview';
import * as chartStories from '../../stories/Charts.stories';
import { expectNoA11yViolations } from '../test-utils';

setProjectAnnotations({ ...preview, initialGlobals: { theme: 'light', dir: 'rtl' } });

const { Recharts, ChartJs } = composeStories(chartStories);

describe.each([
  ['Recharts', Recharts],
  ['Chart.js', ChartJs],
])('Guides/Charts %s in a right-to-left layout', (_, Story) => {
  it('renders under dir="rtl" with its image, description and data table, and passes axe', async () => {
    render(<Story />);
    const root = screen
      .getByRole('img', { name: /Bar chart of the units sold/ })
      .closest('.wave-root');
    expect(root).toHaveAttribute('dir', 'rtl');
    expect(
      screen.getByRole('img', { name: /Bar chart of the units sold/ }),
    ).toHaveAccessibleDescription(/North sells the most/);
    expect(screen.getByRole('table', { name: /Units sold per quarter/ })).toBeInTheDocument();
    await expectNoA11yViolations();
  });
});
