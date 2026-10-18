import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Drawer, Button, Field, Input, Switch, Tooltip } from '../src';
import type { DrawerPosition, DrawerProps } from '../src';

/** Stories that render the drawer open show it in an iframe, so the docs page stays usable. */
const openStoryParameters = {
  docs: { story: { inline: false, iframeHeight: 480 } },
};

const positions = [
  'start',
  'end',
  'left',
  'right',
  'bottom',
] as const satisfies readonly DrawerPosition[];

const sizes = ['small', 'medium', 'large', 'full'] as const satisfies readonly NonNullable<
  DrawerProps['size']
>[];

const modalTypes = ['modal', 'alert', 'non-modal'] as const satisfies readonly NonNullable<
  DrawerProps['modalType']
>[];

/** The thirty fields of the LongContent drawer. */
const longFields = [
  'Keyword',
  'Author',
  'Title',
  'Publisher',
  'Series',
  'Edition',
  'Language',
  'Translator',
  'Illustrator',
  'Editor',
  'Genre',
  'Subject',
  'Audience',
  'Format',
  'Binding',
  'Pages from',
  'Pages to',
  'Published after',
  'Published before',
  'Price from',
  'Price to',
  'Currency',
  'Condition',
  'Seller',
  'Location',
  'Shipping',
  'Rating',
  'Award',
  'Collection',
  'Notes',
];

/** Paragraphs of the ScrollableTextBody drawer. */
const termsParagraphs = Array.from(
  { length: 14 },
  (_, index) =>
    `Section ${index + 1}. These terms describe how the service may be used, what it stores and how either party can end the agreement.`,
);

/** Decorative "expand" glyph (the Button hides its icon slot from assistive technology). */
const ExpandIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor">
    <path
      d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Decorative Back arrow, mirrored in right-to-left layouts (it points to the inline start). */
const BackIcon = () => (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    className="wave-rtl:-scale-x-100"
  >
    <path
      d="M13.5 8h-11M7 3.5 2.5 8 7 12.5"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const meta = {
  title: 'Components/Overlays/Drawer',
  component: Drawer,
  args: {
    defaultOpen: false,
    position: 'end',
    size: 'small',
    modalType: 'modal',
    unmountOnClose: true,
    title: 'Filters',
    onOpenChange: fn(),
    children: 'Choose the filters to apply to the list.',
  },
  argTypes: {
    position: { control: 'select', options: positions },
    size: { control: 'select', options: sizes },
    modalType: { control: 'select', options: modalTypes },
  },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An uncontrolled drawer with `Drawer.Trigger` (rendered in place) and a `Drawer.Close` action. */
function renderWithTrigger({ children, ...args }: React.ComponentProps<typeof Drawer>) {
  return (
    <Drawer {...args}>
      <Drawer.Trigger>
        <Button appearance="primary">Open drawer</Button>
      </Drawer.Trigger>
      <p>{children}</p>
      <Drawer.Footer>
        <Drawer.Close>
          <Button appearance="primary">Apply</Button>
        </Drawer.Close>
      </Drawer.Footer>
    </Drawer>
  );
}

/** Attached to the end edge (the right in left-to-right layouts). */
export const Default: Story = {
  render: renderWithTrigger,
};

/** Attached to the start edge: the left in left-to-right layouts, the right in right-to-left ones. */
export const StartPosition: Story = {
  args: { position: 'start', title: 'Navigation' },
  render: renderWithTrigger,
};

/**
 * `size` sets the panel's width at a side: `small` (320px, the default), `medium` (592px), `large`
 * (940px) or `full` (the whole window). The panel never grows past the window, so a large drawer
 * on a narrow screen is as wide as the screen.
 */
export const Sizes: Story = {
  render: function SizesDrawers({ children, size: _size, title: _title, ...args }) {
    return (
      <div className="flex flex-wrap gap-2">
        {sizes.map((size) => (
          <Drawer key={size} {...args} size={size} title={`A ${size} drawer`}>
            <Drawer.Trigger>
              <Button>{`Open ${size}`}</Button>
            </Drawer.Trigger>
            <p>{children}</p>
          </Drawer>
        ))}
      </div>
    );
  },
};

/**
 * `position="bottom"` runs the panel along the bottom edge, the window wide; `size` sets its
 * height (here `medium`, 592px, capped at the window's height). Toasts move above it while it is
 * open.
 */
export const BottomPosition: Story = {
  args: { position: 'bottom', size: 'medium', title: 'Details' },
  render: renderWithTrigger,
};

/**
 * The composed layout, rendered open: `Drawer.Header` replaces the built-in header row, and its
 * `Drawer.HeaderTitle` holds the heading, an `action` (here an icon button) and the built-in Close
 * button, in that order. The content scrolls in the body; `Drawer.Footer` is an action row below
 * the body that never scrolls, its actions at the inline start.
 */
export const HeaderAndFooter: Story = {
  args: { defaultOpen: true },
  parameters: openStoryParameters,
  render: function HeaderAndFooterDrawer({ children, title: _title, ...args }) {
    return (
      <Drawer {...args}>
        <Drawer.Trigger>
          <Button appearance="primary">Open drawer</Button>
        </Drawer.Trigger>
        <Drawer.Header>
          <Drawer.HeaderTitle
            action={
              <Button appearance="subtle" size="small" icon={<ExpandIcon />} aria-label="Expand" />
            }
          >
            Filters
          </Drawer.HeaderTitle>
        </Drawer.Header>
        <p>{children}</p>
        <Drawer.Footer>
          <Drawer.Close>
            <Button appearance="primary">Apply</Button>
          </Drawer.Close>
          <Button>Reset</Button>
        </Drawer.Footer>
      </Drawer>
    );
  },
};

/**
 * Content taller than the panel scrolls in the body, between a header and a footer that stay in
 * place. The separators follow the scroll position: the header draws a line under itself once the
 * body is scrolled away from its top, the footer one above itself while more content follows
 * (`data-scroll-state` on the body, the header and the footer).
 */
export const LongContent: Story = {
  args: { title: 'All filters' },
  render: function LongContentDrawer({ children: _children, ...args }) {
    return (
      <Drawer {...args}>
        <Drawer.Trigger>
          <Button appearance="primary">Open all filters</Button>
        </Drawer.Trigger>
        <div className="flex flex-col gap-3">
          {longFields.map((field) => (
            <Field key={field} label={field}>
              <Input />
            </Field>
          ))}
        </div>
        <Drawer.Footer>
          <Drawer.Close>
            <Button appearance="primary">Apply</Button>
          </Drawer.Close>
          <Button>Reset</Button>
        </Drawer.Footer>
      </Drawer>
    );
  },
};

/**
 * A form in the body and its submit button in the footer: the button names the form with the
 * native `form` attribute, so it submits it from outside, and Enter in a field submits it too.
 * Here a submit saves the values and closes the drawer.
 */
export const FormInDrawer: Story = {
  render: function FormInDrawerDrawer({ children: _children, title: _title, ...args }) {
    const formId = React.useId();
    const [open, setOpen] = React.useState(false);
    const [saved, setSaved] = React.useState('');
    const handleOpenChange: NonNullable<DrawerProps['onOpenChange']> = (next, details) => {
      setOpen(next);
      args.onOpenChange?.(next, details);
    };
    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const name = new FormData(event.currentTarget).get('displayName');
      setSaved(typeof name === 'string' ? name : '');
      handleOpenChange(false);
    };
    return (
      <div className="flex flex-col items-start gap-2">
        {/* The story owns the controlled pair; every other arg is forwarded. */}
        <Drawer {...args} open={open} onOpenChange={handleOpenChange}>
          <Drawer.Trigger>
            <Button appearance="primary">Edit profile</Button>
          </Drawer.Trigger>
          <Drawer.Header>
            <Drawer.HeaderTitle>Profile</Drawer.HeaderTitle>
          </Drawer.Header>
          <form
            id={formId}
            aria-label="Profile"
            className="flex flex-col gap-3"
            onSubmit={handleSubmit}
          >
            <Field label="Display name">
              <Input name="displayName" defaultValue={saved} />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" />
            </Field>
          </form>
          <Drawer.Footer>
            <Button appearance="primary" type="submit" form={formId}>
              Save
            </Button>
            <Drawer.Close>
              <Button>Cancel</Button>
            </Drawer.Close>
          </Drawer.Footer>
        </Drawer>
        <p>{saved ? `Saved as ${saved}.` : 'Nothing saved yet.'}</p>
      </div>
    );
  },
};

/** The levels of the MultipleLevels drawer. */
type SettingsLevel = 'settings' | 'notifications' | 'privacy';

const levelTitles: Record<SettingsLevel, string> = {
  settings: 'Settings',
  notifications: 'Notifications',
  privacy: 'Privacy',
};

/**
 * A drawer with levels: `Drawer.HeaderNavigation` holds the Back button of a deeper level (a
 * navigation landmark, named because the page may have others), and the `Drawer.HeaderTitle`
 * follows the level. Focus moves to the Back button when a level opens and back to the item that
 * opened it on Back. The Back arrow mirrors in right-to-left layouts.
 */
export const MultipleLevels: Story = {
  render: function MultipleLevelsDrawer({ children: _children, title: _title, ...args }) {
    const [level, setLevel] = React.useState<SettingsLevel>('settings');
    const backRef = React.useRef<HTMLButtonElement>(null);
    const itemRefs = React.useRef<Partial<Record<SettingsLevel, HTMLButtonElement | null>>>({});
    // Set by a level change from inside the drawer; the layout effect then moves focus in the same
    // commit, since the element that had it (the item, or Back) is gone.
    const returnToRef = React.useRef<SettingsLevel | null>(null);
    React.useLayoutEffect(() => {
      const returnTo = returnToRef.current;
      if (returnTo === null) return;
      returnToRef.current = null;
      if (level === 'settings') itemRefs.current[returnTo]?.focus();
      else backRef.current?.focus();
    }, [level]);
    const openLevel = (next: SettingsLevel) => {
      returnToRef.current = level === 'settings' ? next : level;
      setLevel(next);
    };
    const handleOpenChange: NonNullable<DrawerProps['onOpenChange']> = (next, details) => {
      if (!next) setLevel('settings');
      args.onOpenChange?.(next, details);
    };
    return (
      <Drawer {...args} onOpenChange={handleOpenChange}>
        <Drawer.Trigger>
          <Button appearance="primary">Open settings</Button>
        </Drawer.Trigger>
        <Drawer.Header>
          {level !== 'settings' && (
            <Drawer.HeaderNavigation aria-label="Settings levels">
              <Button
                ref={backRef}
                appearance="subtle"
                icon={<BackIcon />}
                onClick={() => openLevel('settings')}
              >
                Back
              </Button>
            </Drawer.HeaderNavigation>
          )}
          <Drawer.HeaderTitle>{levelTitles[level]}</Drawer.HeaderTitle>
        </Drawer.Header>
        {level === 'settings' ? (
          <div className="flex flex-col items-start gap-2">
            {(['notifications', 'privacy'] as const).map((item) => (
              <Button
                key={item}
                ref={(node) => {
                  itemRefs.current[item] = node;
                }}
                appearance="subtle"
                onClick={() => openLevel(item)}
              >
                {levelTitles[item]}
              </Button>
            ))}
          </div>
        ) : level === 'notifications' ? (
          <div className="flex flex-col gap-3">
            <Switch label="Email notifications" defaultChecked />
            <Switch label="Push notifications" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Switch label="Show my status" defaultChecked />
            <Switch label="Share usage data" />
          </div>
        )}
      </Drawer>
    );
  },
};

/**
 * A body with text only: `Drawer.Body` gives the scrolling body your props, here
 * `tabIndex={0} role="region" aria-label`, so the keyboard can reach and scroll it. The body then
 * shows the focus ring inside its edge on keyboard focus.
 */
export const ScrollableTextBody: Story = {
  args: { title: 'Terms of service' },
  render: function ScrollableTextBodyDrawer({ children: _children, ...args }) {
    return (
      <Drawer {...args}>
        <Drawer.Trigger>
          <Button appearance="primary">Read the terms</Button>
        </Drawer.Trigger>
        <Drawer.Body tabIndex={0} role="region" aria-label="Terms text">
          <div className="flex flex-col gap-3">
            {termsParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close>
            <Button appearance="primary">Accept</Button>
          </Drawer.Close>
        </Drawer.Footer>
      </Drawer>
    );
  },
};

/**
 * `Drawer.Trigger` must be a direct child of `Drawer` (a Fragment is fine): wrapped in another
 * element or component it becomes panel content, which is not rendered while the drawer is
 * closed. To add a Tooltip, put it inside the trigger with a render-prop child, so the trigger
 * props and the description land on the same button.
 */
export const TriggerWithTooltip: Story = {
  render: function TriggerWithTooltipDrawer({ children, ...args }) {
    return (
      <Drawer {...args}>
        <Drawer.Trigger>
          {(triggerProps) => (
            <Tooltip content="Narrow the list">
              <Button appearance="primary" {...triggerProps}>
                Open drawer
              </Button>
            </Tooltip>
          )}
        </Drawer.Trigger>
        <p>{children}</p>
      </Drawer>
    );
  },
};

/**
 * The parent owns `open`: its own button opens the drawer, and the drawer asks to close through
 * `onOpenChange` (Escape, the backdrop, the Close button, or the Done button inside the drawer),
 * with the reason in its second argument (`details.reason`). The page outside is inert while the
 * drawer is open, so the close action lives inside it.
 */
export const Controlled: Story = {
  args: { position: 'start', title: 'Start drawer' },
  render: function ControlledDrawer({ children, ...args }) {
    const [open, setOpen] = React.useState(false);
    const handleOpenChange: NonNullable<DrawerProps['onOpenChange']> = (next, details) => {
      setOpen(next);
      args.onOpenChange?.(next, details);
    };
    return (
      <>
        <Button appearance="primary" onClick={() => handleOpenChange(true)}>
          Open
        </Button>
        {/* The story owns the controlled pair; every other arg is forwarded. */}
        <Drawer {...args} open={open} onOpenChange={handleOpenChange}>
          <p>{children}</p>
          <Drawer.Footer>
            <Button appearance="primary" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </Drawer.Footer>
        </Drawer>
      </>
    );
  },
};

/**
 * `modalType="non-modal"`: a details panel beside a page that stays usable — no backdrop, no focus
 * trap, nothing inert, the page scrolls. Tab from the trigger enters the panel, Tab past its last
 * element continues after the trigger, Escape inside closes it, and the trigger toggles it. While
 * the panel is open the page column reserves its width (`pe-80` for the `small` panel's 320px), so
 * no page control is hidden behind it.
 */
export const NonModal: Story = {
  args: {
    modalType: 'non-modal',
    title: 'Order 1042',
    children: 'Two items, shipped on Monday to the warehouse in Lyon.',
  },
  render: function NonModalDrawer({ children, ...args }) {
    const [open, setOpen] = React.useState(true);
    const handleOpenChange: NonNullable<DrawerProps['onOpenChange']> = (next, details) => {
      setOpen(next);
      args.onOpenChange?.(next, details);
    };
    return (
      <div className={open ? 'pe-80' : undefined}>
        <div className="flex flex-col gap-3">
          <p>Orders received this week. Open an order&apos;s details while you keep working.</p>
          <div className="flex flex-wrap gap-2">
            {/* The story owns the controlled pair; every other arg is forwarded. */}
            <Drawer {...args} open={open} onOpenChange={handleOpenChange}>
              <Drawer.Trigger>
                <Button appearance="primary">Order details</Button>
              </Drawer.Trigger>
              <p>{children}</p>
              <Drawer.Footer>
                <Button>Print label</Button>
                <Drawer.Close>
                  <Button appearance="primary">Done</Button>
                </Drawer.Close>
              </Drawer.Footer>
            </Drawer>
            <Button>Refresh</Button>
          </div>
          <Field label="Search orders">
            <Input />
          </Field>
        </div>
      </div>
    );
  },
  parameters: openStoryParameters,
};

/**
 * `modalType="alert"`: a drawer that needs an answer. The panel is `role="alertdialog"`, and a
 * backdrop press does not close it (Escape, the Close button and `Drawer.Close` still do).
 */
export const AlertDrawer: Story = {
  args: {
    modalType: 'alert',
    title: 'Discard the draft?',
    children: 'The draft and its attachments are deleted. This cannot be undone.',
  },
  render: ({ children, ...args }) => (
    <Drawer {...args}>
      <Drawer.Trigger>
        <Button>Discard draft</Button>
      </Drawer.Trigger>
      <p>{children}</p>
      <Drawer.Footer>
        <Drawer.Close>
          <Button appearance="subtle">Keep editing</Button>
        </Drawer.Close>
        <Drawer.Close>
          <Button appearance="primary">Discard</Button>
        </Drawer.Close>
      </Drawer.Footer>
    </Drawer>
  ),
};

/**
 * `unmountOnClose={false}` keeps the panel and its content mounted while the drawer is closed
 * (`hidden` and `inert`), so the filters keep what was typed and switched: change them, close the
 * drawer with Done, Escape or the backdrop, and open it again. Each open moves focus to the first
 * focusable element (the Close button) again.
 */
export const KeepMounted: Story = {
  args: {
    unmountOnClose: false,
    title: 'Search filters',
    children: 'The filters stay as you left them when the drawer opens again.',
  },
  render: ({ children, ...args }) => (
    <Drawer {...args}>
      <Drawer.Trigger>
        <Button appearance="primary">Open filters</Button>
      </Drawer.Trigger>
      <div className="flex flex-col gap-3">
        <p>{children}</p>
        <Field label="Keyword">
          <Input />
        </Field>
        <Field label="Author">
          <Input />
        </Field>
        <Switch label="Only available items" />
      </div>
      <Drawer.Footer>
        <Drawer.Close>
          <Button appearance="primary">Done</Button>
        </Drawer.Close>
      </Drawer.Footer>
    </Drawer>
  ),
};
