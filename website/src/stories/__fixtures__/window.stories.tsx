/**
 * A story module for runtime.test.tsx, outside the library's stories: `ReadsWindow` reads `window`
 * in its render function, which has no `window` on the server; `Plain` renders anywhere.
 */
import { Button } from '../../../../src';

const meta = {
  title: 'Fixtures/Window',
  component: Button,
};

export default meta;

export const ReadsWindow = {
  render: () => <Button>{`Viewport ${window.innerWidth}px wide`}</Button>,
};

export const Plain = {
  args: { children: 'Plain' },
};
