import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Accordion } from '../src';

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
    const [openItem, setOpenItem] = React.useState<string | null>('item-1');
    return (
      <Accordion
        {...args}
        type="single"
        openItem={openItem}
        onOpenItemChange={(next) => {
          setOpenItem(next);
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
