import type { Meta, StoryObj } from '@storybook/react';
import { WaveProvider, Button, Badge, Input } from '../src';

/** Sample content that relies on the provider for its colours, font and direction. */
function SampleContent({ title = 'Theme preview' }: { title?: string }) {
  return (
    <div className="flex flex-col gap-4 p-6">
      <h3 className="text-subtitle-1 font-semibold">{title}</h3>
      <p className="text-muted-foreground">
        Text, background and font come from WaveProvider; no inline colours are needed.
      </p>
      <div className="flex gap-2">
        <Button appearance="primary">Primary</Button>
        <Button appearance="outline">Outline</Button>
        <Button appearance="subtle">Subtle</Button>
      </div>
      <Input aria-label={`${title} input`} placeholder="Type something..." />
      <div className="flex gap-2">
        <Badge color="brand">Brand</Badge>
        <Badge color="success">Success</Badge>
        <Badge color="danger">Danger</Badge>
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/Provider/WaveProvider',
  component: WaveProvider,
  parameters: {
    docs: {
      description: {
        component:
          'Applies a Wave theme and text direction to a subtree: the root paints the themed background, text colour and font, and portaled overlays inherit the theme. Providers can be nested in either order; a nested provider inherits every prop it omits (theme, direction, portal container) from the enclosing one.',
      },
    },
  },
  args: {
    theme: 'light',
    dir: 'ltr',
    children: <SampleContent />,
  },
  argTypes: {
    theme: { control: 'inline-radio', options: ['light', 'dark', 'high-contrast'] },
    dir: { control: 'inline-radio', options: ['ltr', 'rtl'] },
    children: { control: false },
  },
} satisfies Meta<typeof WaveProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LightTheme: Story = {};

export const DarkTheme: Story = {
  args: { theme: 'dark' },
};

export const HighContrast: Story = {
  args: { theme: 'high-contrast' },
};

export const RTL: Story = {
  args: { dir: 'rtl', children: <SampleContent title="Right-to-left layout" /> },
};

/** A dark panel inside a light app: the nested root re-declares the dark tokens. */
export const DarkInsideLight: Story = {
  render: (args) => (
    <WaveProvider {...args}>
      <SampleContent title="Light application" />
      <WaveProvider theme="dark" className="m-6 rounded-md border border-border">
        <SampleContent title="Dark panel" />
      </WaveProvider>
    </WaveProvider>
  ),
};

/**
 * A light panel inside a dark right-to-left app. The nested provider only sets `theme`, so it
 * inherits `dir="rtl"` (and the portal container) from the enclosing provider.
 */
export const NestedInheritsDirection: Story = {
  args: { theme: 'dark', dir: 'rtl' },
  render: (args) => (
    <WaveProvider {...args}>
      <SampleContent title="Dark right-to-left application" />
      <WaveProvider theme="light" className="m-6 rounded-md border border-border">
        <SampleContent title="Light panel, still right-to-left" />
      </WaveProvider>
    </WaveProvider>
  ),
};

/** A light preview inside a dark app: `wave-light` resets the tokens for the subtree. */
export const LightInsideDark: Story = {
  args: { theme: 'dark' },
  render: (args) => (
    <WaveProvider {...args}>
      <SampleContent title="Dark application" />
      <WaveProvider theme="light" className="m-6 rounded-md border border-border">
        <SampleContent title="Light preview" />
      </WaveProvider>
    </WaveProvider>
  ),
};
