import type { Meta, StoryObj } from '@storybook/react';
import { Breadcrumb } from '../src';

const meta = {
  title: 'Components/Navigation/Breadcrumb',
  component: Breadcrumb,
} satisfies Meta<typeof Breadcrumb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Breadcrumb>
      <Breadcrumb.Item href="#">Home</Breadcrumb.Item>
      <Breadcrumb.Item href="#">Products</Breadcrumb.Item>
      <Breadcrumb.Item current>Details</Breadcrumb.Item>
    </Breadcrumb>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <Breadcrumb>
      <Breadcrumb.Item href="#" icon={{ children: '\uD83C\uDFE0' }}>
        Home
      </Breadcrumb.Item>
      <Breadcrumb.Item href="#" icon={{ children: '\uD83D\uDCC1' }}>
        Documents
      </Breadcrumb.Item>
      <Breadcrumb.Item current icon={{ children: '\uD83D\uDCC4' }}>
        Report.pdf
      </Breadcrumb.Item>
    </Breadcrumb>
  ),
};

export const CurrentItem: Story = {
  render: () => (
    <Breadcrumb>
      <Breadcrumb.Item href="#">Dashboard</Breadcrumb.Item>
      <Breadcrumb.Item href="#">Settings</Breadcrumb.Item>
      <Breadcrumb.Item href="#">Account</Breadcrumb.Item>
      <Breadcrumb.Item current>Profile</Breadcrumb.Item>
    </Breadcrumb>
  ),
};
