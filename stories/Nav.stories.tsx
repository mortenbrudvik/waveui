import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Nav } from '../src';

const meta = {
  title: 'Components/Navigation/Nav',
  component: Nav,
  args: {
    defaultValue: 'home',
    onValueChange: fn(),
    onOpenCategoriesChange: fn(),
    style: { height: 400 },
    children: (
      <>
        <Nav.Item value="home">Home</Nav.Item>
        <Nav.Item value="dashboard">Dashboard</Nav.Item>
        <Nav.Item value="messages">Messages</Nav.Item>
        <Nav.Category value="settings" label="Settings">
          <Nav.SubItem value="profile">Profile</Nav.SubItem>
          <Nav.SubItem value="account">Account</Nav.SubItem>
          <Nav.SubItem value="privacy">Privacy</Nav.SubItem>
        </Nav.Category>
        <Nav.Category value="docs" label="Documentation">
          <Nav.SubItem value="getting-started">Getting Started</Nav.SubItem>
          <Nav.SubItem value="api">API Reference</Nav.SubItem>
        </Nav.Category>
      </>
    ),
  },
} satisfies Meta<typeof Nav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The category containing the selected item starts open. */
export const SelectedSubItem: Story = {
  args: {
    defaultValue: 'api',
  },
};

/** Items with `href` render as links; `aria-current="page"` marks the selected one. */
export const WithLinks: Story = {
  args: {
    children: (
      <>
        <Nav.Item value="home" href="#home">
          Home
        </Nav.Item>
        <Nav.Item value="reports" href="#reports">
          Reports
        </Nav.Item>
        <Nav.Category value="help" label="Help">
          <Nav.SubItem value="faq" href="#faq">
            FAQ
          </Nav.SubItem>
          <Nav.SubItem value="contact" href="#contact">
            Contact
          </Nav.SubItem>
        </Nav.Category>
      </>
    ),
  },
};

/** Disabled items (a button and a link) cannot be selected. */
export const Disabled: Story = {
  args: {
    children: (
      <>
        <Nav.Item value="home">Home</Nav.Item>
        <Nav.Item value="billing" disabled>
          Billing
        </Nav.Item>
        <Nav.Item value="admin" href="#admin" disabled>
          Admin
        </Nav.Item>
      </>
    ),
  },
};

/** Controlled selection: the parent keeps `value` and updates it from `onValueChange`. */
export const Controlled: Story = {
  render: function ControlledNav({ defaultValue, onValueChange, ...args }) {
    const [value, setValue] = React.useState(defaultValue ?? 'home');
    const handleValueChange = (next: string) => {
      setValue(next);
      onValueChange?.(next);
    };
    return (
      <div style={{ display: 'flex', gap: 16 }}>
        <Nav value={value} onValueChange={handleValueChange} {...args}>
          <Nav.Item value="home">Home</Nav.Item>
          <Nav.Item value="inbox">Inbox</Nav.Item>
          <Nav.Item value="calendar">Calendar</Nav.Item>
          <Nav.Category value="more" label="More">
            <Nav.SubItem value="tasks">Tasks</Nav.SubItem>
            <Nav.SubItem value="notes">Notes</Nav.SubItem>
          </Nav.Category>
        </Nav>
        <div style={{ padding: 16 }}>
          <p>
            Selected: <strong>{value}</strong>
          </p>
        </div>
      </div>
    );
  },
};
