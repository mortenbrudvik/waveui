import type { Meta, StoryObj } from '@storybook/react';
import { Toolbar, Button, ToggleButton, Link } from '../src';
import { orientationArgType } from './_helpers';

const meta = {
  title: 'Components/Button/Toolbar',
  component: Toolbar,
  argTypes: {
    ...orientationArgType,
  },
  args: {
    'aria-label': 'Formatting options',
    children: (
      <>
        <ToggleButton appearance="subtle" size="small">
          Bold
        </ToggleButton>
        <ToggleButton appearance="subtle" size="small">
          Italic
        </ToggleButton>
        <ToggleButton appearance="subtle" size="small">
          Underline
        </ToggleButton>
      </>
    ),
  },
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One Tab stop: Left/Right move between the buttons, Home/End jump to the ends. */
export const Default: Story = {};

/** Up/Down move between the buttons (`aria-orientation="vertical"`). */
export const Vertical: Story = {
  args: {
    orientation: 'vertical',
  },
};

/** Disabled controls are skipped by the arrow keys. */
export const WithDisabledControl: Story = {
  args: {
    'aria-label': 'Document actions',
    children: (
      <>
        <Button appearance="subtle" size="small">
          Copy
        </Button>
        <Button appearance="subtle" size="small" disabled>
          Paste
        </Button>
        <Button appearance="subtle" size="small">
          Delete
        </Button>
      </>
    ),
  },
};

/** Any focusable child takes part; a text field keeps Left/Right for its caret. */
export const MixedControls: Story = {
  args: {
    'aria-label': 'Search tools',
    children: (
      <>
        <Button appearance="subtle" size="small">
          Filter
        </Button>
        <input
          aria-label="Search"
          className="h-6 rounded border border-input bg-background px-2 text-caption-1 text-foreground"
        />
        <Link href="#toolbar-help">Help</Link>
      </>
    ),
  },
};
