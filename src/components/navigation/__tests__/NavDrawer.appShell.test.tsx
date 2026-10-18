import { afterEach, describe, it, expect } from 'vitest';
import * as React from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react';
import { fn } from 'storybook/test';
import * as stories from '../../../../stories/NavDrawer.stories';
import { getTopmostLayer } from '../../../lib/layers';
import { expectNoA11yViolations, mockMatchMedia } from '../../../test-utils';

/*
 * P6-08 D138, the phase's exit criterion: the App shell story (NavDrawer + Drawer + Toolbar),
 * inline beside the content in a wide window, overlays below 768px. jsdom's matchMedia matches
 * nothing (the wide layout, which the stories gate audits); the narrow one is driven through
 * mockMatchMedia.
 */

const { AppShell } = composeStories(stories);
const NARROW = '(max-width: 767px)';

afterEach(() => {
  cleanup();
  expect(getTopmostLayer()).toBeNull();
  expect(document.querySelectorAll('[inert]')).toHaveLength(0);
});

const toolbar = () => screen.getByRole('toolbar', { name: 'App' });
/** The page's Hamburger, in the toolbar. */
const outer = () => within(toolbar()).getByRole('button', { name: 'Navigation' });
const details = () => within(toolbar()).getByRole('button', { name: 'Details' });
const item = (name: string) => screen.getByRole('button', { name });

describe('NavDrawer App shell story', () => {
  // 30. Wide.
  it('wide: the inline navigation is open beside the content, and Details toggles an inline pane', async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    expect(getTopmostLayer()).toBeNull();
    expect(outer()).toHaveAttribute('aria-expanded', 'true');
    expect(outer()).toHaveAttribute('aria-controls', nav.parentElement!.id);
    expect(outer()).not.toHaveAttribute('aria-haspopup');
    // An inline pane shows no Hamburger of its own.
    expect(within(nav).queryByRole('button', { name: 'Navigation' })).not.toBeInTheDocument();

    await user.click(details());
    const pane = screen.getByRole('complementary', { name: 'Details' });
    expect(details()).toHaveAttribute('aria-expanded', 'true');
    expect(details()).toHaveAttribute('aria-controls', pane.id);
    await expectNoA11yViolations();
    await user.click(details());
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(details()).toHaveAttribute('aria-expanded', 'false');
  });

  // 31. The outer Hamburger toggles the inline navigation.
  it('wide: the outer Hamburger closes and reopens the inline navigation, keeping focus', async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await user.click(outer());
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(outer()).toHaveAttribute('aria-expanded', 'false');
    expect(outer()).not.toHaveAttribute('aria-controls');
    expect(outer()).toHaveFocus();
    await user.click(outer());
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(outer()).toHaveFocus();
  });

  // 32. Narrow.
  describe('narrow', () => {
    it('opens a modal dialog from the outer Hamburger; Escape closes it back to the Hamburger', async () => {
      mockMatchMedia({ [NARROW]: true });
      const user = userEvent.setup();
      render(<AppShell />);
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(outer()).toHaveAttribute('aria-haspopup', 'dialog');
      expect(outer()).toHaveAttribute('aria-expanded', 'false');
      await user.click(outer());
      const dialog = screen.getByRole('dialog', { name: 'Main' });
      const inner = within(dialog).getByRole('button', { name: 'Navigation' });
      expect(inner).toHaveFocus();
      expect(toolbar().closest('[inert]')).not.toBeNull();
      await expectNoA11yViolations();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(outer()).toHaveFocus();
    });

    it('closes when an item is chosen, the current one included, with focus back on the Hamburger', async () => {
      mockMatchMedia({ [NARROW]: true });
      const user = userEvent.setup();
      // The story's own spies type (`fn()` from storybook/test, as its args).
      const onValueChange = fn();
      const onItemSelect = fn();
      render(<AppShell onValueChange={onValueChange} onItemSelect={onItemSelect} />);
      await user.click(outer());
      await user.click(item('Reports'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(outer()).toHaveFocus();
      expect(onValueChange.mock.calls).toEqual([['reports']]);
      expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();

      await user.click(outer());
      await user.click(item('Reports'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(outer()).toHaveFocus();
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onItemSelect.mock.calls).toEqual([['reports'], ['reports']]);
    });
  });

  // 33. Resize.
  it('resizing: wide → narrow closes the navigation back to the Hamburger; narrow → wide opens it', async () => {
    const user = userEvent.setup();
    render(
      <React.StrictMode>
        <AppShell />
      </React.StrictMode>,
    );
    await user.click(item('Reports'));
    expect(item('Reports')).toHaveFocus();
    let restore: () => void = () => {};
    act(() => {
      restore = mockMatchMedia({ [NARROW]: true });
    });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    expect(outer()).toHaveFocus();
    expect(outer()).toHaveAttribute('aria-haspopup', 'dialog');
    act(() => restore());
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.parentElement).toHaveAttribute('data-type', 'inline');
    expect(within(nav).getByRole('button', { name: 'Reports' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(outer()).toHaveAttribute('aria-expanded', 'true');
  });
});
