import type { Meta, StoryObj } from '@storybook/react';
import { Image } from '../src';

const meta = {
  title: 'Data Display/Image',
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
} satisfies Meta<typeof Image>;

export default meta;
type Story = StoryObj<typeof meta>;

// Self-contained data URI placeholder (no external dependency)
const placeholder = (w: number, h: number, label = `${w}x${h}`) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect fill="%23e0e0e0" width="${w}" height="${h}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23666" font-family="sans-serif" font-size="14">${label}</text></svg>`)}`;

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
    src: placeholder(200, 200),
    alt: 'Rounded image',
    shape: 'rounded',
    width: 200,
    height: 200,
  },
};

export const WithShadow: Story = {
  args: {
    src: placeholder(200, 200),
    alt: 'Image with shadow',
    shadow: true,
    width: 200,
    height: 200,
  },
};

export const Block: Story = {
  args: {
    src: placeholder(600, 200),
    alt: 'Block image',
    block: true,
  },
};

export const FitModes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      {(['none', 'center', 'contain', 'cover', 'default'] as const).map((fit) => (
        <div key={fit} style={{ width: 100, height: 100, border: '1px solid #e0e0e0' }}>
          <Image src={placeholder(200, 100)} alt={fit} fit={fit} width={100} height={100} />
          <div style={{ textAlign: 'center', fontSize: 12 }}>{fit}</div>
        </div>
      ))}
    </div>
  ),
};
