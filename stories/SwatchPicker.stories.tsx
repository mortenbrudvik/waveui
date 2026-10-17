import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { SwatchPicker, Tooltip } from '../src';
import {
  ColorSwatch,
  EmptySwatch,
  ImageSwatch,
} from '../src/components/input/SwatchPicker.swatches';

const defaultItems = [
  { value: 'red', color: '#d13438', label: 'Red' }, // wave-allow-color: fixture
  { value: 'blue', color: '#0f6cbd', label: 'Blue' }, // wave-allow-color: fixture
  { value: 'green', color: '#107c10', label: 'Green' }, // wave-allow-color: fixture
  { value: 'yellow', color: '#ffb900', label: 'Yellow' }, // wave-allow-color: fixture
  { value: 'purple', color: '#5c2d91', label: 'Purple' }, // wave-allow-color: fixture
  { value: 'teal', color: '#008272', label: 'Teal' }, // wave-allow-color: fixture
  { value: 'pink', color: '#e3008c', label: 'Pink' }, // wave-allow-color: fixture
  { value: 'black', color: '#242424', label: 'Black' }, // wave-allow-color: fixture
];

const meta = {
  title: 'Components/Input/SwatchPicker',
  component: SwatchPicker,
  argTypes: {
    size: { control: 'select', options: ['extra-small', 'small', 'medium', 'large'] },
    shape: { control: 'select', options: ['circular', 'square', 'rounded'] },
    layout: { control: 'inline-radio', options: ['row', 'grid'] },
    focusMode: { control: 'inline-radio', options: ['arrow', 'tab'] },
    spacing: { control: 'inline-radio', options: ['small', 'medium'] },
  },
  args: {
    items: defaultItems,
    'aria-label': 'Accent color',
    onValueChange: fn(),
  },
} satisfies Meta<typeof SwatchPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One tab stop; arrow keys move and select. The selection shows a ring and a check glyph. */
export const Default: Story = {
  args: {
    defaultValue: 'blue',
  },
};

export const Square: Story = {
  args: {
    shape: 'square',
    defaultValue: 'yellow',
  },
};

export const Large: Story = {
  args: {
    size: 'large',
    shape: 'rounded',
    defaultValue: 'teal',
  },
};

/** Controlled: the parent owns `value` and updates it from `onValueChange`. */
export const Controlled: Story = {
  render: function ControlledStory(args) {
    const [value, setValue] = useState('red');
    const selected = defaultItems.find((item) => item.value === value);
    return (
      <div className="flex flex-col gap-2">
        <p className="text-body-1 text-foreground">Selected: {selected?.label ?? 'none'}</p>
        <SwatchPicker
          {...args}
          value={value}
          onValueChange={(next) => {
            setValue(next);
            args.onValueChange?.(next);
          }}
        />
      </div>
    );
  },
};

const fixture = {
  red: '#d13438', // wave-allow-color: fixture
  blue: '#0f6cbd', // wave-allow-color: fixture
  green: '#107c10', // wave-allow-color: fixture
  yellow: '#ffb900', // wave-allow-color: fixture
  purple: '#5c2d91', // wave-allow-color: fixture
  teal: '#008272', // wave-allow-color: fixture
  berry: '#c239b3', // wave-allow-color: fixture
  white: '#ffffff', // wave-allow-color: fixture
  edge: '#8a8886', // wave-allow-color: fixture
};

// A diagonal-stripe pattern: placeholder paint, not a UI color.
const stripes = `data:image/svg+xml,${encodeURIComponent(
  // wave-allow-color: fixture (placeholder image paint)
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#c8c6c4"/><path d="M0 8L8 0" stroke="#605e5c" stroke-width="2"/></svg>',
)}`;

/**
 * Swatches are children, so each can be wrapped: a `Tooltip` with `relationship="label"` names a
 * swatch and `relationship="description"` describes it. `items` render first.
 */
export const SwatchChildrenWithTooltips: Story = {
  name: 'Swatch children with tooltips',
  args: {
    items: undefined,
    defaultValue: 'ocean',
  },
  render: (args) => (
    <SwatchPicker {...args}>
      <Tooltip content="Ocean" relationship="label">
        <ColorSwatch value="ocean" color={fixture.blue} />
      </Tooltip>
      <Tooltip content="Forest" relationship="label">
        <ColorSwatch value="forest" color={fixture.green} />
      </Tooltip>
      <Tooltip content="Used for links and highlights" relationship="description">
        <ColorSwatch value="berry" color={fixture.berry} aria-label="Berry" />
      </Tooltip>
    </SwatchPicker>
  ),
};

/**
 * `layout="grid"`: rows of cells (`SwatchPicker.Row`). The arrow keys move focus in two
 * dimensions without selecting; Space, Enter and a click select.
 */
export const GridLayout: Story = {
  name: 'Grid layout',
  args: {
    items: undefined,
    layout: 'grid',
    defaultValue: 'blue',
  },
  render: (args) => (
    <SwatchPicker {...args}>
      <SwatchPicker.Row>
        <ColorSwatch value="red" color={fixture.red} aria-label="Red" />
        <ColorSwatch value="blue" color={fixture.blue} aria-label="Blue" />
        <ColorSwatch value="green" color={fixture.green} aria-label="Green" />
      </SwatchPicker.Row>
      <SwatchPicker.Row>
        <ColorSwatch value="yellow" color={fixture.yellow} aria-label="Yellow" />
        <ColorSwatch value="purple" color={fixture.purple} aria-label="Purple" disabled />
        <EmptySwatch onClick={fn()} />
      </SwatchPicker.Row>
    </SwatchPicker>
  ),
};

/**
 * `focusMode="tab"`: every enabled swatch is its own tab stop and the arrow keys do nothing. The
 * picker is a group of toggle buttons (`aria-pressed`), in both layouts.
 */
export const TabFocusMode: Story = {
  name: 'Tab focus mode',
  args: {
    focusMode: 'tab',
    defaultValue: 'green',
  },
  render: (args) => (
    <div className="flex flex-col gap-4">
      <SwatchPicker {...args} aria-label="Accent color, row layout" />
      <SwatchPicker {...args} items={undefined} layout="grid" aria-label="Accent color, grid">
        <SwatchPicker.Row>
          <ColorSwatch value="red" color={fixture.red} aria-label="Red" />
          <ColorSwatch value="green" color={fixture.green} aria-label="Green" />
        </SwatchPicker.Row>
        <SwatchPicker.Row>
          <ColorSwatch value="blue" color={fixture.blue} aria-label="Blue" />
        </SwatchPicker.Row>
      </SwatchPicker>
    </div>
  ),
};

/**
 * Color, image and empty swatches; a disabled one, an `icon`, a `borderColor`, and a swatch with
 * its own `size` and `shape`.
 */
export const SwatchKinds: Story = {
  name: 'Swatch kinds',
  args: {
    items: undefined,
    defaultValue: 'stripes',
  },
  render: (args) => (
    <SwatchPicker {...args}>
      <ColorSwatch value="red" color={fixture.red} aria-label="Red" />
      <ColorSwatch
        value="white"
        color={fixture.white}
        borderColor={fixture.edge}
        aria-label="White"
      />
      <ColorSwatch value="teal" color={fixture.teal} aria-label="Teal" disabled />
      <ColorSwatch value="gold" color={fixture.yellow} aria-label="Gold" icon="*" />
      <ColorSwatch
        value="big"
        color={fixture.purple}
        aria-label="Large square"
        size="large"
        shape="square"
      />
      <ImageSwatch value="stripes" src={stripes} aria-label="Stripes" />
      <EmptySwatch onClick={fn()} />
    </SwatchPicker>
  ),
};

/**
 * `size` (20, 24, 32 or 40px) and `spacing` (4px or 8px gap). At `small` spacing the focus
 * outline's offset shrinks so it does not cover the neighbour.
 */
export const SizesAndSpacing: Story = {
  name: 'Sizes and spacing',
  args: {
    defaultValue: 'red',
  },
  render: (args) => (
    <div className="flex flex-col gap-4">
      <SwatchPicker
        {...args}
        size="extra-small"
        spacing="small"
        aria-label="Extra small, small spacing"
      />
      <SwatchPicker {...args} size="small" spacing="small" aria-label="Small, small spacing" />
      <SwatchPicker {...args} size="medium" aria-label="Medium, medium spacing" />
      <SwatchPicker {...args} size="large" aria-label="Large, medium spacing" />
    </div>
  ),
};
