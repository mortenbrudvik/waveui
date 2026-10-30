import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import {
  WaveProvider,
  Button,
  Badge,
  Combobox,
  Dialog,
  Field,
  Input,
  Link,
  List,
  ProgressBar,
  SpinButton,
  Switch,
} from '../src';
import type { WaveTokenOverrides } from '../src';

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

/**
 * `inputDefaults` sets the `size` and `appearance` of every text-entry control below the provider
 * (Input, Combobox, SpinButton, …) that does not set its own. A nested provider overrides only the
 * keys it defines: the last field is still small, but underlined.
 */
export const InputDefaults: Story = {
  args: { inputDefaults: { size: 'small', appearance: 'filled-darker' } },
  render: (args) => (
    <WaveProvider {...args}>
      <div className="flex flex-col gap-4 p-6">
        <Field label="Name">
          <Input placeholder="Type something..." />
        </Field>
        <Field label="Fruit">
          <Combobox placeholder="Pick a fruit">
            <Combobox.Option value="apple">Apple</Combobox.Option>
            <Combobox.Option value="banana">Banana</Combobox.Option>
          </Combobox>
        </Field>
        <Field label="Quantity">
          <SpinButton defaultValue={1} />
        </Field>
        <WaveProvider inputDefaults={{ appearance: 'underline' }}>
          <Field label="Underlined name (nested provider)">
            <Input placeholder="Type something..." />
          </Field>
        </WaveProvider>
      </div>
    </WaveProvider>
  ),
};

/**
 * A violet ramp written as literal fixtures: the output of `createBrandTokens('#7c4dc2')`, so every
 * pair the themes read from it passes the contrast check a full ramp gets in development. The
 * light theme draws its accent from stops 40, 60 to 80 and 140 to 160, the dark theme from 10, 20,
 * 40 and 90 to 120, so a whole ramp re-brands both.
 */
const violetRamp = {
  brand10: '#151328', // wave-allow-color: fixture
  brand20: '#231c3e', // wave-allow-color: fixture
  brand30: '#312451', // wave-allow-color: fixture
  brand40: '#3d2f67', // wave-allow-color: fixture
  brand50: '#4f377d', // wave-allow-color: fixture
  brand60: '#5e4195', // wave-allow-color: fixture
  brand70: '#6e47ab', // wave-allow-color: fixture
  brand80: '#8150c6', // wave-allow-color: fixture
  brand90: '#9a69e8', // wave-allow-color: fixture
  brand100: '#ae83fe', // wave-allow-color: fixture
  brand110: '#b694ff', // wave-allow-color: fixture
  brand120: '#bda4fe', // wave-allow-color: fixture
  brand130: '#ceb6ff', // wave-allow-color: fixture
  brand140: '#d9cbff', // wave-allow-color: fixture
  brand150: '#e6ddfe', // wave-allow-color: fixture
  brand160: '#f5f0fd', // wave-allow-color: fixture
} satisfies WaveTokenOverrides;

/** A crimson accent for the nested provider: the semantic `primary` colours of the light theme. */
const crimsonAccent = {
  primary: '#c4314b', // wave-allow-color: fixture
  primaryHover: '#a9283f', // wave-allow-color: fixture
  primaryPressed: '#7a1c2d', // wave-allow-color: fixture
} satisfies WaveTokenOverrides;

/** Callback spies of the sample content, shown in the Actions panel. */
const onCheckedChange = fn();
const onSelectionChange = fn();
const onOpenChange = fn();

/** Controls that draw on the brand ramp: the accent button, link, switch, progress and selection. */
function BrandSample() {
  return (
    <div className="flex w-96 flex-col gap-4 p-6">
      <div className="flex items-center gap-4">
        <Button appearance="primary">Primary</Button>
        <Link href="#brand-colour">A link</Link>
        <Switch label="Switch" defaultChecked onCheckedChange={onCheckedChange} />
      </div>
      <ProgressBar label="Uploading files" value={60} showLabel />
      <List
        selectable
        defaultSelectedItems={['b']}
        aria-label="Files"
        onSelectionChange={onSelectionChange}
      >
        <List.Item value="a">Quarterly report</List.Item>
        <List.Item value="b">Budget (selected)</List.Item>
        <List.Item value="c">Roadmap</List.Item>
      </List>
    </div>
  );
}

/**
 * `tokens` replaces design tokens in the subtree. Here the brand ramp is a violet one (literal
 * fixtures): Button, Link, Switch, ProgressBar and the selected row all follow it, in the light
 * theme and in the dark one (switch the story's theme control), because the semantic colours are
 * built on the ramp. Every key is the token's camelCase name without `--wave-`.
 */
export const BrandColour: Story = {
  name: 'Brand colour',
  args: { tokens: violetRamp },
  render: ({ children: _children, ...args }) => (
    <WaveProvider {...args}>
      <BrandSample />
    </WaveProvider>
  ),
};

/** The page of the two accent stories: a dialog of the outer provider and one of a nested provider. */
function AccentDialogs() {
  return (
    <div className="flex min-h-[420px] flex-col gap-4 p-6">
      <div className="flex items-center gap-4">
        <Dialog defaultOpen modalType="non-modal" onOpenChange={onOpenChange}>
          <Dialog.Trigger>
            <Button appearance="primary">Outer dialog</Button>
          </Dialog.Trigger>
          <Dialog.Content
            title="Outer provider"
            // Pushed to the end of the viewport so that it sits beside the nested provider's dialog.
            className="ms-auto me-4 max-w-xs"
          >
            <p>This dialog is portaled out of the outer provider, with the page&apos;s accent.</p>
            <Dialog.Footer>
              <Dialog.Close>
                <Button appearance="primary">Confirm</Button>
              </Dialog.Close>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>
        <WaveProvider
          theme="light"
          tokens={crimsonAccent}
          className="rounded-md border border-border p-4"
        >
          <Dialog defaultOpen modalType="non-modal" onOpenChange={onOpenChange}>
            <Dialog.Trigger>
              <Button appearance="primary">Nested dialog</Button>
            </Dialog.Trigger>
            <Dialog.Content title="Nested provider" className="me-auto ms-4 max-w-xs">
              <p>This dialog is portaled out of the nested provider, with its crimson accent.</p>
              <Dialog.Footer>
                <Dialog.Close>
                  <Button appearance="primary">Confirm</Button>
                </Dialog.Close>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog>
        </WaveProvider>
      </div>
    </div>
  );
}

const accentStoryParameters = {
  docs: { story: { inline: false, iframeHeight: 480 } },
};

/**
 * Two dialogs, one in the outer provider and one in a nested provider with a crimson `primary`.
 * The nested provider also sets `theme="light"`, the theme its crimson was chosen for, so the
 * accent keeps its contrast whatever the story's theme. Its overrides also reach its portal: the
 * dialog opened from it (open by default) shows the crimson accent, while the dialog of the outer
 * provider shows the page's own. Both are non-modal so that they can be open side by side and the
 * page stays usable.
 */
export const NestedAccentWithADialog: Story = {
  name: 'Nested accent with a dialog',
  parameters: accentStoryParameters,
  render: ({ children: _children, ...args }) => (
    <WaveProvider {...args}>
      <AccentDialogs />
    </WaveProvider>
  ),
};

/**
 * The same layout with `applyStylesToPortals={false}` on the outer provider (the nested one
 * inherits it). The nested provider's trigger button, in the page, keeps the crimson accent, but
 * the portaled dialogs keep only the theme: the nested provider's dialog is back to the light
 * theme's own blue.
 */
export const PortalsWithoutStyles: Story = {
  name: 'Portals without styles',
  args: { applyStylesToPortals: false },
  parameters: accentStoryParameters,
  render: ({ children: _children, ...args }) => (
    <WaveProvider {...args}>
      <AccentDialogs />
    </WaveProvider>
  ),
};
