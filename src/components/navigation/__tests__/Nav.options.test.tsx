import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Nav } from '../Nav';
import type { NavCategoryToggleDetails, NavDensity, NavProps, NavSelectDetails } from '../Nav';
import { NavDrawer, type NavDrawerProps } from '../NavDrawer';
import { expectNoA11yViolations } from '../../../test-utils';

const button = (name: string) => screen.getByRole('button', { name });
const toggle = (name: string) => button(name);

function Parts() {
  return (
    <>
      <Nav.Item value="home">Home</Nav.Item>
      <Nav.Category value="docs" label="Docs">
        <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        <Nav.SubItem value="guide">Guide</Nav.SubItem>
      </Nav.Category>
      <Nav.Category value="settings" label="Settings">
        <Nav.SubItem value="profile">Profile</Nav.SubItem>
      </Nav.Category>
    </>
  );
}

describe('Nav callback details (nav-4)', () => {
  it('onValueChange reports the click and the category of the item, undefined at the top', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Nav defaultOpenCategories={['docs']} onValueChange={onValueChange}>
        <Parts />
      </Nav>,
    );
    await user.click(button('Home'));
    await user.click(button('Introduction'));
    const calls = onValueChange.mock.calls as Array<[string, NavSelectDetails]>;
    expect(calls.map(([value, details]) => [value, details.category])).toEqual([
      ['home', undefined],
      ['intro', 'docs'],
    ]);
    for (const [, details] of calls) {
      expect(details.event).toBeInstanceOf(Event);
      expect(details.event.type).toBe('click');
    }
    expect(calls[0][1]).toEqual({ event: expect.any(Event), category: undefined });
  });

  it('is called once per change in StrictMode, and not for a re-selection', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <Nav defaultValue="home" onValueChange={onValueChange}>
          <Parts />
        </Nav>
      </React.StrictMode>,
    );
    await user.click(button('Home'));
    expect(onValueChange).not.toHaveBeenCalled();
    await user.click(button('Home'));
    await user.click(button('Settings'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('onOpenCategoriesChange reports the toggled category, its new state and the click', async () => {
    const user = userEvent.setup();
    const onOpenCategoriesChange = vi.fn();
    render(
      <React.StrictMode>
        <Nav onOpenCategoriesChange={onOpenCategoriesChange}>
          <Parts />
        </Nav>
      </React.StrictMode>,
    );
    await user.click(toggle('Docs'));
    await user.click(toggle('Settings'));
    await user.click(toggle('Docs'));
    const calls = onOpenCategoriesChange.mock.calls as Array<[string[], NavCategoryToggleDetails]>;
    expect(calls.map(([open, { category, open: isOpen }]) => [open, category, isOpen])).toEqual([
      [['docs'], 'docs', true],
      [['docs', 'settings'], 'settings', true],
      [['settings'], 'docs', false],
    ]);
    expect(calls.every(([, { event }]) => event.type === 'click')).toBe(true);
  });

  it('a controlled Nav reports the details and stays as it is', async () => {
    const user = userEvent.setup();
    const onOpenCategoriesChange = vi.fn();
    const onValueChange = vi.fn();
    render(
      <Nav
        value="home"
        openCategories={[]}
        onOpenCategoriesChange={onOpenCategoriesChange}
        onValueChange={onValueChange}
      >
        <Parts />
      </Nav>,
    );
    await user.click(toggle('Docs'));
    expect(onOpenCategoriesChange).toHaveBeenCalledWith(
      ['docs'],
      expect.objectContaining({ category: 'docs', open: true }),
    );
    expect(toggle('Docs')).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps callbacks written for one argument working', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    render(
      <Nav
        onValueChange={(value) => seen.push(value)}
        onOpenCategoriesChange={(open) => seen.push(open.join('+'))}
      >
        <Parts />
      </Nav>,
    );
    await user.click(toggle('Docs'));
    await user.click(button('Introduction'));
    expect(seen).toEqual(['docs', 'intro']);
  });

  it('NavDrawer onItemSelect and onValueChange get the details; onItemSelect fires on a re-selection', async () => {
    const user = userEvent.setup();
    const onItemSelect = vi.fn();
    const onValueChange = vi.fn();
    render(
      <NavDrawer
        type="inline"
        defaultOpen
        defaultOpenCategories={['docs']}
        defaultValue="home"
        onItemSelect={onItemSelect}
        onValueChange={onValueChange}
      >
        <NavDrawer.Body>
          <Parts />
        </NavDrawer.Body>
      </NavDrawer>,
    );
    await user.click(button('Home'));
    await user.click(button('Introduction'));
    const select = onItemSelect.mock.calls as Array<[string, NavSelectDetails]>;
    expect(select.map(([value, { category }]) => [value, category])).toEqual([
      ['home', undefined],
      ['intro', 'docs'],
    ]);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(
      'intro',
      expect.objectContaining({ category: 'docs' }),
    );
  });

  it('has the documented types', () => {
    expectTypeOf<NavProps['onValueChange']>().toEqualTypeOf<
      ((value: string, details?: NavSelectDetails) => void) | undefined
    >();
    expectTypeOf<NavProps['onOpenCategoriesChange']>().toEqualTypeOf<
      ((openCategories: string[], details?: NavCategoryToggleDetails) => void) | undefined
    >();
    expectTypeOf<NavDrawerProps['onItemSelect']>().toEqualTypeOf<
      ((value: string, details?: NavSelectDetails) => void) | undefined
    >();
    expectTypeOf<NavSelectDetails>().toEqualTypeOf<{
      event: Event;
      category: string | undefined;
    }>();
    expectTypeOf<NavDensity>().toEqualTypeOf<'small' | 'medium'>();
    expectTypeOf<NavProps['multiple']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<NavProps['density']>().toEqualTypeOf<NavDensity | undefined>();
    expectTypeOf<NavDrawerProps['density']>().toEqualTypeOf<NavDensity | undefined>();
    expectTypeOf<NavDrawerProps['multiple']>().toEqualTypeOf<boolean | undefined>();
  });
});

describe('Nav multiple (nav-2)', () => {
  it('keeps several categories open by default', async () => {
    const user = userEvent.setup();
    render(
      <Nav>
        <Parts />
      </Nav>,
    );
    await user.click(toggle('Docs'));
    await user.click(toggle('Settings'));
    expect(toggle('Docs')).toHaveAttribute('aria-expanded', 'true');
    expect(toggle('Settings')).toHaveAttribute('aria-expanded', 'true');
  });

  it('with multiple={false} opening a category closes the one that was open', async () => {
    const user = userEvent.setup();
    const onOpenCategoriesChange = vi.fn();
    render(
      <Nav multiple={false} onOpenCategoriesChange={onOpenCategoriesChange}>
        <Parts />
      </Nav>,
    );
    await user.click(toggle('Docs'));
    await user.click(toggle('Settings'));
    expect(toggle('Docs')).toHaveAttribute('aria-expanded', 'false');
    expect(toggle('Settings')).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle('Settings'));
    expect(toggle('Settings')).toHaveAttribute('aria-expanded', 'false');
    expect(
      onOpenCategoriesChange.mock.calls.map(([open, details]) => [
        open,
        (details as NavCategoryToggleDetails).open,
      ]),
    ).toEqual([
      [['docs'], true],
      [['settings'], true],
      [[], false],
    ]);
  });

  it('starts with the first of several defaultOpenCategories, and of several found containing the current item', () => {
    const { unmount } = render(
      <Nav multiple={false} defaultOpenCategories={['settings', 'docs']}>
        <Parts />
      </Nav>,
    );
    expect(toggle('Settings')).toHaveAttribute('aria-expanded', 'true');
    expect(toggle('Docs')).toHaveAttribute('aria-expanded', 'false');
    unmount();
    render(
      <Nav multiple={false} defaultValue="guide">
        {/* Inline, not in a component of your own: the walk reads the elements it is given. */}
        <Nav.Category value="docs" label="Docs">
          <Nav.SubItem value="guide">Guide</Nav.SubItem>
        </Nav.Category>
        <Nav.Category value="settings" label="Settings">
          <Nav.SubItem value="guide2">Guide again</Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    expect(toggle('Docs')).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not trim a controlled openCategories: the next toggle replaces it', async () => {
    const user = userEvent.setup();
    const onOpenCategoriesChange = vi.fn();
    render(
      <Nav
        multiple={false}
        openCategories={['docs', 'settings']}
        onOpenCategoriesChange={onOpenCategoriesChange}
      >
        <Parts />
      </Nav>,
    );
    expect(toggle('Docs')).toHaveAttribute('aria-expanded', 'true');
    expect(toggle('Settings')).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle('Docs'));
    // Closing an open category removes only it.
    expect(onOpenCategoriesChange.mock.calls[0][0]).toEqual(['settings']);
  });

  it('applies to NavDrawer too', async () => {
    const user = userEvent.setup();
    render(
      <NavDrawer type="inline" defaultOpen multiple={false}>
        <NavDrawer.Body>
          <Parts />
        </NavDrawer.Body>
      </NavDrawer>,
    );
    await user.click(toggle('Docs'));
    await user.click(toggle('Settings'));
    expect(toggle('Docs')).toHaveAttribute('aria-expanded', 'false');
    expect(toggle('Settings')).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Nav density (nav-1)', () => {
  const entries = () => [button('Home'), button('Introduction'), toggle('Docs')];

  it('renders data-density, medium by default', () => {
    const { container } = render(
      <Nav>
        <Parts />
      </Nav>,
    );
    expect(container.querySelector('nav')).toHaveAttribute('data-density', 'medium');
  });

  it('keeps the classes of a medium row: 8px of padding on an item, 6px on a sub-item', () => {
    render(
      <Nav defaultOpenCategories={['docs']} density="medium">
        <Parts />
      </Nav>,
    );
    const [home, intro, docs] = entries();
    expect(home).toHaveClass('wave:py-2');
    expect(intro).toHaveClass('wave:py-1.5');
    expect(docs).toHaveClass('wave:py-2');
  });

  it('small sets every row shorter and replaces the medium padding', () => {
    const { container } = render(
      <Nav defaultOpenCategories={['docs']} density="small">
        <Parts />
      </Nav>,
    );
    expect(container.querySelector('nav')).toHaveAttribute('data-density', 'small');
    const [home, intro, docs] = entries();
    expect(home).toHaveClass('wave:py-1');
    expect(home).not.toHaveClass('wave:py-2');
    expect(intro).toHaveClass('wave:py-0.5');
    expect(intro).not.toHaveClass('wave:py-1.5');
    expect(docs).toHaveClass('wave:py-1');
    expect(docs).not.toHaveClass('wave:py-2');
  });

  it('a className of yours still wins over the density', () => {
    render(
      <Nav density="small">
        <Nav.Item value="home" className="py-3">
          Home
        </Nav.Item>
      </Nav>,
    );
    expect(button('Home')).toHaveClass('py-3');
    expect(button('Home')).not.toHaveClass('wave:py-1');
  });

  it('NavDrawer renders data-density on its nav and sets its rows', () => {
    render(
      <NavDrawer type="inline" defaultOpen density="small">
        <NavDrawer.Body>
          <Parts />
        </NavDrawer.Body>
      </NavDrawer>,
    );
    expect(screen.getByRole('navigation')).toHaveAttribute('data-density', 'small');
    expect(button('Home')).toHaveClass('wave:py-1');
  });

  it('has no axe violations in either density', async () => {
    const { rerender } = render(
      <Nav density="small">
        <Parts />
      </Nav>,
    );
    await expectNoA11yViolations(document.body);
    rerender(
      <Nav density="medium">
        <Parts />
      </Nav>,
    );
    await expectNoA11yViolations(document.body);
  });
});
