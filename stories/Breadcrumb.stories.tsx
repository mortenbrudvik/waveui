import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Breadcrumb } from '../src';

const meta = {
  title: 'Components/Navigation/Breadcrumb',
  component: Breadcrumb,
  args: {
    children: [
      <Breadcrumb.Item key="home" href="#">
        Home
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="products" href="#">
        Products
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="details" current>
        Details
      </Breadcrumb.Item>,
    ],
  },
} satisfies Meta<typeof Breadcrumb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Icons are decorative (`aria-hidden`), so they are not part of the link names. */
export const WithIcons: Story = {
  args: {
    children: [
      <Breadcrumb.Item key="home" href="#" icon={{ children: '🏠' }}>
        Home
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="documents" href="#" icon={{ children: '📁' }}>
        Documents
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="report" current icon={{ children: '📄' }}>
        Report.pdf
      </Breadcrumb.Item>,
    ],
  },
};

export const CurrentItem: Story = {
  args: {
    children: [
      <Breadcrumb.Item key="dashboard" href="#">
        Dashboard
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="settings" href="#">
        Settings
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="account" href="#">
        Account
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="profile" current>
        Profile
      </Breadcrumb.Item>,
    ],
  },
};

/** Items without `href` but with `onClick` render as buttons (in-app navigation without URLs). */
export const WithButtons: Story = {
  args: {
    children: [
      <Breadcrumb.Item key="home" onClick={fn()}>
        Home
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="library" onClick={fn()}>
        Library
      </Breadcrumb.Item>,
      <Breadcrumb.Item key="album" current>
        Album
      </Breadcrumb.Item>,
    ],
  },
};
