import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Toolbar, Button, ToggleButton, Link, Text } from '../src';
import type { CheckedValues, Size } from '../src';
import { orientationArgType, sizeArgType } from './_helpers';

/** Decorative 16px glyphs (the parts hide their icon slot from assistive technology). */
const glyph = (path: string) => {
  const Glyph = () => (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d={path} />
    </svg>
  );
  return Glyph;
};
const BoldIcon = glyph(
  'M4.5 2.5h4a3 3 0 0 1 2.1 5.1A3.25 3.25 0 0 1 9 13.5H4.5zm1.5 1.5v3h2.5a1.5 1.5 0 0 0 0-3zm0 4.5v3.5h3a1.75 1.75 0 0 0 0-3.5z',
);
const ItalicIcon = glyph('M6.5 2.5h6V4h-2.3l-2.5 8H10v1.5H4V12h2.3l2.5-8H6.5z');
const UnderlineIcon = glyph(
  'M4.5 2.5H6v5a2 2 0 0 0 4 0v-5h1.5v5a3.5 3.5 0 0 1-7 0zM3.5 13h9v1.5h-9z',
);
const AlignLeftIcon = glyph('M2 3h12v1.5H2zm0 3.5h8V8H2zM2 10h12v1.5H2zm0 3.5h8V15H2z');
const AlignCenterIcon = glyph('M2 3h12v1.5H2zm2 3.5h8V8H4zM2 10h12v1.5H2zm2 3.5h8V15H4z');
const AlignRightIcon = glyph('M2 3h12v1.5H2zm4 3.5h8V8H6zM2 10h12v1.5H2zm4 3.5h8V15H6z');
const PasteIcon = glyph(
  'M5.5 1.5h5V3H12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h1.5zm1.5 1.5v1h2V3zM4.5 4.5v9h7v-9z',
);
const CutIcon = glyph(
  'M4.5 9.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM5 2l3 5.3L11 2h1.7L8.9 8.6l1 1.7-1.3.8L8 10l-.6 1.1-1.3-.8 1-1.7L3.3 2z',
);
const CopyIcon = glyph('M5 1.5h8.5V11H12V3H5zM2.5 4.5H10V15H2.5zm1.5 1.5v7.5h4.5V6z');

const meta = {
  title: 'Components/Button/Toolbar',
  component: Toolbar,
  argTypes: {
    ...orientationArgType,
    ...sizeArgType,
  },
  args: {
    'aria-label': 'Formatting options',
    onCheckedValuesChange: fn(),
    children: (
      <>
        <Toolbar.ToggleButton name="format" value="bold">
          Bold
        </Toolbar.ToggleButton>
        <Toolbar.ToggleButton name="format" value="italic">
          Italic
        </Toolbar.ToggleButton>
        <Toolbar.ToggleButton name="format" value="underline">
          Underline
        </Toolbar.ToggleButton>
      </>
    ),
  },
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * One Tab stop: Left/Right move between the toggles, Home/End jump to the ends, Space or Enter
 * presses one. The pressed toggles are the toolbar's `checkedValues` (`{ format: [...] }`).
 */
export const Default: Story = {};

/** Up/Down move between the toggles (`aria-orientation="vertical"`). */
export const Vertical: Story = {
  args: {
    orientation: 'vertical',
  },
};

/**
 * A text editor's toolbar: icon-only toggles (`isAccessible` draws the pressed state as a brand
 * fill), an alignment radio group (Left/Right move through the toolbar, Up/Down among the
 * alignments; the arrows never check, Space or Enter does), dividers and a named group with a
 * Button.
 */
export const TextEditor: Story = {
  args: {
    'aria-label': 'Text formatting',
    defaultCheckedValues: { format: ['bold'], align: ['left'] },
    children: (
      <>
        <Toolbar.ToggleButton
          name="format"
          value="bold"
          icon={<BoldIcon />}
          aria-label="Bold"
          isAccessible
        />
        <Toolbar.ToggleButton
          name="format"
          value="italic"
          icon={<ItalicIcon />}
          aria-label="Italic"
          isAccessible
        />
        <Toolbar.ToggleButton
          name="format"
          value="underline"
          icon={<UnderlineIcon />}
          aria-label="Underline"
          isAccessible
        />
        <Toolbar.Divider />
        <Toolbar.RadioGroup aria-label="Text alignment">
          <Toolbar.RadioButton
            name="align"
            value="left"
            icon={<AlignLeftIcon />}
            aria-label="Align left"
            isAccessible
          />
          <Toolbar.RadioButton
            name="align"
            value="center"
            icon={<AlignCenterIcon />}
            aria-label="Align center"
            isAccessible
          />
          <Toolbar.RadioButton
            name="align"
            value="right"
            icon={<AlignRightIcon />}
            aria-label="Align right"
            isAccessible
          />
        </Toolbar.RadioGroup>
        <Toolbar.Divider />
        <Toolbar.Group aria-label="Document">
          <Toolbar.Button appearance="primary">Share</Toolbar.Button>
        </Toolbar.Group>
      </>
    ),
  },
};

const sizes: Size[] = ['extra-small', 'small', 'medium', 'large', 'extra-large'];

/**
 * `size` sets the default size of the parts and the toolbar's padding (the size control is off
 * here: each toolbar sets its own). A plain Button inside keeps its own size (Help).
 */
export const Sizes: Story = {
  argTypes: {
    size: { control: false },
  },
  render: (args) => (
    <div className="flex flex-col items-start gap-3">
      {sizes.map((size) => (
        <Toolbar {...args} key={size} size={size} aria-label={`Formatting (${size})`}>
          <Toolbar.ToggleButton name="format" value="bold">
            Bold
          </Toolbar.ToggleButton>
          <Toolbar.Divider />
          <Toolbar.RadioGroup aria-label={`Text alignment (${size})`}>
            <Toolbar.RadioButton name="align" value="left">
              Left
            </Toolbar.RadioButton>
            <Toolbar.RadioButton name="align" value="right">
              Right
            </Toolbar.RadioButton>
          </Toolbar.RadioGroup>
          <Toolbar.Divider />
          <Toolbar.Button>{size}</Toolbar.Button>
          <Button appearance="subtle">Help</Button>
        </Toolbar>
      ))}
    </div>
  ),
};

/** `vertical` puts the icon above a caption-size label, for ribbon-style toolbars. */
export const VerticalButtons: Story = {
  args: {
    'aria-label': 'Clipboard',
    children: (
      <>
        <Toolbar.Button vertical icon={<PasteIcon />}>
          Paste
        </Toolbar.Button>
        <Toolbar.Button vertical icon={<CutIcon />}>
          Cut
        </Toolbar.Button>
        <Toolbar.Button vertical icon={<CopyIcon />}>
          Copy
        </Toolbar.Button>
      </>
    ),
  },
};

/** Controlled: the parent owns `checkedValues` and updates it from `onCheckedValuesChange`. */
export const ControlledCheckedValues: Story = {
  render: function ControlledStory(args) {
    const [values, setValues] = useState<CheckedValues>({ format: [], align: ['left'] });
    return (
      <div className="flex flex-col items-start gap-2">
        <Toolbar
          {...args}
          checkedValues={values}
          onCheckedValuesChange={(next, details) => {
            setValues(next);
            args.onCheckedValuesChange?.(next, details);
          }}
        >
          <Toolbar.ToggleButton name="format" value="bold">
            Bold
          </Toolbar.ToggleButton>
          <Toolbar.ToggleButton name="format" value="italic">
            Italic
          </Toolbar.ToggleButton>
          <Toolbar.Divider />
          <Toolbar.RadioGroup aria-label="Text alignment">
            <Toolbar.RadioButton name="align" value="left">
              Left
            </Toolbar.RadioButton>
            <Toolbar.RadioButton name="align" value="center">
              Center
            </Toolbar.RadioButton>
          </Toolbar.RadioGroup>
        </Toolbar>
        <Text>
          Format: {values.format?.join(', ') || 'none'}; alignment: {values.align?.[0] ?? 'none'}
        </Text>
      </div>
    );
  },
};

/**
 * Natively disabled controls (Cut) are skipped by the arrow keys; `disabledFocusable` ones (Paste)
 * stay in the arrow-key order but do nothing when activated.
 */
export const WithDisabledControl: Story = {
  args: {
    'aria-label': 'Document actions',
    children: (
      <>
        <Toolbar.Button>Copy</Toolbar.Button>
        <Toolbar.Button disabledFocusable>Paste</Toolbar.Button>
        <Toolbar.Button disabled>Cut</Toolbar.Button>
        <Toolbar.Button>Delete</Toolbar.Button>
      </>
    ),
  },
};

/**
 * Any focusable child takes part, not only the parts: a plain ToggleButton, a text field (which
 * keeps Left/Right for its caret) and a link.
 */
export const MixedControls: Story = {
  args: {
    'aria-label': 'Search tools',
    children: (
      <>
        <ToggleButton appearance="subtle" size="small">
          Filter
        </ToggleButton>
        <input
          aria-label="Search"
          className="h-6 rounded border border-input bg-background px-2 text-caption-1 text-foreground"
        />
        <Link href="#toolbar-help">Help</Link>
      </>
    ),
  },
};
