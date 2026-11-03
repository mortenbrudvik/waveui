import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InteractionTag, InteractionTagPrimary } from '../InteractionTag';
import type { InteractionTagPrimaryProps } from '../InteractionTag';
import { TagGroup } from '../TagGroup';
import { interactionTagPrimaryClassNames } from '../../../lib/classNames';
import { expectNoA11yViolations, testSystemProps } from '../../../test-utils';

describe('InteractionTag.Primary as another element', () => {
  it('renders a link chip: an anchor with its href, the look and the stable class', async () => {
    const user = userEvent.setup();
    render(
      <InteractionTag value="docs">
        <InteractionTag.Primary as="a" href="#docs" icon={<span>i</span>}>
          Docs
        </InteractionTag.Primary>
      </InteractionTag>,
    );
    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '#docs');
    expect(link).not.toHaveAttribute('type');
    expect(link).toHaveClass(interactionTagPrimaryClassNames.root);
    await user.tab();
    expect(link).toHaveFocus();
  });

  it('a div gets the button role, a tab stop and Enter and Space activation', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <InteractionTag value="x">
        <InteractionTag.Primary as="div" onClick={onClick}>
          Chip
        </InteractionTag.Primary>
      </InteractionTag>,
    );
    const chip = screen.getByRole('button', { name: 'Chip' });
    expect(chip.tagName).toBe('DIV');
    await user.tab();
    expect(chip).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard('{ }');
    await user.click(chip);
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('toggles in a selecting TagGroup, as the button does', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <TagGroup aria-label="Chips" onValueChange={onValueChange}>
        <InteractionTag value="a">
          <InteractionTag.Primary as="div">A</InteractionTag.Primary>
        </InteractionTag>
      </TagGroup>,
    );
    const chip = screen.getByRole('button', { name: 'A' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('{Enter}');
    expect(onValueChange.mock.calls).toEqual([[['a']], [[]]]);
  });

  it('a disabled one is aria-disabled with tabIndex -1, its link without href, and calls nothing', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <InteractionTag value="x" disabled>
        <InteractionTag.Primary as="a" href="#x" onClick={onClick}>
          Docs
        </InteractionTag.Primary>
      </InteractionTag>,
    );
    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabindex', '-1');
    expect(link).not.toHaveAttribute('href');
    await user.click(link);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabledFocusable keeps a link in the Tab order without its href', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <InteractionTag value="x" disabledFocusable>
        <InteractionTag.Primary as="a" href="#x" onClick={onClick}>
          Docs
        </InteractionTag.Primary>
      </InteractionTag>,
    );
    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('data-disabled-focusable', '');
    expect(link).not.toHaveAttribute('href');
    await user.tab();
    expect(link).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('Delete on it clicks the Secondary, as on a button', async () => {
    const user = userEvent.setup();
    const onSecondary = vi.fn();
    render(
      <InteractionTag value="x">
        <InteractionTag.Primary as="a" href="#x">
          Docs
        </InteractionTag.Primary>
        <InteractionTag.Secondary onClick={onSecondary} />
      </InteractionTag>,
    );
    await user.tab();
    await user.keyboard('{Delete}');
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('renders a component of your own with the Primary props', () => {
    const Link = ({ to, ...props }: React.ComponentProps<'a'> & { to: string }) => (
      <a href={to} data-router="" {...props} />
    );
    render(
      <InteractionTag value="x">
        <InteractionTag.Primary as={Link} to="/docs">
          Docs
        </InteractionTag.Primary>
      </InteractionTag>,
    );
    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link).toHaveAttribute('data-router');
    expect(link).toHaveAttribute('href', '/docs');
  });

  it('keeps the button as the default, with type="button"', () => {
    render(
      <InteractionTag value="x">
        <InteractionTag.Primary>Chip</InteractionTag.Primary>
      </InteractionTag>,
    );
    expect(screen.getByRole('button', { name: 'Chip' })).toHaveAttribute('type', 'button');
  });

  it('has no axe violations as a link in a toolbar', async () => {
    render(
      <TagGroup aria-label="Links">
        <InteractionTag value="x">
          <InteractionTag.Primary as="a" href="#x">
            Docs
          </InteractionTag.Primary>
        </InteractionTag>
      </TagGroup>,
    );
    await expectNoA11yViolations();
  });

  it('types the props of the element it renders as', () => {
    expectTypeOf<InteractionTagPrimaryProps<'a'>['href']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<InteractionTagPrimaryProps['type']>().not.toBeAny();
    // @ts-expect-error an anchor has no `formAction`
    const anchor = <InteractionTag.Primary as="a" formAction="/x" />;
    // @ts-expect-error a button has no `href`
    const button = <InteractionTag.Primary href="/x" />;
    expect([anchor, button]).toHaveLength(2);
  });
});

testSystemProps(InteractionTagPrimary, {
  displayName: 'InteractionTagPrimary',
  expectedTag: 'button',
  polymorphic: true,
  defaultProps: { children: 'Chip' },
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <InteractionTag value="x">{children}</InteractionTag>
  ),
});
