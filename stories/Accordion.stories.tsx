import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Accordion } from '../src';

const meta = {
  title: 'Layout/Accordion',
  component: Accordion,
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Accordion {...args} style={{ width: 400 }}>
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
    </Accordion>
  ),
};

export const Multiple: Story = {
  args: {
    type: 'multiple',
  },
  render: (args) => (
    <Accordion {...args} style={{ width: 400 }}>
      <Accordion.Item value="item-1">
        <Accordion.Trigger>Section A</Accordion.Trigger>
        <Accordion.Panel>Content for section A.</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="item-2">
        <Accordion.Trigger>Section B</Accordion.Trigger>
        <Accordion.Panel>Content for section B.</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="item-3">
        <Accordion.Trigger>Section C</Accordion.Trigger>
        <Accordion.Panel>Content for section C.</Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  ),
};

export const Controlled: Story = {
  render: () => {
    const [openItems, setOpenItems] = React.useState<string[]>(['item-1']);
    return (
      <Accordion openItems={openItems} onOpenItemsChange={setOpenItems} style={{ width: 400 }}>
        <Accordion.Item value="item-1">
          <Accordion.Trigger>Controlled A</Accordion.Trigger>
          <Accordion.Panel>Panel A content.</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="item-2">
          <Accordion.Trigger>Controlled B</Accordion.Trigger>
          <Accordion.Panel>Panel B content.</Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    );
  },
};

export const DefaultOpen: Story = {
  args: {
    defaultOpenItems: ['item-2'],
  },
  render: (args) => (
    <Accordion {...args} style={{ width: 400 }}>
      <Accordion.Item value="item-1">
        <Accordion.Trigger>First</Accordion.Trigger>
        <Accordion.Panel>First panel content.</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="item-2">
        <Accordion.Trigger>Second (open by default)</Accordion.Trigger>
        <Accordion.Panel>Second panel content is visible on load.</Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  ),
};
