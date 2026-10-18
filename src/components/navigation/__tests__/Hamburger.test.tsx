import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react';
import * as stories from '../../../../stories/Hamburger.stories';
import { Hamburger } from '../Hamburger';
import { NavDrawer } from '../NavDrawer';
import { Nav } from '../Nav';
import { Button } from '../../button/Button';
import { Tooltip } from '../../overlays/Tooltip';
import { Portal } from '../../portal/Portal';
import { buttonClassNames, hamburgerClassNames } from '../../../lib/classNames';
import type { Size } from '../../../lib/types';
import { testNoImplicitSubmit, testSystemProps } from '../../../test-utils';

/*
 * P6-08 D132, D133: Hamburger is a subtle Button with the navigation glyph, named "Navigation" by
 * default. Inside a NavDrawer it toggles that drawer (aria-expanded, aria-controls); elsewhere it
 * is a plain button the app wires.
 */

const ICON_EMPTY =
  '[WaveUI] Hamburger: `icon` renders nothing, so the default navigation glyph shows. Unlike `Button`, a Hamburger always shows a glyph: pass an icon, or leave `icon` unset.';
const iconButtonWarning = (what: string) =>
  `[WaveUI] Hamburger: \`icon\` received ${what}; its children render as the glyph and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. \`icon={<MyIcon />}\`.`;

const hamburger = (name = 'Navigation') => screen.getByRole('button', { name });
const glyph = () => document.querySelector('svg[data-wave-icon="navigation"]');

describe('Hamburger', () => {
  // 24. System props.
  describe('system props', () => {
    testSystemProps(Hamburger, {
      expectedTag: 'button',
      displayName: 'Hamburger',
      conflictingClass: { className: 'w-10', overrides: 'w-8' },
    });
    testNoImplicitSubmit(Hamburger);

    it('carries Button root class, then its own; the icon span carries both icon classes', () => {
      render(<Hamburger />);
      const classes = hamburger().className.split(/\s+/);
      expect(classes.indexOf(buttonClassNames.root)).toBeGreaterThanOrEqual(0);
      expect(classes.indexOf(hamburgerClassNames.root)).toBeGreaterThan(
        classes.indexOf(buttonClassNames.root),
      );
      const icon = glyph()!.parentElement!;
      expect(icon).toHaveClass(buttonClassNames.icon, hamburgerClassNames.icon);
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // 25. Name.
  describe('name', () => {
    it('is named "Navigation" by default, and an aria-label wins', () => {
      const { rerender } = render(<Hamburger />);
      expect(hamburger()).toHaveAttribute('aria-label', 'Navigation');
      rerender(<Hamburger aria-label="Menu" />);
      expect(hamburger('Menu')).toHaveAttribute('aria-label', 'Menu');
    });

    it('is named by visible children, aria-labelledby or title, without the default', () => {
      const { rerender } = render(<Hamburger>Menu</Hamburger>);
      expect(hamburger('Menu')).not.toHaveAttribute('aria-label');
      rerender(
        <>
          <span id="label">Pages</span>
          <Hamburger aria-labelledby="label" />
        </>,
      );
      expect(hamburger('Pages')).not.toHaveAttribute('aria-label');
      rerender(<Hamburger title="Site menu" />);
      expect(hamburger('Site menu')).not.toHaveAttribute('aria-label');
    });

    it('is named by a Tooltip with relationship="label"', () => {
      render(
        <Tooltip content="Open the menu" relationship="label">
          <Hamburger />
        </Tooltip>,
      );
      expect(hamburger('Open the menu')).not.toHaveAttribute('aria-label');
    });

    it('never warns Button:icon-only-name', () => {
      const warn = vi.spyOn(console, 'warn');
      try {
        render(
          <>
            <Hamburger />
            <Hamburger aria-label="Menu" />
            <Hamburger title="Site menu" />
          </>,
        );
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });
  });

  // 26. Look.
  describe('look', () => {
    it('is a subtle, icon-only medium Button by default; appearance and size pass to Button', () => {
      const { rerender } = render(<Hamburger />);
      expect(hamburger()).toHaveClass('h-8', 'w-8', 'bg-transparent');
      rerender(<Hamburger appearance="primary" size="large" />);
      expect(hamburger()).toHaveClass('h-10', 'w-10', 'bg-primary');
    });

    it.each([
      ['extra-small', 12],
      ['small', 16],
      ['medium', 20],
      ['large', 24],
      ['extra-large', 28],
    ] as [Size, number][])('draws the default glyph at %s as %ipx', (size, pixels) => {
      render(<Hamburger size={size} />);
      expect(glyph()).toHaveAttribute('width', String(pixels));
      expect(glyph()).toHaveAttribute('height', String(pixels));
    });
  });

  // 27. icon.
  describe('icon', () => {
    it('replaces the glyph with custom content; null and undefined keep it', () => {
      const { rerender } = render(<Hamburger icon={<svg data-testid="custom" />} />);
      expect(screen.getByTestId('custom')).toBeInTheDocument();
      expect(glyph()).toBeNull();
      rerender(<Hamburger icon={null} />);
      expect(glyph()).not.toBeNull();
      rerender(<Hamburger icon={undefined} />);
      expect(glyph()).not.toBeNull();
    });

    it.each([
      ['an empty string', ''],
      ['an empty array', []],
      ['an empty Fragment', <></>],
    ] as const)('keeps the glyph for %s and warns once', (_, icon) => {
      const warn = vi.spyOn(console, 'warn');
      try {
        const { rerender } = render(<Hamburger icon={icon} />);
        rerender(<Hamburger icon={icon} />);
        expect(glyph()).not.toBeNull();
        expect(warn.mock.calls).toEqual([[ICON_EMPTY]]);
      } finally {
        warn.mockRestore();
      }
    });

    it.each([
      [
        'a button element',
        <Button key="b" aria-label="dropped">
          <svg data-testid="inner" />
        </Button>,
      ],
      [
        'a slot object that renders a button',
        { as: 'button' as const, children: <svg data-testid="inner" /> },
      ],
    ])('unwraps %s (no nested button) and warns once', (what, icon) => {
      const warn = vi.spyOn(console, 'warn');
      try {
        render(<Hamburger icon={icon as React.ComponentProps<typeof Hamburger>['icon']} />);
        expect(screen.getAllByRole('button')).toHaveLength(1);
        expect(screen.getByTestId('inner')).toBeInTheDocument();
        expect(hamburger()).toBeInTheDocument();
        expect(warn.mock.calls).toEqual([[iconButtonWarning(what)]]);
      } finally {
        warn.mockRestore();
      }
    });

    it('keeps the glyph for an unwrapped button whose children render nothing, warning only that', () => {
      const warn = vi.spyOn(console, 'warn');
      try {
        render(<Hamburger icon={<button type="button" />} />);
        expect(glyph()).not.toBeNull();
        expect(warn.mock.calls).toEqual([[iconButtonWarning('a button element')]]);
      } finally {
        warn.mockRestore();
      }
    });
  });

  // 28. Outside a NavDrawer.
  describe('outside a NavDrawer', () => {
    it('renders no state ARIA unless passed, and calls onClick', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const { rerender } = render(<Hamburger onClick={onClick} />);
      expect(hamburger()).not.toHaveAttribute('aria-expanded');
      expect(hamburger()).not.toHaveAttribute('aria-controls');
      expect(hamburger()).not.toHaveAttribute('aria-haspopup');
      await user.click(hamburger());
      expect(onClick).toHaveBeenCalledTimes(1);
      rerender(
        <>
          <div id="pane" />
          <Hamburger
            onClick={onClick}
            aria-expanded={false}
            aria-controls="pane"
            aria-haspopup="dialog"
          />
        </>,
      );
      expect(hamburger()).toHaveAttribute('aria-expanded', 'false');
      expect(hamburger()).toHaveAttribute('aria-controls', 'pane');
      expect(hamburger()).toHaveAttribute('aria-haspopup', 'dialog');
    });
  });

  // 29. Inside a NavDrawer.
  describe('inside a NavDrawer', () => {
    function Inline({
      onOpenChange = () => {},
      hamburgerProps,
    }: {
      onOpenChange?: (open: boolean, details?: unknown) => void;
      hamburgerProps?: React.ComponentProps<typeof Hamburger>;
    }) {
      return (
        <NavDrawer type="inline" open onOpenChange={onOpenChange} id="main-nav">
          <NavDrawer.Header>
            <Hamburger {...hamburgerProps} />
          </NavDrawer.Header>
          <NavDrawer.Body>
            <Nav.Item value="home">Home</Nav.Item>
          </NavDrawer.Body>
        </NavDrawer>
      );
    }

    it('reports the drawer: aria-expanded and aria-controls, no aria-haspopup', () => {
      render(<Inline />);
      expect(hamburger()).toHaveAttribute('aria-expanded', 'true');
      expect(hamburger()).toHaveAttribute('aria-controls', 'main-nav');
      expect(hamburger()).not.toHaveAttribute('aria-haspopup');
    });

    it('asks to close (trigger) once under StrictMode, after the consumer’s onClick', async () => {
      const user = userEvent.setup();
      const calls: string[] = [];
      const onOpenChange = vi.fn(() => calls.push('onOpenChange'));
      render(
        <React.StrictMode>
          <Inline
            onOpenChange={onOpenChange}
            hamburgerProps={{ onClick: () => calls.push('onClick') }}
          />
        </React.StrictMode>,
      );
      await user.click(hamburger());
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: 'trigger', event: expect.any(Event) }),
      );
      expect(calls).toEqual(['onClick', 'onOpenChange']);
    });

    it('stays open when the consumer’s onClick calls preventDefault()', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <Inline
          onOpenChange={onOpenChange}
          hamburgerProps={{ onClick: (event) => event.preventDefault() }}
        />,
      );
      await user.click(hamburger());
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('renders no aria-haspopup, also over a consumer one (it is inside the surface)', () => {
      render(<Inline hamburgerProps={{ 'aria-haspopup': 'dialog' }} />);
      expect(hamburger()).not.toHaveAttribute('aria-haspopup');
    });

    it('ignores a click that bubbles from a portal opened inside it (C-COMPOSE)', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <Inline
          onOpenChange={onOpenChange}
          hamburgerProps={{
            'aria-label': 'Navigation',
            children: (
              <Portal>
                <button type="button">In a portal</button>
              </Portal>
            ),
          }}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'In a portal' }));
      expect(onOpenChange).not.toHaveBeenCalled();
      await user.click(hamburger());
      expect(onOpenChange).toHaveBeenCalledTimes(1);
    });

    it('wins over a consumer aria-expanded and aria-controls', () => {
      render(<Inline hamburgerProps={{ 'aria-expanded': false, 'aria-controls': 'elsewhere' }} />);
      expect(hamburger()).toHaveAttribute('aria-expanded', 'true');
      expect(hamburger()).toHaveAttribute('aria-controls', 'main-nav');
    });

    it.each([
      ['disabled', { disabled: true }],
      ['disabledFocusable', { disabledFocusable: true }],
    ] as const)('never toggles while %s', async (_, props) => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Inline onOpenChange={onOpenChange} hamburgerProps={props} />);
      await user.click(hamburger());
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('in an overlay, Enter on it closes the drawer and focus returns to the opener', async () => {
      const user = userEvent.setup();
      function Overlay() {
        const [open, setOpen] = React.useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Open
            </button>
            <NavDrawer open={open} onOpenChange={setOpen}>
              <NavDrawer.Header>
                <Hamburger />
              </NavDrawer.Header>
              <NavDrawer.Body>
                <Nav.Item value="home">Home</Nav.Item>
              </NavDrawer.Body>
            </NavDrawer>
          </>
        );
      }
      render(<Overlay />);
      await user.click(screen.getByRole('button', { name: 'Open' }));
      expect(hamburger()).toHaveFocus();
      expect(hamburger()).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard('{Enter}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await act(async () => {});
      expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
    });
  });

  // The InNavDrawer story: the page's Hamburger stays mounted while it opens the drawer.
  it('InNavDrawer story: the page Hamburger keeps focus when it reopens the drawer', async () => {
    const { InNavDrawer } = composeStories(stories);
    const user = userEvent.setup();
    render(<InNavDrawer />);
    const outer = hamburger('Show navigation');
    expect(outer).toHaveAttribute('aria-expanded', 'true');
    expect(outer).toHaveAttribute(
      'aria-controls',
      screen.getByRole('navigation').parentElement!.id,
    );
    await user.click(hamburger());
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(outer).toHaveFocus();
    expect(outer).not.toHaveAttribute('aria-controls');
    await user.click(outer);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(outer).toHaveFocus();
    expect(outer).toHaveAttribute('aria-expanded', 'true');
  });
});
