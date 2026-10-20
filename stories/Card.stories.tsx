import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Avatar, Button, Card } from '../src';

const meta = {
  title: 'Components/Layout/Card',
  component: Card,
  argTypes: {
    selectionControl: { control: 'inline-radio', options: ['card', 'checkbox'] },
  },
  args: {
    style: { width: 360 },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Card {...args}>
      <Card.Header title="Card Title" />
      <Card.Body>
        <p>This is the card body content.</p>
      </Card.Body>
    </Card>
  ),
};

export const WithHeaderSubtitle: Story = {
  render: (args) => (
    <Card {...args}>
      <Card.Header title="Project Status" subtitle="Last updated 2 hours ago" />
      <Card.Body>
        <p>All tasks are on track for the upcoming release.</p>
      </Card.Body>
    </Card>
  ),
};

/**
 * A selected, selectable card: the selection shows as a check glyph and a 2px primary border, and
 * reaches assistive technology as `aria-pressed="true"`. Selection state is exposed only for
 * selectable cards (`onSelect`); a `selected` card without `onSelect` is a visual state only.
 */
export const Selected: Story = {
  args: {
    onSelect: fn(),
  },
  render: function SelectedCard(args) {
    const [selected, setSelected] = React.useState(true);
    const toggle = () => {
      setSelected((value) => !value);
      args.onSelect?.();
    };
    return (
      <Card selected={selected} {...args} onSelect={toggle}>
        <Card.Header title="Selected Card" />
        <Card.Body>
          <p>This card starts selected. Press Enter or Space to toggle it.</p>
        </Card.Body>
      </Card>
    );
  },
};

/**
 * A selectable card **without** interactive content is itself the control: a `role="button"` tab
 * stop that toggles with a click, Enter or Space and exposes `aria-pressed`. Its content becomes
 * the button's name (headings inside it are flattened), so keep it short; a card whose headings
 * must stay navigable uses `selectionControl="checkbox"`.
 */
export const Clickable: Story = {
  args: {
    onSelect: fn(),
  },
  render: function ClickableCard(args) {
    const [selected, setSelected] = React.useState(false);
    const toggle = () => {
      setSelected((value) => !value);
      args.onSelect?.();
    };
    return (
      <Card selected={selected} {...args} onSelect={toggle}>
        <Card.Header title="Pro plan" subtitle="Press Enter or Space to select" />
        <Card.Body>
          <p>Unlimited projects and priority support.</p>
        </Card.Body>
      </Card>
    );
  },
};

/**
 * A selectable card **with** actions uses `selectionControl="checkbox"`: a built-in checkbox named
 * by the header title carries the selection, and the footer buttons stay separate controls.
 */
export const SelectableWithActions: Story = {
  args: {
    onSelect: fn(),
    selectionControl: 'checkbox',
  },
  render: function SelectableCard(args) {
    const [selected, setSelected] = React.useState(false);
    const toggle = () => {
      setSelected((value) => !value);
      args.onSelect?.();
    };
    return (
      <Card selected={selected} {...args} onSelect={toggle}>
        <Card.Header title="Team plan" subtitle="Click the card or the checkbox" />
        <Card.Body>
          <p>Shared workspaces for up to 20 people.</p>
        </Card.Body>
        <Card.Footer>
          <Button appearance="subtle">Compare plans</Button>
        </Card.Footer>
      </Card>
    );
  },
};

export const FullComposition: Story = {
  render: (args) => (
    <Card {...args}>
      <Card.Header title="Full Card" subtitle="With all sections" />
      <Card.Body>
        <p>Body content with details about this card item.</p>
      </Card.Body>
      <Card.Footer>
        <Button>Cancel</Button>
        <Button appearance="primary">Confirm</Button>
      </Card.Footer>
    </Card>
  ),
};

/** The four looks of a card, and the three sizes (the padding of its parts). */
export const AppearancesAndSizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        {(['filled', 'filled-alternative', 'outline', 'subtle'] as const).map((appearance) => (
          <Card key={appearance} {...args} appearance={appearance}>
            <Card.Header title={appearance} subtitle="appearance" />
            <Card.Body>Body</Card.Body>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {(['small', 'medium', 'large'] as const).map((size) => (
          <Card key={size} {...args} size={size} appearance="outline">
            <Card.Header title={size} subtitle="size" />
            <Card.Body>Body</Card.Body>
          </Card>
        ))}
      </div>
    </div>
  ),
};

/** `orientation="horizontal"` lays the preview out beside the text. */
export const HorizontalWithPreview: Story = {
  args: { style: { width: 480 } },
  render: (args) => (
    <Card {...args} orientation="horizontal" appearance="outline">
      <Card.Preview logo={<span className="text-caption-1">W</span>}>
        <div className="flex h-32 w-40 items-center justify-center bg-muted text-foreground">
          Preview
        </div>
      </Card.Preview>
      <div>
        <Card.Header title="Quarterly report" subtitle="Updated today" />
        <Card.Body>Highlights from the last three months.</Card.Body>
      </div>
    </Card>
  ),
};

/** The header takes an image beside the text and an action at the end. */
export const HeaderWithImageAndAction: Story = {
  render: (args) => (
    <Card {...args} appearance="outline">
      <Card.Header
        title="Design review"
        subtitle="Thursday, 10:00"
        image={<Avatar name="Ada Lovelace" />}
        action={
          <Button appearance="subtle" aria-label="More options">
            …
          </Button>
        }
      />
      <Card.Body>Agenda and notes.</Card.Body>
    </Card>
  ),
};

/** A floating action sits over the top end corner; the checkbox moves to the start corner. */
export const FloatingActionWithCheckbox: Story = {
  args: { onSelect: fn(), selectionControl: 'checkbox' },
  render: function FloatingAction(args) {
    const [selected, setSelected] = React.useState(false);
    return (
      <Card
        {...args}
        selected={selected}
        onSelect={() => setSelected((value) => !value)}
        floatingAction={
          <Button appearance="subtle" aria-label="More options">
            …
          </Button>
        }
        appearance="outline"
      >
        <Card.Header title="Team plan" />
        <Card.Body>Shared workspaces for up to 20 people.</Card.Body>
      </Card>
    );
  },
};
