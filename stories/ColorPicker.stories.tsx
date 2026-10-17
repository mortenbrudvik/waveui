import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import {
  AlphaSlider,
  Button,
  ColorArea,
  ColorPicker,
  ColorSlider,
  Popover,
  SpinButton,
  hexToHsv,
  hsvToHex,
} from '../src';
import type { HsvColor } from '../src';
import { colorPickerShapeArgType } from './_helpers';

const meta = {
  title: 'Components/Input/ColorPicker',
  component: ColorPicker,
  argTypes: {
    ...colorPickerShapeArgType,
    showOpacity: { control: 'boolean' },
  },
  args: {
    'aria-label': 'Brand color',
    onValueChange: fn(),
  },
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The opacity slider edits the alpha byte of the value (`#rrggbbaa`). */
export const WithOpacity: Story = {
  args: {
    showOpacity: true,
    defaultValue: '#0f6cbdcc', // wave-allow-color: fixture
  },
};

/** Presets given as `{ color, label }` are announced by name instead of their hex code. */
export const CustomPresets: Story = {
  args: {
    presets: [
      { color: '#ff6b6b', label: 'Coral' }, // wave-allow-color: fixture
      { color: '#ffa94d', label: 'Tangerine' }, // wave-allow-color: fixture
      { color: '#ffd43b', label: 'Sunflower' }, // wave-allow-color: fixture
      { color: '#69db7c', label: 'Mint' }, // wave-allow-color: fixture
      { color: '#4dabf7', label: 'Sky' }, // wave-allow-color: fixture
      { color: '#9775fa', label: 'Lavender' }, // wave-allow-color: fixture
    ],
    defaultValue: '#ff6b6b', // wave-allow-color: fixture
  },
};

export const NoPresets: Story = {
  args: {
    presets: [],
    defaultValue: '#242424', // wave-allow-color: fixture
  },
};

/** Controlled: the parent owns `value` and updates it from `onValueChange`. */
export const Controlled: Story = {
  args: {
    showOpacity: true,
  },
  render: function ControlledStory(args) {
    const [color, setColor] = useState('#0f6cbd'); // wave-allow-color: fixture
    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-body-1 text-foreground">
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 rounded border border-border"
            style={{ backgroundColor: color }}
          />
          Color: {color}
        </p>
        <ColorPicker
          {...args}
          value={color}
          onValueChange={(next) => {
            setColor(next);
            args.onValueChange?.(next);
          }}
        />
      </div>
    );
  },
};

/** Fluent's composition: the standalone parts bind to the picker when they have no value of their own. */
export const Composed: Story = {
  render: (args) => (
    <ColorPicker {...args}>
      <ColorArea />
      <ColorSlider />
      <AlphaSlider />
    </ColorPicker>
  ),
};

/** Your own layout: vertical rails beside the area, then the picker's preview, hex field and swatches. */
export const CustomLayout: Story = {
  render: (args) => (
    <ColorPicker {...args}>
      <div className="flex gap-3">
        <ColorArea className="h-48" />
        <ColorSlider orientation="vertical" className="h-48" />
        <AlphaSlider orientation="vertical" className="h-48" />
      </div>
      <div className="flex items-start gap-2">
        <ColorPicker.Preview />
        <ColorPicker.HexField />
      </div>
      <ColorPicker.Swatches />
    </ColorPicker>
  ),
};

/** HSV to HSL (story helper): lightness from brightness and saturation. */
function hsvToHsl({ h, s, v }: HsvColor): { h: number; s: number; l: number } {
  const l = v * (1 - s / 2);
  return { h, s: l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l), l };
}

/** HSL to HSV (story helper), the inverse of `hsvToHsl`. */
function hslToHsv({ h, s, l }: { h: number; s: number; l: number }): HsvColor {
  const v = l + s * Math.min(l, 1 - l);
  return { h, s: v === 0 ? 0 : 2 * (1 - l / v), v };
}

/**
 * RGB and HSL fields (a recipe, not components): SpinButtons around a controlled hex value,
 * converted with `hexToHsv` and `hsvToHex`. The fields edit the opaque color.
 */
export const RgbAndHslFields: Story = {
  render: function RgbAndHslStory(args) {
    const [color, setColor] = useState('#0f6cbd'); // wave-allow-color: fixture
    const rgb = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
    const hsl = hsvToHsl(hexToHsv(color) ?? { h: 0, s: 0, v: 0 });
    const setRgb = (channel: number, next: number) => {
      const bytes = rgb.map((value, index) => (index === channel ? next : value));
      setColor(`#${bytes.map((value) => value.toString(16).padStart(2, '0')).join('')}`);
    };
    const setHsl = (key: 'h' | 's' | 'l', next: number) =>
      setColor(hsvToHex(hslToHsv({ ...hsl, [key]: key === 'h' ? next : next / 100 })));
    return (
      <div className="flex flex-col gap-3">
        <ColorPicker
          {...args}
          value={color}
          onValueChange={(next) => {
            setColor(next);
            args.onValueChange?.(next);
          }}
        />
        <fieldset className="flex gap-2">
          <legend className="text-caption-1 text-muted-foreground">RGB</legend>
          {['Red', 'Green', 'Blue'].map((label, index) => (
            <SpinButton
              key={label}
              aria-label={label}
              min={0}
              max={255}
              value={rgb[index]}
              onValueChange={(next) => setRgb(index, next)}
            />
          ))}
        </fieldset>
        <fieldset className="flex gap-2">
          <legend className="text-caption-1 text-muted-foreground">HSL</legend>
          <SpinButton
            aria-label="Hue"
            min={0}
            max={360}
            value={Math.round(hsl.h)}
            onValueChange={(next) => setHsl('h', next)}
          />
          <SpinButton
            aria-label="Saturation"
            min={0}
            max={100}
            value={Math.round(hsl.s * 100)}
            onValueChange={(next) => setHsl('s', next)}
          />
          <SpinButton
            aria-label="Lightness"
            min={0}
            max={100}
            value={Math.round(hsl.l * 100)}
            onValueChange={(next) => setHsl('l', next)}
          />
        </fieldset>
      </div>
    );
  },
};

/** A picker in a Popover with Apply and Cancel: the draft color applies only on Apply. */
export const InPopover: Story = {
  render: function InPopoverStory(args) {
    const [color, setColor] = useState('#0f6cbd'); // wave-allow-color: fixture
    const [draft, setDraft] = useState(color);
    const [open, setOpen] = useState(false);
    return (
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setDraft(color);
        }}
      >
        <Popover.Trigger>
          <Button
            icon={
              <span
                aria-hidden="true"
                className="inline-block size-4 rounded border border-border"
                style={{ backgroundColor: color }}
              />
            }
          >
            Accent color
          </Button>
        </Popover.Trigger>
        <Popover.Content title="Accent color">
          <div className="flex flex-col gap-3">
            <ColorPicker
              {...args}
              value={draft}
              onValueChange={(next) => {
                setDraft(next);
                args.onValueChange?.(next);
              }}
            />
            <div className="flex justify-end gap-2">
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                appearance="primary"
                onClick={() => {
                  setColor(draft);
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </Popover.Content>
      </Popover>
    );
  },
};

/** `shape="square"`: the preview, the area and the rails lose their corner radius. */
export const Square: Story = {
  args: { shape: 'square', showOpacity: true },
};
