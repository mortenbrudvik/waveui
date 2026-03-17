import type { Meta, StoryObj } from '@storybook/react';
import { WaveProvider, Button, Badge, Input } from '../src';

const meta = {
  title: 'Components/Provider/WaveProvider',
  component: WaveProvider,
} satisfies Meta<typeof WaveProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

const SampleContent = () => (
  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <h3 style={{ margin: 0 }}>Theme Preview</h3>
    <p>This content demonstrates theming applied by WaveProvider.</p>
    <div style={{ display: 'flex', gap: 8 }}>
      <Button appearance="primary">Primary</Button>
      <Button appearance="outline">Outline</Button>
      <Button appearance="subtle">Subtle</Button>
    </div>
    <Input placeholder="Type something..." />
    <div style={{ display: 'flex', gap: 8 }}>
      <Badge color="brand">Brand</Badge>
      <Badge color="success">Success</Badge>
      <Badge color="danger">Danger</Badge>
    </div>
  </div>
);

export const LightTheme: Story = {
  render: () => (
    <WaveProvider theme="light">
      <SampleContent />
    </WaveProvider>
  ),
};

export const DarkTheme: Story = {
  render: () => (
    <WaveProvider theme="dark" style={{ background: '#292929' }}>
      <SampleContent />
    </WaveProvider>
  ),
};

export const HighContrast: Story = {
  render: () => (
    <WaveProvider theme="high-contrast" style={{ background: '#000000' }}>
      <SampleContent />
    </WaveProvider>
  ),
};

export const RTL: Story = {
  render: () => (
    <WaveProvider dir="rtl">
      <SampleContent />
    </WaveProvider>
  ),
};
