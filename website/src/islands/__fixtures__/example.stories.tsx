/**
 * A story module for the example tests, outside the library's stories: `Throws` throws from its
 * own render function, `LibraryThrows` renders a library part outside its root (the error comes
 * from inside the library, so the story runtime does not name it), `ReadsWindow` reads `window`
 * during render, which the server has not, and `NoControls` has no arg a control could change.
 */
import { Button, RatingItem } from '../../../../src';

const meta = {
  title: 'Fixtures/Example',
  component: Button,
};

export default meta;

export const Throws = {
  render: () => {
    throw new Error('Broken on purpose');
  },
};

export const LibraryThrows = {
  render: () => <RatingItem value={1} />,
};

export const ReadsWindow = {
  render: () => <Button>{`Viewport ${window.innerWidth}px wide`}</Button>,
};

export const NoControls = {
  args: { onClick: () => {} },
  render: () => <Button>No controls</Button>,
};
