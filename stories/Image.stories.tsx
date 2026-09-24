import type { Meta, StoryObj } from '@storybook/react';
import { Image } from '../src';

// Placeholder image data, not UI colors: an SVG data URI cannot read the theme variables, so the
// neutral fills are literal. `#` is written literally and encoded exactly once below.
// wave-allow-color: fixture
const PLACEHOLDER_FILL = '#e0e0e0';
// wave-allow-color: fixture
const PLACEHOLDER_TEXT = '#424242';

/** Self-contained SVG data URI placeholder (no external dependency). */
const placeholder = (w: number, h: number, label = `${w}x${h}`) =>
  `data:image/svg+xml,${encodeURIComponent(
    // wave-allow-color: fixture (placeholder image paint, see PLACEHOLDER_FILL)
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect fill="${PLACEHOLDER_FILL}" width="${w}" height="${h}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="${PLACEHOLDER_TEXT}" font-family="sans-serif" font-size="14">${label}</text></svg>`,
  )}`;

const meta = {
  title: 'Components/Data Display/Image',
  component: Image,
  argTypes: {
    fit: {
      control: 'select',
      options: ['none', 'center', 'contain', 'cover', 'default'],
    },
    shape: {
      control: 'select',
      options: ['circular', 'rounded', 'square'],
    },
    shadow: { control: 'boolean' },
    block: { control: 'boolean' },
    bordered: { control: 'boolean' },
  },
  args: {
    src: placeholder(200, 200),
    alt: 'Placeholder image',
    width: 200,
    height: 200,
  },
} satisfies Meta<typeof Image>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    src: placeholder(200, 200),
    alt: 'Placeholder image',
    width: 200,
    height: 200,
  },
};

export const Circular: Story = {
  args: {
    src: placeholder(150, 150),
    alt: 'Circular image',
    shape: 'circular',
    width: 150,
    height: 150,
  },
};

export const Rounded: Story = {
  args: {
    alt: 'Rounded image',
    shape: 'rounded',
  },
};

export const WithShadow: Story = {
  args: {
    alt: 'Image with shadow',
    shadow: true,
  },
};

export const Bordered: Story = {
  args: {
    alt: 'Image with border',
    bordered: true,
  },
};

/** An image that only decorates adjacent content takes `alt=""`. */
export const Decorative: Story = {
  args: {
    alt: '',
  },
};

export const Block: Story = {
  args: {
    src: placeholder(600, 200),
    alt: 'Block image',
    block: true,
    width: undefined,
    height: undefined,
  },
};

export const FitModes: Story = {
  args: {
    src: placeholder(200, 100),
    width: 100,
    height: 100,
  },
  render: (args) => (
    <div className="flex gap-4">
      {(['none', 'center', 'contain', 'cover', 'default'] as const).map((fit) => (
        <figure key={fit} className="m-0 flex flex-col items-center gap-1">
          <div className="size-[100px] border border-border">
            <Image {...args} alt={`Fit ${fit}`} fit={fit} />
          </div>
          <figcaption className="text-caption-1 text-foreground">{fit}</figcaption>
        </figure>
      ))}
    </div>
  ),
};
