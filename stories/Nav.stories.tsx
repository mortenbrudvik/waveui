import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Nav } from '../src';

const meta = {
  title: 'Navigation/Nav',
  component: Nav,
} satisfies Meta<typeof Nav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Nav {...args} defaultSelectedValue="home" style={{ height: 400 }}>
      <Nav.Item value="home">Home</Nav.Item>
      <Nav.Item value="dashboard">Dashboard</Nav.Item>
      <Nav.Item value="messages">Messages</Nav.Item>
      <Nav.Category value="settings">
        Settings
        <Nav.SubItem value="profile">Profile</Nav.SubItem>
        <Nav.SubItem value="account">Account</Nav.SubItem>
        <Nav.SubItem value="privacy">Privacy</Nav.SubItem>
      </Nav.Category>
      <Nav.Category value="docs">
        Documentation
        <Nav.SubItem value="getting-started">Getting Started</Nav.SubItem>
        <Nav.SubItem value="api">API Reference</Nav.SubItem>
      </Nav.Category>
    </Nav>
  ),
};

export const Controlled: Story = {
  render: () => {
    const [selected, setSelected] = React.useState('home');
    return (
      <div style={{ display: 'flex', gap: 16 }}>
        <Nav selectedValue={selected} onNavItemSelect={setSelected} style={{ height: 400 }}>
          <Nav.Item value="home">Home</Nav.Item>
          <Nav.Item value="inbox">Inbox</Nav.Item>
          <Nav.Item value="calendar">Calendar</Nav.Item>
          <Nav.Category value="more">
            More
            <Nav.SubItem value="tasks">Tasks</Nav.SubItem>
            <Nav.SubItem value="notes">Notes</Nav.SubItem>
          </Nav.Category>
        </Nav>
        <div style={{ padding: 16 }}>
          <p>
            Selected: <strong>{selected}</strong>
          </p>
        </div>
      </div>
    );
  },
};
