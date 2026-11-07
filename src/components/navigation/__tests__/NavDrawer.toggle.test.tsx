import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { Hamburger } from '../Hamburger';
import { Nav } from '../Nav';
import { NavDrawer } from '../NavDrawer';
import {
  useNavDrawerToggle,
  type NavDrawerToggleDrawerProps,
  type NavDrawerToggleHamburgerProps,
  type UseNavDrawerToggleOptions,
  type UseNavDrawerToggleResult,
} from '../NavDrawer.toggle';
import type { DrawerOpenChangeDetails, DrawerType } from '../../overlays/Drawer.context';
import { expectNoA11yViolations } from '../../../test-utils';

const hamburger = () => screen.getByRole('button', { name: 'Navigation' });

function Page(props: UseNavDrawerToggleOptions & { ssr?: boolean }) {
  const { ssr: _ssr, ...options } = props;
  const { hamburgerProps, drawerProps } = useNavDrawerToggle(options);
  return (
    <>
      <header>
        <Hamburger {...hamburgerProps} />
      </header>
      <NavDrawer {...drawerProps} aria-label="Main">
        <NavDrawer.Body>
          <Nav.Item value="home">Home</Nav.Item>
        </NavDrawer.Body>
      </NavDrawer>
    </>
  );
}

describe('useNavDrawerToggle', () => {
  it('wires an overlay drawer: aria-haspopup, aria-expanded and aria-controls follow it', async () => {
    const user = userEvent.setup();
    render(<Page />);
    expect(hamburger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(hamburger()).toHaveAttribute('aria-expanded', 'false');
    expect(hamburger()).not.toHaveAttribute('aria-controls');
    await user.click(hamburger());
    const dialog = screen.getByRole('dialog', { name: 'Main' });
    expect(hamburger()).toHaveAttribute('aria-expanded', 'true');
    expect(hamburger()).toHaveAttribute('aria-controls', dialog.id);
    await expectNoA11yViolations(document.body);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(hamburger()).toHaveAttribute('aria-expanded', 'false');
    expect(hamburger()).not.toHaveAttribute('aria-controls');
  });

  it('returns focus to the Hamburger when the overlay closes (finalFocusRef)', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(hamburger());
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(hamburger()).toHaveFocus();
    await user.click(hamburger());
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await act(async () => {});
  });

  it('reports the NavDrawer details, once per change in StrictMode', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <Page onOpenChange={onOpenChange} />
      </React.StrictMode>,
    );
    await user.click(hamburger());
    await user.keyboard('{Escape}');
    const calls = onOpenChange.mock.calls as Array<[boolean, DrawerOpenChangeDetails]>;
    expect(calls.map(([open, { reason, event }]) => [open, reason, event.type])).toEqual([
      [true, 'trigger', 'click'],
      [false, 'escape', 'keydown'],
    ]);
  });

  it('wires an inline drawer: no aria-haspopup, the Hamburger toggles it both ways', async () => {
    const user = userEvent.setup();
    render(<Page type="inline" defaultOpen />);
    expect(hamburger()).not.toHaveAttribute('aria-haspopup');
    expect(hamburger()).toHaveAttribute('aria-expanded', 'true');
    const panelId = hamburger().getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).toBeInTheDocument();
    await user.click(hamburger());
    expect(hamburger()).toHaveAttribute('aria-expanded', 'false');
    expect(hamburger()).not.toHaveAttribute('aria-controls');
  });

  it('a controlled toggle asks, and stays as it is until the state is updated', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Page open={false} onOpenChange={onOpenChange} />);
    await user.click(hamburger());
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'trigger' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(<Page open onOpenChange={onOpenChange} />);
    expect(screen.getByRole('dialog', { name: 'Main' })).toBeInTheDocument();
    expect(hamburger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('uses the id you give it as the panel id', async () => {
    const user = userEvent.setup();
    render(<Page id="main-nav" />);
    await user.click(hamburger());
    expect(screen.getByRole('dialog')).toHaveAttribute('id', 'main-nav');
    expect(hamburger()).toHaveAttribute('aria-controls', 'main-nav');
  });

  it('ignores a click that bubbles from a portal opened inside the button', async () => {
    const onOpenChange = vi.fn();
    function Wired() {
      const { hamburgerProps } = useNavDrawerToggle({ onOpenChange });
      return (
        <Hamburger {...hamburgerProps}>
          {/* A portal's content reaches the button's React handlers but is not in the button. */}
          {createPortal(<span data-testid="portaled">inside</span>, document.body)}
        </Hamburger>
      );
    }
    render(<Wired />);
    await userEvent.click(screen.getByTestId('portaled'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('server HTML: an overlay reports itself closed, an inline drawer open', () => {
    const overlay = renderToString(<Page defaultOpen />);
    expect(overlay).toContain('aria-expanded="false"');
    expect(overlay).not.toContain('aria-controls');
    const inline = renderToString(<Page type="inline" defaultOpen />);
    expect(inline).toContain('aria-expanded="true"');
    expect(inline).toContain('aria-controls="');
  });

  it('has the documented types', () => {
    expectTypeOf<UseNavDrawerToggleOptions['type']>().toEqualTypeOf<DrawerType | undefined>();
    expectTypeOf<ReturnType<typeof useNavDrawerToggle>>().toEqualTypeOf<UseNavDrawerToggleResult>();
    expectTypeOf<
      UseNavDrawerToggleResult['hamburgerProps']
    >().toEqualTypeOf<NavDrawerToggleHamburgerProps>();
    expectTypeOf<
      UseNavDrawerToggleResult['drawerProps']
    >().toEqualTypeOf<NavDrawerToggleDrawerProps>();
    expectTypeOf<NavDrawerToggleHamburgerProps['aria-haspopup']>().toEqualTypeOf<
      'dialog' | undefined
    >();
  });
});
