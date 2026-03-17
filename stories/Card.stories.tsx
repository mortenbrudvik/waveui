import type { Meta, StoryObj } from '@storybook/react';
import { Card } from '../src';

const meta = {
  title: 'Layout/Card',
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Card {...args} style={{ width: 360 }}>
      <Card.Header title="Card Title" />
      <Card.Body>
        <p>This is the card body content.</p>
      </Card.Body>
    </Card>
  ),
};

export const WithHeaderSubtitle: Story = {
  render: () => (
    <Card style={{ width: 360 }}>
      <Card.Header title="Project Status" subtitle="Last updated 2 hours ago" />
      <Card.Body>
        <p>All tasks are on track for the upcoming release.</p>
      </Card.Body>
    </Card>
  ),
};

export const Selected: Story = {
  render: () => (
    <Card selected style={{ width: 360 }}>
      <Card.Header title="Selected Card" />
      <Card.Body>
        <p>This card is in a selected state.</p>
      </Card.Body>
    </Card>
  ),
};

export const Clickable: Story = {
  render: () => (
    <Card onSelect={() => alert('Card clicked!')} style={{ width: 360 }}>
      <Card.Header title="Clickable Card" subtitle="Click me" />
      <Card.Body>
        <p>This card has an onSelect handler.</p>
      </Card.Body>
    </Card>
  ),
};

export const FullComposition: Story = {
  render: () => (
    <Card style={{ width: 360 }}>
      <Card.Header title="Full Card" subtitle="With all sections" />
      <Card.Body>
        <p>Body content with details about this card item.</p>
      </Card.Body>
      <Card.Footer>
        <button type="button" style={{ padding: '6px 16px', borderRadius: 4, border: '1px solid #d1d1d1' }}>
          Cancel
        </button>
        <button type="button" style={{ padding: '6px 16px', borderRadius: 4, background: '#0f6cbd', color: '#fff', border: 'none' }}>
          Confirm
        </button>
      </Card.Footer>
    </Card>
  ),
};
