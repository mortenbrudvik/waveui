import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Avatar, Menu, MenuButton, Nav, ToggleButton, Tooltip } from '../src';
import { motionCases } from './_motion';

/** A locally drawn app logo (tokens only: it takes the text colour). */
const AppLogo = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="text-primary">
    <path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 3.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
  </svg>
);

/** A locally drawn pin glyph (tokens only: it takes the text colour). */
const PinGlyph = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path d="M5 2h6l-1 4 2 2v1H8.5v5L8 14.5 7.5 14V9H4V8l2-2z" />
  </svg>
);

/** An item action: a Pin toggle named by its tooltip, and a "More options" menu. */
const ItemActionSet = ({ name }: { name: string }) => (
  <>
    <Tooltip content={`Pin ${name}`} relationship="label">
      <ToggleButton appearance="subtle" size="small" icon={<PinGlyph />} />
    </Tooltip>
    <Menu>
      <Menu.Trigger>
        <MenuButton appearance="subtle" size="small" aria-label={`More options for ${name}`} />
      </Menu.Trigger>
      <Menu.Popover>
        <Menu.Item>Open in new tab</Menu.Item>
        <Menu.Item>Copy link</Menu.Item>
        <Menu.Item>Hide</Menu.Item>
      </Menu.Popover>
    </Menu>
  </>
);

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

/**
 * A closed category that contains the current page marks its toggle with `aria-current="true"`,
 * `data-contains-current` and the selected look of an item, so the current page is still visible
 * while its category is collapsed. Open "Documentation" and the mark moves to "API Reference".
 * For sub-items your own component renders, pass `currentCategory`.
 */
export const CollapsedCurrent: Story = {
  args: {
    defaultValue: 'api',
    defaultOpenCategories: [],
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

/**
 * Fluent's basic layout: `Nav.AppItem` shows the app's name and logo at the top,
 * `Nav.SectionHeader` puts a heading between groups of items (`<h3>` unless `headingLevel`; it may
 * also sit in a category), and `Nav.Divider` draws a line before the footer group, hidden from
 * assistive technology. Every part renders its own list item, so the Nav's lists stay valid.
 */
export const Sections: Story = {
  args: {
    defaultValue: 'dashboard',
    style: { minHeight: 400 },
    children: (
      <>
        <Nav.AppItem href="#start" icon={<AppLogo />}>
          Contoso HR
        </Nav.AppItem>
        <Nav.Item value="dashboard">Dashboard</Nav.Item>
        <Nav.Item value="announcements">Announcements</Nav.Item>
        <Nav.Item value="spotlight">Employee spotlight</Nav.Item>
        <Nav.SectionHeader>Employee management</Nav.SectionHeader>
        <Nav.Category value="jobs" label="Job postings">
          <Nav.SubItem value="openings">Openings</Nav.SubItem>
          <Nav.SubItem value="submissions">Submissions</Nav.SubItem>
        </Nav.Category>
        <Nav.Item value="interviews">Interviews</Nav.Item>
        <Nav.SectionHeader>Benefits</Nav.SectionHeader>
        <Nav.Item value="health">Health plans</Nav.Item>
        <Nav.Category value="retirement" label="Retirement">
          <Nav.SubItem value="plans">Plan information</Nav.SubItem>
          <Nav.SubItem value="contributions">Contributions</Nav.SubItem>
        </Nav.Category>
        <Nav.Divider />
        <Nav.Item value="reports">Reports</Nav.Item>
        <Nav.Item value="settings">Settings</Nav.Item>
      </>
    ),
  },
};

/**
 * `Nav.AppItem` is the app's name and logo: a link with `href` (here with an Avatar as its icon),
 * a button without. It is never selected, so a click runs only its own `onClick`.
 * `Nav.AppItemStatic` shows the same layout as plain text, not focusable.
 */
export const AppItem: Story = {
  args: {
    defaultValue: 'home',
    children: (
      <>
        <Nav.AppItem href="#start" icon={<Avatar name="Contoso HR" size="medium" />}>
          Contoso HR
        </Nav.AppItem>
        <Nav.Item value="home">Home</Nav.Item>
        <Nav.Item value="people">People</Nav.Item>
        <Nav.Divider />
        <Nav.AppItemStatic icon={<AppLogo />}>Fabrikam Portal</Nav.AppItemStatic>
      </>
    ),
  },
};

/**
 * `actions` puts your own controls beside an item or sub-item (Fluent's SplitNavItem): here a Pin
 * `ToggleButton` named by a `Tooltip` with `relationship="label"` and a "More options"
 * `MenuButton` with a `Menu`. They sit in a group named by the item, each a Tab stop after it, and
 * never select it. They are drawn while the row is hovered or has focus, while the pin is pressed
 * or the menu is open, and always on touch screens, and fade in and out over 150ms (at once under
 * reduced motion and below `WaveProvider motion="none"`); with actions, the selected look covers
 * the whole row.
 */
export const ItemActions: Story = {
  args: {
    defaultValue: 'reports',
    defaultOpenCategories: ['projects'],
    children: (
      <>
        <Nav.Item value="dashboard" actions={<ItemActionSet name="Dashboard" />}>
          Dashboard
        </Nav.Item>
        <Nav.Item value="reports" actions={<ItemActionSet name="Reports" />}>
          Reports
        </Nav.Item>
        <Nav.Item value="archive" disabled actions={<ItemActionSet name="Archive" />}>
          Archive
        </Nav.Item>
        <Nav.Category value="projects" label="Projects">
          <Nav.SubItem value="alpha" actions={<ItemActionSet name="Alpha" />}>
            Alpha
          </Nav.SubItem>
          <Nav.SubItem value="beta" actions={<ItemActionSet name="Beta" />}>
            Beta
          </Nav.SubItem>
        </Nav.Category>
        <Nav.Item value="settings">Settings</Nav.Item>
      </>
    ),
  },
};

/** The Motion story's collapse: 400ms with the mid decelerating curve, without the fade. */
const slowCollapse =
  'transition-[grid-template-rows] duration-wave-slower ease-wave-decelerate-mid motion-reduce:transition-none data-[presence=entering]:starting:grid-rows-[minmax(0,0fr)] data-[presence=exiting]:grid-rows-[minmax(0,0fr)]';

/** The Motion story's chevron: its turn takes 400ms with the max decelerating curve. */
const slowTurn =
  'transition-transform duration-wave-slower ease-wave-decelerate-max motion-reduce:transition-none';

/**
 * `Nav.Category motion` and `expandIconMotion`. By default a category's list opens from nothing
 * and closes back to it while it fades (on the element around its `<ul>`,
 * `wave-nav-category__collapse`), over 200ms, and the chevron's half turn takes 150ms. Focus in a
 * closing list moves to the category's button. `null` turns both off (the chevron still turns, at
 * once); class strings replace them (here a slower collapse and turn). Under reduced motion lists
 * open and close at once.
 */
export const Motion: Story = {
  args: {
    defaultOpenCategories: ['settings'],
  },
  render: ({ children: _children, ...args }) => (
    <div className="flex flex-wrap gap-6">
      {motionCases(slowCollapse).map(({ label, motion }) => (
        // The story renders one Nav per case; every other arg is forwarded.
        <Nav key={label} {...args} aria-label={label}>
          <Nav.Item value="home">Home</Nav.Item>
          <Nav.Category
            value="settings"
            label="Settings"
            motion={motion}
            expandIconMotion={typeof motion === 'string' ? slowTurn : motion}
          >
            <Nav.SubItem value="profile">Profile</Nav.SubItem>
            <Nav.SubItem value="account">Account</Nav.SubItem>
            <Nav.SubItem value="privacy">Privacy</Nav.SubItem>
          </Nav.Category>
          <Nav.Category
            value="docs"
            label="Documentation"
            motion={motion}
            expandIconMotion={typeof motion === 'string' ? slowTurn : motion}
          >
            <Nav.SubItem value="getting-started">Getting Started</Nav.SubItem>
            <Nav.SubItem value="api">API Reference</Nav.SubItem>
          </Nav.Category>
        </Nav>
      ))}
    </div>
  ),
};

/** A plus or a minus for the CustomExpandIcon story, by the category's open state. */
const SignGlyph = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor">
    <path d={open ? 'M3.5 8h9' : 'M3.5 8h9M8 3.5v9'} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

/**
 * `Nav.Category expandIcon` replaces the chevron (decorative, inside the category's button). A
 * glyph of yours is not turned, so one that shows the state itself works: here a plus or a minus,
 * picked from the controlled `openCategories`. `false` hides the icon; `aria-expanded` still
 * reports the state.
 */
export const CustomExpandIcon: Story = {
  render: function CustomExpandIconNav({
    children: _children,
    defaultOpenCategories,
    onOpenCategoriesChange,
    ...args
  }) {
    const [openCategories, setOpenCategories] = React.useState<string[]>(
      defaultOpenCategories ? [...defaultOpenCategories] : [],
    );
    return (
      // The story owns the controlled pair; every other arg is forwarded.
      <Nav
        {...args}
        openCategories={openCategories}
        onOpenCategoriesChange={(next) => {
          setOpenCategories(next);
          onOpenCategoriesChange?.(next);
        }}
      >
        <Nav.Item value="home">Home</Nav.Item>
        <Nav.Category
          value="settings"
          label="Settings"
          expandIcon={<SignGlyph open={openCategories.includes('settings')} />}
        >
          <Nav.SubItem value="profile">Profile</Nav.SubItem>
          <Nav.SubItem value="account">Account</Nav.SubItem>
        </Nav.Category>
        <Nav.Category value="help" label="Help" expandIcon={false}>
          <Nav.SubItem value="faq">FAQ</Nav.SubItem>
          <Nav.SubItem value="contact">Contact</Nav.SubItem>
        </Nav.Category>
      </Nav>
    );
  },
};
