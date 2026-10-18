import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Nav } from '../src';
import { Hamburger } from '../src/components/navigation/Hamburger';
import { NavDrawer } from '../src/components/navigation/NavDrawer';

/** A locally drawn grid glyph (tokens only: it takes the text colour). */
const GridGlyph = () => (
  <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M3 3h6v6H3zm8 0h6v6h-6zM3 11h6v6H3zm8 0h6v6h-6z" />
  </svg>
);

const meta = {
  title: 'Components/Navigation/Hamburger',
  component: Hamburger,
  args: {
    onClick: fn(),
  },
  argTypes: {
    appearance: {
      control: 'select',
      options: ['secondary', 'primary', 'outline', 'subtle', 'transparent'],
    },
    size: {
      control: 'select',
      options: ['extra-small', 'small', 'medium', 'large', 'extra-large'],
    },
  },
} satisfies Meta<typeof Hamburger>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Outside a NavDrawer the Hamburger is a plain button: here it toggles a region, reporting it with
 * `aria-expanded` and `aria-controls` (while the region is rendered).
 */
export const Default: Story = {
  render: function DefaultHamburger(args) {
    const [open, setOpen] = React.useState(false);
    return (
      <div className="flex flex-col items-start gap-2">
        <Hamburger
          {...args}
          aria-expanded={open}
          aria-controls={open ? 'hamburger-region' : undefined}
          onClick={(event) => {
            args.onClick?.(event);
            setOpen(!open);
          }}
        />
        {open && (
          <div
            id="hamburger-region"
            role="region"
            aria-label="Pages"
            className="rounded-md border border-border p-3"
          >
            Home, Reports and Settings.
          </div>
        )}
      </div>
    );
  },
};

/** The five sizes: the button's height and the glyph (12, 16, 20, 24 and 28px). */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Hamburger {...args} size="extra-small" aria-label="Navigation, extra small" />
      <Hamburger {...args} size="small" aria-label="Navigation, small" />
      <Hamburger {...args} size="medium" aria-label="Navigation, medium" />
      <Hamburger {...args} size="large" aria-label="Navigation, large" />
      <Hamburger {...args} size="extra-large" aria-label="Navigation, extra large" />
    </div>
  ),
};

/** `icon` replaces the navigation glyph (an app launcher here); it stays decorative. */
export const CustomIcon: Story = {
  args: { icon: <GridGlyph />, 'aria-label': 'Apps' },
};

/**
 * Inside a NavDrawer (in its header) the Hamburger toggles that drawer and reports it with
 * `aria-expanded` and `aria-controls`; here the page's Hamburger opens it again.
 */
export const InNavDrawer: Story = {
  render: function InNavDrawerHamburger(args) {
    const [open, setOpen] = React.useState(true);
    const outerRef = React.useRef<HTMLButtonElement>(null);
    return (
      <div className="flex h-80 flex-col overflow-hidden rounded-md border border-border">
        {!open && (
          <div className="p-2">
            <Hamburger
              ref={outerRef}
              aria-expanded={open}
              aria-label="Show navigation"
              onClick={() => setOpen(true)}
            />
          </div>
        )}
        <div className="flex min-h-0 flex-1">
          <NavDrawer
            type="inline"
            open={open}
            onOpenChange={setOpen}
            finalFocusRef={outerRef}
            defaultValue="home"
          >
            <NavDrawer.Header>
              <Hamburger {...args} />
              <span className="text-subtitle-2 font-semibold">Contoso HR</span>
            </NavDrawer.Header>
            <NavDrawer.Body>
              <Nav.Item value="home">Home</Nav.Item>
              <Nav.Item value="reports">Reports</Nav.Item>
            </NavDrawer.Body>
          </NavDrawer>
        </div>
      </div>
    );
  },
};
