import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Accordion } from '../src';
import { motionCases } from './_motion';

const faqItems = (
  <>
    <Accordion.Item value="item-1">
      <Accordion.Trigger>What is Wave UI?</Accordion.Trigger>
      <Accordion.Panel>
        Wave UI is a collection of React components for creating cross-platform apps.
      </Accordion.Panel>
    </Accordion.Item>
    <Accordion.Item value="item-2">
      <Accordion.Trigger>Is it accessible?</Accordion.Trigger>
      <Accordion.Panel>
        Yes. It follows WAI-ARIA patterns for accessible components.
      </Accordion.Panel>
    </Accordion.Item>
    <Accordion.Item value="item-3">
      <Accordion.Trigger>Can I customize it?</Accordion.Trigger>
      <Accordion.Panel>
        Absolutely. Components accept className and style overrides.
      </Accordion.Panel>
    </Accordion.Item>
  </>
);

const meta = {
  title: 'Components/Layout/Accordion',
  component: Accordion,
  args: {
    style: { width: 400 },
  },
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Single mode (default): opening an item closes the open one. */
export const Default: Story = {
  args: {
    onOpenItemChange: fn(),
  },
  render: (args) => <Accordion {...args}>{faqItems}</Accordion>,
};

/** `type="multiple"`: any number of items can be open. */
export const Multiple: Story = {
  args: {
    type: 'multiple',
    onOpenItemsChange: fn(),
  },
  render: (args) => <Accordion {...args}>{faqItems}</Accordion>,
};

/** Controlled single mode: `openItem` + `onOpenItemChange` (`null` closes every item). */
export const Controlled: Story = {
  args: {
    onOpenItemChange: fn(),
  },
  render: function ControlledAccordion(args) {
    // A single Accordion: the props of type="multiple" stay out.
    const { openItems, defaultOpenItems, onOpenItemsChange, ...singleArgs } = args;
    const [openItem, setOpenItem] = React.useState<string | null>('item-1');
    return (
      <Accordion
        {...singleArgs}
        type="single"
        openItem={openItem}
        onOpenItemChange={(next) => {
          setOpenItem(next as string | null);
          args.onOpenItemChange?.(next);
        }}
      >
        {faqItems}
      </Accordion>
    );
  },
};

/** `defaultOpenItem` opens an item on load (uncontrolled). */
export const DefaultOpen: Story = {
  args: {
    defaultOpenItem: 'item-2',
  },
  render: (args) => <Accordion {...args}>{faqItems}</Accordion>,
};

/** `headingLevel` sets the heading element that wraps every trigger (default `<h3>`). */
export const HeadingLevel: Story = {
  args: {
    headingLevel: 2,
  },
  render: (args) => <Accordion {...args}>{faqItems}</Accordion>,
};

/** The Motion story's collapse: 400ms with the mid decelerating curve, without the fade. */
const slowCollapse =
  'transition-[grid-template-rows] duration-wave-slower ease-wave-decelerate-mid motion-reduce:transition-none data-[presence=entering]:starting:grid-rows-[minmax(0,0fr)] data-[presence=exiting]:grid-rows-[minmax(0,0fr)]';

/**
 * `Accordion.Panel motion`, on the element around the region (`wave-accordion-panel__collapse`).
 * By default the space a panel takes opens from nothing and closes back to it while it fades, over
 * 200ms both ways; the region keeps its width and its line breaks. Focus inside a panel that
 * closes moves to its trigger. `null` turns it off; a class string replaces it (here a slower
 * collapse without the fade). Under reduced motion every panel opens and closes at once.
 */
export const Motion: Story = {
  args: {
    onOpenItemChange: fn(),
  },
  render: (args) => (
    <div className="flex flex-col gap-6">
      {motionCases(slowCollapse).map(({ label, motion }) => (
        <div key={label}>
          <h2 className="mb-2 text-wave-subtitle-2">{label}</h2>
          {/* The story renders one accordion per case; every other arg is forwarded. */}
          <Accordion {...args}>
            <Accordion.Item value="item-1">
              <Accordion.Trigger>What is Wave UI?</Accordion.Trigger>
              <Accordion.Panel motion={motion}>
                Wave UI is a collection of React components for creating cross-platform apps.
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="item-2">
              <Accordion.Trigger>Is it accessible?</Accordion.Trigger>
              <Accordion.Panel motion={motion}>
                Yes. It follows WAI-ARIA patterns for accessible components.
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </div>
      ))}
    </div>
  ),
};

/** A disabled trigger cannot be toggled. */
export const WithDisabledItem: Story = {
  render: (args) => (
    <Accordion {...args}>
      <Accordion.Item value="item-1">
        <Accordion.Trigger>Available section</Accordion.Trigger>
        <Accordion.Panel>This section can be opened.</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="item-2">
        <Accordion.Trigger disabled>Unavailable section</Accordion.Trigger>
        <Accordion.Panel>This section is disabled.</Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  ),
};

/** `collapsible={false}`: the open item cannot be closed, only replaced by opening another. */
export const NotCollapsible: Story = {
  args: {
    collapsible: false,
    defaultOpenItem: 'item-1',
    onOpenItemChange: fn(),
  },
  render: (args) => <Accordion {...args}>{faqItems}</Accordion>,
};

/** `size` on the Accordion sets every trigger; a Trigger's own `size` overrides it. */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6" style={{ width: 400 }}>
      {(['small', 'medium', 'large', 'extra-large'] as const).map((size) => (
        <Accordion key={size} style={{ width: 400 }} size={size} defaultOpenItem="item-1">
          <Accordion.Item value="item-1">
            <Accordion.Trigger>Size {size}</Accordion.Trigger>
            <Accordion.Panel>A trigger of size {size}.</Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      ))}
    </div>
  ),
};

const PlusMinus = ({ open }: { open: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path
      d={open ? 'M3 7.25h10v1.5H3z' : 'M7.25 3h1.5v4.25H13v1.5H8.75V13h-1.5V8.75H3v-1.5h4.25z'}
    />
  </svg>
);

/**
 * `expandIconPosition="start"` puts the chevron before the content; a custom `expandIcon` replaces
 * it (it does not turn: it follows the trigger's `aria-expanded`), and `icon` adds a leading icon.
 */
export const ExpandIconAndLeadingIcon: Story = {
  render: () => (
    <div className="flex flex-col gap-6" style={{ width: 400 }}>
      <Accordion expandIconPosition="start" defaultOpenItem="item-1">
        {faqItems}
      </Accordion>
      <Accordion defaultOpenItem="item-1">
        <Accordion.Item value="item-1">
          <Accordion.Trigger icon="★" expandIcon={<PlusMinus open={false} />}>
            Custom expand icon and a leading icon
          </Accordion.Trigger>
          <Accordion.Panel>The leading icon sits before the label.</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="item-2">
          <Accordion.Trigger expandIcon={<PlusMinus open />}>Another custom icon</Accordion.Trigger>
          <Accordion.Panel>Panel content.</Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </div>
  ),
};

/** `inline` lets the trigger button take the width of its content instead of the whole row. */
export const InlineHeader: Story = {
  render: () => (
    <Accordion style={{ width: 400 }}>
      <Accordion.Item value="item-1">
        <Accordion.Trigger inline expandIconPosition="start">
          Inline trigger
        </Accordion.Trigger>
        <Accordion.Panel>The trigger is as wide as its content.</Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  ),
};

/** Item values can be numbers; `onOpenItemChange` gets the toggle details as its second argument. */
export const NumberValues: Story = {
  render: function NumberValuesAccordion() {
    const [last, setLast] = React.useState('nothing yet');
    return (
      <div className="flex flex-col gap-3" style={{ width: 400 }}>
        <Accordion<number>
          onOpenItemChange={(openItem, details) =>
            setLast(`${details?.value} ${details?.open ? 'opened' : 'closed'} (open: ${openItem})`)
          }
        >
          {[1, 2, 3].map((n) => (
            <Accordion.Item key={n} value={n}>
              <Accordion.Trigger>Section {n}</Accordion.Trigger>
              <Accordion.Panel>Content of section {n}.</Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
        <p className="text-wave-body-1">Last change: {last}</p>
      </div>
    );
  },
};
