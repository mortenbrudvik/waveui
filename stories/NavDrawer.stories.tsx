import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import {
  Drawer,
  Hamburger,
  Menu,
  MenuButton,
  Nav,
  NavDrawer,
  ToggleButton,
  Toolbar,
  Tooltip,
  type NavDrawerProps,
} from '../src';

/** A locally drawn home glyph (tokens only: it takes the text colour). */
const HomeGlyph = () => (
  <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M10 2.5 2.5 9h2v8.5h4.25v-5h2.5v5h4.25V9h2z" />
  </svg>
);

/** A locally drawn chart glyph. */
const ChartGlyph = () => (
  <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M3 16.5h14V18H3zM4.5 10H7v5H4.5zm4.25-5h2.5v10h-2.5zM13 8h2.5v7H13z" />
  </svg>
);

/** A locally drawn people glyph. */
const PeopleGlyph = () => (
  <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M7 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6.5 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.5 16c0-2.5 2.5-4.5 5.5-4.5s5.5 2 5.5 4.5v1h-11zm12-4.5c2.75 0 5 1.75 5 4v1.5h-4.5V16c0-1.75-.75-3.25-2-4.25.5-.15 1-.25 1.5-.25Z" />
  </svg>
);

/** A locally drawn gear glyph. */
const GearGlyph = () => (
  <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M8.5 2h3l.5 2.25 1.5.75 2-1.25 2 2-1.25 2 .75 1.5L19 9.5v3l-2.25.5-.75 1.5 1.25 2-2 2-2-1.25-1.5.75-.5 2.25h-3L8 16.5 6.5 15.75l-2 1.25-2-2 1.25-2L3 11.5.75 11v-3L3 7.5l.75-1.5L2.5 4l2-2 2 1.25L8 2.5zM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
  </svg>
);

/** A locally drawn pin glyph. */
const PinGlyph = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path d="M5 2h6l-1 4 2 2v1H8.5v5L8 14.5 7.5 14V9H4V8l2-2z" />
  </svg>
);

/** The pages of the examples: two items, a section of people pages and a category. */
const bodyItems = (
  <>
    <Nav.Item value="home" icon={<HomeGlyph />}>
      Home
    </Nav.Item>
    <Nav.Item value="reports" icon={<ChartGlyph />}>
      Reports
    </Nav.Item>
    <Nav.SectionHeader>People</Nav.SectionHeader>
    <Nav.Category value="employees" label="Employees" icon={<PeopleGlyph />}>
      <Nav.SubItem value="directory">Directory</Nav.SubItem>
      <Nav.SubItem value="org-chart">Org chart</Nav.SubItem>
      <Nav.SubItem value="time-off">Time off</Nav.SubItem>
    </Nav.Category>
    <Nav.Divider />
    <Nav.Item value="benefits">Benefits</Nav.Item>
  </>
);

/** The footer of the examples: Settings. */
const footer = (
  <NavDrawer.Footer>
    <Nav.Item value="settings" icon={<GearGlyph />}>
      Settings
    </Nav.Item>
  </NavDrawer.Footer>
);

const meta = {
  title: 'Components/Navigation/NavDrawer',
  component: NavDrawer,
  args: {
    type: 'inline',
    defaultOpen: true,
    defaultValue: 'home',
    onOpenChange: fn(),
    onValueChange: fn(),
    onItemSelect: fn(),
  },
  argTypes: {
    type: { control: 'inline-radio', options: ['overlay', 'inline'] },
    position: { control: 'select', options: ['start', 'end', 'left', 'right', 'bottom'] },
    size: { control: 'select', options: ['small', 'medium', 'large', 'full'] },
    modalType: { control: 'inline-radio', options: ['modal', 'non-modal'] },
  },
} satisfies Meta<typeof NavDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The frame the examples sit in: a bordered row with the page content beside the drawer. */
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-120 overflow-hidden rounded-md border border-border bg-background text-foreground">
    {children}
  </div>
);

/** Page content beside a drawer. */
const Content = ({ className }: { className?: string }) => (
  <div className={['min-w-0 flex-1 p-6', className].filter(Boolean).join(' ')}>
    <p>The page content sits beside the navigation pane.</p>
  </div>
);

/**
 * An inline navigation pane in the page layout: a Header with the app's name, a Body with items,
 * a section header, a category and a divider, and a Footer with Settings.
 */
export const Default: Story = {
  render: function DefaultNavDrawer(args) {
    return (
      <Frame>
        <NavDrawer {...args}>
          <NavDrawer.Header>
            <span className="ps-1.5 text-subtitle-2 font-semibold">Contoso HR</span>
          </NavDrawer.Header>
          <NavDrawer.Body>{bodyItems}</NavDrawer.Body>
          {footer}
        </NavDrawer>
        <Content />
      </Frame>
    );
  },
};

/** The outer Hamburger's wiring for a drawer whose panel has the id `id`. */
function useOverlayDrawer(
  args: NavDrawerProps,
  id: string,
): {
  open: boolean;
  setOpen: (open: boolean) => void;
  outerRef: React.RefObject<HTMLButtonElement | null>;
  drawerProps: Partial<NavDrawerProps>;
} {
  const [open, setOpen] = React.useState(false);
  const outerRef = React.useRef<HTMLButtonElement>(null);
  return {
    open,
    setOpen,
    outerRef,
    drawerProps: {
      id,
      open,
      finalFocusRef: outerRef,
      onOpenChange: (next, details) => {
        setOpen(next);
        args.onOpenChange?.(next, details);
      },
      onItemSelect: (value) => {
        // An overlay closes when a page is chosen, the current one included.
        setOpen(false);
        args.onItemSelect?.(value);
      },
    },
  };
}

/**
 * An overlay drawer, controlled and closed at first: the page's Hamburger (with
 * `aria-expanded`, `aria-controls` while the panel is rendered, and `aria-haspopup="dialog"`)
 * opens it, the Hamburger in its header closes it, and choosing a page closes it too
 * (`onItemSelect`).
 */
export const Overlay: Story = {
  args: { type: 'overlay' },
  render: function OverlayNavDrawer(args) {
    const { open, setOpen, outerRef, drawerProps } = useOverlayDrawer(args, 'overlay-nav');
    return (
      <div className="flex items-center gap-2">
        <Hamburger
          ref={outerRef}
          aria-expanded={open}
          aria-controls={open ? 'overlay-nav' : undefined}
          aria-haspopup="dialog"
          onClick={() => setOpen(!open)}
        />
        <span className="text-subtitle-2 font-semibold">Contoso HR</span>
        <NavDrawer {...args} {...drawerProps}>
          <NavDrawer.Header>
            <Hamburger />
            <span className="text-subtitle-2 font-semibold">Contoso HR</span>
          </NavDrawer.Header>
          <NavDrawer.Body>{bodyItems}</NavDrawer.Body>
          {footer}
        </NavDrawer>
      </div>
    );
  },
};

/** An item action: a Pin toggle named by its tooltip, and a "More options" menu. */
const ItemActions = ({ name }: { name: string }) => (
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
      </Menu.Popover>
    </Menu>
  </>
);

/**
 * `focusMode="arrow"` on the body: it is one Tab stop (the current page at first), and the arrow
 * keys, Home and End move through every focusable element in it, the item actions included. The
 * footer's items stay Tab stops.
 */
export const ArrowKeys: Story = {
  args: { defaultValue: 'reports' },
  render: function ArrowKeysNavDrawer(args) {
    return (
      <Frame>
        <NavDrawer {...args}>
          <NavDrawer.Header>
            <span className="ps-1.5 text-subtitle-2 font-semibold">Contoso HR</span>
          </NavDrawer.Header>
          <NavDrawer.Body focusMode="arrow">
            <Nav.Item value="home" icon={<HomeGlyph />} actions={<ItemActions name="Home" />}>
              Home
            </Nav.Item>
            <Nav.Item
              value="reports"
              icon={<ChartGlyph />}
              actions={<ItemActions name="Reports" />}
            >
              Reports
            </Nav.Item>
            <Nav.Category value="employees" label="Employees" icon={<PeopleGlyph />}>
              <Nav.SubItem value="directory">Directory</Nav.SubItem>
              <Nav.SubItem value="org-chart">Org chart</Nav.SubItem>
            </Nav.Category>
          </NavDrawer.Body>
          {footer}
        </NavDrawer>
        <Content />
      </Frame>
    );
  },
};

/** `position="end"`: the pane at the end edge, its separator on its start edge. */
export const EndPosition: Story = {
  args: { position: 'end' },
  render: function EndNavDrawer(args) {
    return (
      <Frame>
        <Content />
        <NavDrawer {...args}>
          <NavDrawer.Body>{bodyItems}</NavDrawer.Body>
          {footer}
        </NavDrawer>
      </Frame>
    );
  },
};

/**
 * `unmountOnClose={false}`: the closed panel stays mounted (`hidden` and `inert`), so the pressed
 * state of an uncontrolled Pin action survives closing and opening again, and the page
 * Hamburger's `aria-controls` always points at the panel.
 */
export const KeepMounted: Story = {
  args: { unmountOnClose: false },
  render: function KeepMountedNavDrawer(args) {
    const [open, setOpen] = React.useState(true);
    const outerRef = React.useRef<HTMLButtonElement>(null);
    return (
      <div className="flex h-120 flex-col overflow-hidden rounded-md border border-border bg-background text-foreground">
        <div className="flex items-center gap-2 border-b border-border p-2">
          <Hamburger
            ref={outerRef}
            aria-expanded={open}
            aria-controls="kept-nav"
            onClick={() => setOpen(!open)}
          />
          <span className="text-subtitle-2 font-semibold">Contoso HR</span>
        </div>
        <div className="flex min-h-0 flex-1">
          <NavDrawer
            {...args}
            id="kept-nav"
            open={open}
            finalFocusRef={outerRef}
            onOpenChange={(next, details) => {
              setOpen(next);
              args.onOpenChange?.(next, details);
            }}
          >
            <NavDrawer.Body>
              <Nav.Item value="home" icon={<HomeGlyph />} actions={<ItemActions name="Home" />}>
                Home
              </Nav.Item>
              <Nav.Item value="reports" icon={<ChartGlyph />}>
                Reports
              </Nav.Item>
            </NavDrawer.Body>
          </NavDrawer>
          <Content />
        </div>
      </div>
    );
  },
};

/**
 * `type="overlay"` with `modalType="non-modal"` (an inline drawer ignores it): no backdrop, no
 * trap, the page stays usable. While it is open the page content is padded by the panel's width
 * (`small` is 320px), so no page control sits behind it. Controlled and closed at first, opened
 * from the page's Hamburger.
 */
export const NonModal: Story = {
  args: { type: 'overlay', modalType: 'non-modal' },
  render: function NonModalNavDrawer(args) {
    const { open, setOpen, outerRef, drawerProps } = useOverlayDrawer(args, 'non-modal-nav');
    return (
      <div className={open ? 'ps-80' : undefined}>
        <div className="flex items-center gap-2">
          <Hamburger
            ref={outerRef}
            aria-expanded={open}
            aria-controls={open ? 'non-modal-nav' : undefined}
            aria-haspopup="dialog"
            onClick={() => setOpen(!open)}
          />
          <span className="text-subtitle-2 font-semibold">Contoso HR</span>
        </div>
        <p className="mt-4">The page stays usable while the navigation is open.</p>
        <NavDrawer {...args} {...drawerProps}>
          <NavDrawer.Header>
            <Hamburger />
            <span className="text-subtitle-2 font-semibold">Contoso HR</span>
          </NavDrawer.Header>
          <NavDrawer.Body>{bodyItems}</NavDrawer.Body>
          {footer}
        </NavDrawer>
      </div>
    );
  },
};

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------

/** The breakpoint below which the app shell's panes are overlays. */
const NARROW_QUERY = '(max-width: 767px)';

function subscribeNarrow(onChange: () => void): () => void {
  const list = window.matchMedia(NARROW_QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}
const getNarrow = () => window.matchMedia(NARROW_QUERY).matches;
/** The server renders the wide layout. */
const getServerNarrow = () => false;

/** Whether the window is narrow (SSR-safe: `false` on the server and while hydrating). */
function useNarrow(): boolean {
  return React.useSyncExternalStore(subscribeNarrow, getNarrow, getServerNarrow);
}

const PAGE_TITLES: Record<string, string> = {
  home: 'Home',
  reports: 'Reports',
  directory: 'Directory',
  'org-chart': 'Org chart',
  'time-off': 'Time off',
  benefits: 'Benefits',
  settings: 'Settings',
};

/**
 * An app shell (the phase's exit criterion): a Toolbar with the page's Hamburger, the app's name
 * and a "Details" button, above a row of a NavDrawer, the content and a details Drawer. Wide
 * windows show both panes inline, beside the content; below 768px both are overlays (narrow the
 * canvas, or use Storybook's viewport toolbar, to see them). The open states follow the
 * breakpoint: becoming wide opens the navigation and closes the details, becoming narrow closes
 * both. As an overlay the navigation closes when a page is chosen, and its header shows a
 * Hamburger of its own; the page's Hamburger is its `finalFocusRef`, so focus returns there.
 */
export const AppShell: Story = {
  render: function AppShellStory(args) {
    const narrow = useNarrow();
    const [previousNarrow, setPreviousNarrow] = React.useState(narrow);
    const [navOpen, setNavOpen] = React.useState(!narrow);
    const [detailsOpen, setDetailsOpen] = React.useState(false);
    const [page, setPage] = React.useState(args.defaultValue ?? 'home');
    // The breakpoint decides the open states (adjusted during render, C-HOOKS): a resize never
    // turns an open inline pane into a page-blocking modal.
    if (narrow !== previousNarrow) {
      setPreviousNarrow(narrow);
      setNavOpen(!narrow);
      setDetailsOpen(false);
    }
    const type = narrow ? 'overlay' : 'inline';
    const outerRef = React.useRef<HTMLButtonElement>(null);
    const navId = 'app-shell-nav';
    const detailsId = 'app-shell-details';

    return (
      <div className="flex h-150 flex-col overflow-hidden rounded-md border border-border bg-background text-foreground">
        <Toolbar aria-label="App" className="border-b border-border px-2 py-1">
          <Hamburger
            ref={outerRef}
            aria-expanded={navOpen}
            aria-controls={navOpen ? navId : undefined}
            aria-haspopup={narrow ? 'dialog' : undefined}
            onClick={() => setNavOpen(!navOpen)}
          />
          <span className="text-subtitle-2 font-semibold">Contoso HR</span>
          <Toolbar.Button
            className="ms-auto"
            aria-expanded={detailsOpen}
            aria-controls={detailsOpen ? detailsId : undefined}
            onClick={() => setDetailsOpen(!detailsOpen)}
          >
            Details
          </Toolbar.Button>
        </Toolbar>
        <div className="flex min-h-0 flex-1">
          <NavDrawer
            {...args}
            id={navId}
            aria-label="Main"
            type={type}
            open={navOpen}
            finalFocusRef={outerRef}
            onOpenChange={(next, details) => {
              setNavOpen(next);
              args.onOpenChange?.(next, details);
            }}
            onValueChange={(value) => {
              setPage(value);
              args.onValueChange?.(value);
            }}
            onItemSelect={(value) => {
              // An overlay closes on every activation, the current page included.
              if (narrow) setNavOpen(false);
              args.onItemSelect?.(value);
            }}
          >
            {narrow && (
              <NavDrawer.Header>
                <Hamburger />
                <span className="text-subtitle-2 font-semibold">Contoso HR</span>
              </NavDrawer.Header>
            )}
            <NavDrawer.Body>{bodyItems}</NavDrawer.Body>
            {footer}
          </NavDrawer>
          <div className="min-w-0 flex-1 overflow-auto p-6">
            <h2 className="text-title-3 font-semibold">{PAGE_TITLES[page] ?? page}</h2>
            <p className="mt-2">
              The content of the page. Choose a page in the navigation, or open the details.
            </p>
          </div>
          <Drawer
            id={detailsId}
            type={type}
            position="end"
            separator
            title="Details"
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
          >
            <p>Owner: People team. Last updated on Monday.</p>
          </Drawer>
        </div>
      </div>
    );
  },
};
