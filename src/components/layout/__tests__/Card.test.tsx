import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FOCUSABLE_SELECTOR } from '../../../lib/focus';
import { Card, CardBody, CardFooter, CardHeader } from '../Card';
import type {
  CardBodyProps,
  CardFooterProps,
  CardHeaderOwnProps,
  CardHeaderProps,
  CardOwnProps,
  CardProps,
} from '../Card';
import {
  axe,
  expectNoA11yViolations,
  testCompoundExposure,
  testComposedHandler,
  testSystemProps,
} from '../../../test-utils';

const onSelectSpy = vi.fn();

/**
 * Runs `test` with a container inside an iframe's document, whose nodes belong to another realm
 * (like a popout window), then removes the iframe so `document.body` is empty again.
 */
function withIframeContainer(test: (container: HTMLElement) => void): void {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  try {
    const frameDocument = iframe.contentDocument;
    if (!frameDocument) throw new Error('the iframe has no document');
    const container = frameDocument.createElement('div');
    frameDocument.body.appendChild(container);
    test(container);
  } finally {
    iframe.remove();
  }
}

/** A selectable card whose footer contains an action button. */
const cardWithAction = (
  <>
    <CardHeader title="Pro plan" subtitle="Billed monthly" />
    <CardBody>Unlimited projects.</CardBody>
    <CardFooter>
      <button type="button">Details</button>
    </CardFooter>
  </>
);

describe('Card', () => {
  beforeEach(() => {
    onSelectSpy.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  testSystemProps(Card, {
    expectedTag: 'div',
    displayName: 'Card',
    polymorphic: true,
    defaultProps: { children: <CardHeader title="Starter plan" /> },
    conflictingClass: { className: 'rounded-xl', overrides: 'rounded-md' },
    a11yVariants: [
      { name: 'selectable, selected', props: { onSelect: () => {}, selected: true } },
      { name: 'selectable, not selected', props: { onSelect: () => {}, selected: false } },
      { name: 'selected, not selectable', props: { selected: true } },
      {
        name: 'checkbox selection with a footer button',
        props: {
          onSelect: () => {},
          selected: true,
          selectionControl: 'checkbox',
          children: cardWithAction,
        },
      },
    ],
  });

  testCompoundExposure(Card, ['Header', 'Body', 'Footer']);

  it('renders without crashing', () => {
    render(<Card data-testid="card">Content</Card>);
    expect(screen.getByTestId('card')).toHaveTextContent('Content');
  });

  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders as custom element', () => {
    render(
      <Card as="article" data-testid="card">
        Content
      </Card>,
    );
    expect(screen.getByTestId('card').tagName.toLowerCase()).toBe('article');
  });

  it('uses theme tokens and the Tailwind default radius (repo-level#7, button-provider#3)', () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('rounded-md', 'border', 'border-border', 'bg-card', 'shadow-4');
    expect(card).not.toHaveClass('rounded-lg');
    // A plain card keeps its 0.4 positioning; selectable/selected cards position their cue.
    expect(card).not.toHaveClass('relative');
  });

  it('positions the selection cue relative to a selectable card', () => {
    render(
      <Card onSelect={() => {}} data-testid="card">
        Content
      </Card>,
    );
    expect(screen.getByTestId('card')).toHaveClass('relative');
  });

  it('applies selected styling with tokens and a non-color cue (layout#35)', () => {
    render(
      <Card selected data-testid="card">
        Content
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('border-primary', 'bg-selected', 'text-selected-foreground');
    // A 1px border plus an inset 1px ring: a 2px border that does not rely on color alone.
    expect(card).toHaveClass('ring-1', 'ring-inset', 'ring-primary');
    expect(card).toHaveAttribute('data-selected', '');
    expect(card.className).not.toMatch(/\[#/);
    const glyph = card.querySelector('[data-wave-icon="check"]');
    expect(glyph).not.toBeNull();
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows no check glyph and no selected classes when not selected', () => {
    render(
      <Card selected={false} onSelect={() => {}} data-testid="card">
        Content
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card.querySelector('[data-wave-icon="check"]')).toBeNull();
    expect(card).not.toHaveClass('bg-selected');
    expect(card).not.toHaveAttribute('data-selected');
  });

  it('calls onSelect when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Card onSelect={onSelect} data-testid="card">
        Content
      </Card>,
    );
    await user.click(screen.getByTestId('card'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('has cursor-pointer when onSelect is provided', () => {
    render(
      <Card onSelect={() => {}} data-testid="card">
        Content
      </Card>,
    );
    expect(screen.getByTestId('card')).toHaveClass('cursor-pointer');
  });

  describe('selectionControl="card" (default, layout#35)', () => {
    it('is a focusable button with a focus ring when onSelect is given', () => {
      render(
        <Card onSelect={() => {}}>
          <CardHeader title="Pro plan" />
        </Card>,
      );
      const card = screen.getByRole('button', { name: 'Pro plan' });
      expect(card).toHaveAttribute('tabindex', '0');
      expect(card).toHaveClass(
        'focus-visible:outline-2',
        'focus-visible:outline-offset-2',
        'focus-visible:outline-ring',
      );
    });

    it('is not a widget without onSelect', () => {
      render(
        <Card data-testid="card">
          <CardHeader title="Pro plan" />
        </Card>,
      );
      expect(screen.queryByRole('button')).toBeNull();
      const card = screen.getByTestId('card');
      expect(card).not.toHaveAttribute('tabindex');
      expect(card).not.toHaveAttribute('role');
      expect(card).not.toHaveClass('cursor-pointer');
    });

    it('exposes selected as aria-pressed only when selected is defined', () => {
      const { rerender } = render(<Card onSelect={() => {}}>Plan</Card>);
      expect(screen.getByRole('button', { name: 'Plan' })).not.toHaveAttribute('aria-pressed');

      rerender(
        <Card onSelect={() => {}} selected>
          Plan
        </Card>,
      );
      expect(screen.getByRole('button', { name: 'Plan', pressed: true })).toBeInTheDocument();

      rerender(
        <Card onSelect={() => {}} selected={false}>
          Plan
        </Card>,
      );
      expect(screen.getByRole('button', { name: 'Plan', pressed: false })).toBeInTheDocument();
    });

    it('selects with Enter and Space from the keyboard', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <Card onSelect={onSelect}>
          <CardHeader title="Pro plan" />
        </Card>,
      );
      await user.tab();
      const card = screen.getByRole('button', { name: 'Pro plan' });
      expect(card).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(onSelect).toHaveBeenCalledTimes(1);

      await user.keyboard(' ');
      expect(onSelect).toHaveBeenCalledTimes(2);
    });

    it('prevents page scrolling on Space', () => {
      render(<Card onSelect={() => {}}>Plan</Card>);
      const card = screen.getByRole('button', { name: 'Plan' });
      card.focus();
      // fireEvent returns false when the handler called preventDefault().
      expect(fireEvent.keyDown(card, { key: ' ' })).toBe(false);
    });

    it('selects on the Space keyup, not the keydown, like a native button', () => {
      const onSelect = vi.fn();
      render(<Card onSelect={onSelect}>Plan</Card>);
      const card = screen.getByRole('button', { name: 'Plan' });
      card.focus();
      expect(fireEvent.keyDown(card, { key: ' ' })).toBe(false);
      // Held Space: repeated keydowns do not select either.
      fireEvent.keyDown(card, { key: ' ', repeat: true });
      expect(onSelect).not.toHaveBeenCalled();
      expect(fireEvent.keyUp(card, { key: ' ' })).toBe(false);
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('selects on the Enter keydown', () => {
      const onSelect = vi.fn();
      render(<Card onSelect={onSelect}>Plan</Card>);
      const card = screen.getByRole('button', { name: 'Plan' });
      card.focus();
      expect(fireEvent.keyDown(card, { key: 'Enter' })).toBe(false);
      expect(onSelect).toHaveBeenCalledTimes(1);
      fireEvent.keyUp(card, { key: 'Enter' });
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('does not select on a Space keyup without a preceding keydown', () => {
      const onSelect = vi.fn();
      render(<Card onSelect={onSelect}>Plan</Card>);
      const card = screen.getByRole('button', { name: 'Plan' });
      card.focus();
      fireEvent.keyUp(card, { key: ' ' });
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('cancels a Space press when focus moves away before the keyup', () => {
      const onSelect = vi.fn();
      render(
        <>
          <Card onSelect={onSelect}>Plan</Card>
          <button type="button">Elsewhere</button>
        </>,
      );
      const card = screen.getByRole('button', { name: 'Plan' });
      card.focus();
      fireEvent.keyDown(card, { key: ' ' });
      screen.getByRole('button', { name: 'Elsewhere' }).focus();
      card.focus();
      fireEvent.keyUp(card, { key: ' ' });
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('lets a consumer onKeyDown or onKeyUp preventDefault cancel a Space press', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const { rerender } = render(
        <Card onSelect={onSelect} onKeyDown={(event) => event.preventDefault()}>
          Plan
        </Card>,
      );
      screen.getByRole('button', { name: 'Plan' }).focus();
      await user.keyboard(' ');
      expect(onSelect).not.toHaveBeenCalled();

      const onKeyUp = vi.fn((event: React.KeyboardEvent<HTMLDivElement>) => event.preventDefault());
      rerender(
        <Card onSelect={onSelect} onKeyUp={onKeyUp}>
          Plan
        </Card>,
      );
      await user.keyboard(' ');
      expect(onKeyUp).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
      // The cancelled press left nothing armed: the next press selects once.
      rerender(<Card onSelect={onSelect}>Plan</Card>);
      await user.keyboard(' ');
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('ignores clicks and keys in content portaled out of the card', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <Card onSelect={onSelect}>
          Plan
          {createPortal(<input aria-label="Rename plan" />, document.body)}
        </Card>,
      );
      const input = screen.getByRole('textbox', { name: 'Rename plan' });
      input.focus();
      // Space and Enter keep their native meaning in the portaled input.
      expect(fireEvent.keyDown(input, { key: ' ' })).toBe(true);
      expect(fireEvent.keyUp(input, { key: ' ' })).toBe(true);
      expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(true);
      await user.click(input);
      await user.type(input, 'a b');
      expect(input).toHaveValue('a b');
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('selects in another document realm (a card rendered into an iframe document)', () => {
      withIframeContainer((container) => {
        const onSelect = vi.fn();
        const { unmount } = render(<Card onSelect={onSelect}>Plan</Card>, { container });
        const card = within(container).getByRole('button', { name: 'Plan' });
        // The iframe's nodes are not instances of the main realm's Node / Element.
        expect(card).not.toBeInstanceOf(Node);
        fireEvent.click(card);
        expect(onSelect).toHaveBeenCalledTimes(1);
        card.focus();
        fireEvent.keyDown(card, { key: 'Enter' });
        expect(onSelect).toHaveBeenCalledTimes(2);
        fireEvent.keyDown(card, { key: ' ' });
        fireEvent.keyUp(card, { key: ' ' });
        expect(onSelect).toHaveBeenCalledTimes(3);
        unmount();
      });
    });

    it('selects in another document realm reached through createPortal (a popout window)', () => {
      withIframeContainer((container) => {
        const onSelect = vi.fn();
        const onDetails = vi.fn();
        const { unmount } = render(
          createPortal(
            <Card onSelect={onSelect} selectionControl="checkbox">
              <CardHeader title="Pro plan" />
              <CardBody>Unlimited projects.</CardBody>
              <CardFooter>
                <button type="button" onClick={onDetails}>
                  Details
                </button>
              </CardFooter>
            </Card>,
            container,
          ),
        );
        fireEvent.click(within(container).getByText('Unlimited projects.'));
        expect(onSelect).toHaveBeenCalledTimes(1);
        // Nested controls of the other realm are still recognised as such.
        fireEvent.click(within(container).getByRole('button', { name: 'Details' }));
        expect(onDetails).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledTimes(1);
        unmount();
      });
    });

    it('ignores other keys', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<Card onSelect={onSelect}>Plan</Card>);
      screen.getByRole('button', { name: 'Plan' }).focus();
      await user.keyboard('a{ArrowDown}{Escape}');
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('fires onSelect exactly once per click and key press in StrictMode', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <React.StrictMode>
          <Card onSelect={onSelect}>Plan</Card>
        </React.StrictMode>,
      );
      const card = screen.getByRole('button', { name: 'Plan' });
      await user.click(card);
      expect(onSelect).toHaveBeenCalledTimes(1);
      await user.keyboard('{Enter}');
      expect(onSelect).toHaveBeenCalledTimes(2);
    });

    it('ignores clicks and Enter that start inside a nested interactive element', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onDetails = vi.fn();
      render(
        <Card onSelect={onSelect}>
          <CardHeader title="Pro plan" />
          <CardFooter>
            <button type="button" onClick={onDetails}>
              Details
            </button>
          </CardFooter>
        </Card>,
      );
      const details = screen.getByRole('button', { name: 'Details' });
      await user.click(details);
      expect(onDetails).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();

      details.focus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      expect(onDetails).toHaveBeenCalledTimes(3);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('ignores events from nested links, inputs and focusable elements', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <Card onSelect={onSelect}>
          <a href="#terms">Terms</a>
          <input aria-label="Seats" />
          <label>
            <input type="checkbox" /> Auto-renew
          </label>
          <span tabIndex={-1}>Focusable note</span>
        </Card>,
      );
      await user.click(screen.getByRole('link', { name: 'Terms' }));
      await user.click(screen.getByRole('textbox', { name: 'Seats' }));
      await user.keyboard(' ');
      await user.click(screen.getByText('Auto-renew'));
      expect(screen.getByRole('checkbox', { name: 'Auto-renew' })).toBeChecked();
      await user.click(screen.getByText('Focusable note'));
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('warns once in development when the card contains tabbable elements', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <Card onSelect={() => {}}>{cardWithAction}</Card>
          <Card onSelect={() => {}}>{cardWithAction}</Card>
        </>,
      );
      const messages = warn.mock.calls.map((call) => String(call[0]));
      const nested = messages.filter((message) => message.includes('selectionControl="checkbox"'));
      expect(nested).toHaveLength(1);
      expect(nested[0]).toMatch(/^\[WaveUI\] Card:/);
    });

    it('skips the tabbable-content scan once the warning has fired', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const querySelectorAll = vi.spyOn(Element.prototype, 'querySelectorAll');
      const scans = () =>
        querySelectorAll.mock.calls.filter(([selector]) => selector === FOCUSABLE_SELECTOR).length;
      const cards = (label: string) => (
        <>
          <Card onSelect={() => {}} aria-label={label}>
            {cardWithAction}
          </Card>
          <Card onSelect={() => {}}>{cardWithAction}</Card>
        </>
      );
      const { rerender } = render(cards('First'));
      // The first card scans and warns; the second one already skips.
      expect(scans()).toBe(1);
      querySelectorAll.mockClear();
      rerender(cards('Renamed'));
      expect(scans()).toBe(0);
    });

    it('keeps scanning a card without tabbable content, so late content still warns', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = render(
        <Card onSelect={() => {}}>
          <CardHeader title="Pro plan" />
        </Card>,
      );
      expect(warn).not.toHaveBeenCalled();
      rerender(<Card onSelect={() => {}}>{cardWithAction}</Card>);
      const messages = warn.mock.calls.map((call) => String(call[0]));
      expect(messages.filter((m) => m.includes('selectionControl="checkbox"'))).toHaveLength(1);
    });

    it('does not warn when the card has no tabbable content', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Card onSelect={() => {}}>
          <CardHeader title="Pro plan" />
          <CardBody>Unlimited projects.</CardBody>
        </Card>,
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it('as="button" relies on the native button (no role, type="button", one onSelect per Enter)', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <Card as="button" onSelect={onSelect}>
          Plan
        </Card>,
      );
      const card = screen.getByRole('button', { name: 'Plan' });
      expect(card.tagName).toBe('BUTTON');
      expect(card).not.toHaveAttribute('role');
      expect(card).toHaveAttribute('type', 'button');
      card.focus();
      await user.keyboard('{Enter}');
      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('composed handlers (layout#10)', () => {
    /**
     * `testComposedHandler` infers the handler names from the component's props; a polymorphic
     * component's generic props have no concrete `on*` keys, so the default-tag Card is wrapped.
     */
    const DivCard = (props: CardProps) => <Card {...props} />;
    DivCard.displayName = 'DivCard';

    testComposedHandler(DivCard, {
      handler: 'onClick',
      defaultProps: { onSelect: onSelectSpy, children: 'Plan' },
      act: async ({ user }) => {
        await user.click(screen.getByRole('button', { name: 'Plan' }));
      },
      assertInternal: () => expect(onSelectSpy).toHaveBeenCalledTimes(1),
      assertInternalSuppressed: () => expect(onSelectSpy).not.toHaveBeenCalled(),
    });

    testComposedHandler(DivCard, {
      handler: 'onKeyDown',
      defaultProps: { onSelect: onSelectSpy, children: 'Plan' },
      act: async ({ user }) => {
        screen.getByRole('button', { name: 'Plan' }).focus();
        await user.keyboard('{Enter}');
      },
      assertInternal: () => expect(onSelectSpy).toHaveBeenCalledTimes(1),
      assertInternalSuppressed: () => expect(onSelectSpy).not.toHaveBeenCalled(),
    });

    testComposedHandler(DivCard, {
      handler: 'onKeyUp',
      defaultProps: { onSelect: onSelectSpy, children: 'Plan' },
      act: async ({ user }) => {
        screen.getByRole('button', { name: 'Plan' }).focus();
        await user.keyboard(' ');
      },
      assertInternal: () => expect(onSelectSpy).toHaveBeenCalledTimes(1),
      assertInternalSuppressed: () => expect(onSelectSpy).not.toHaveBeenCalled(),
    });

    it('calls a consumer onKeyUp that does not preventDefault once; Space still selects once', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onKeyUp = vi.fn();
      render(
        <Card onSelect={onSelect} onKeyUp={onKeyUp}>
          Plan
        </Card>,
      );
      screen.getByRole('button', { name: 'Plan' }).focus();
      await user.keyboard(' ');
      expect(onKeyUp).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('calls a consumer onBlur on Tab away and still cancels an armed Space press', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      // preventDefault() on blur cannot keep a Space press armed: the cancel always runs.
      const onBlur = vi.fn((event: React.FocusEvent<HTMLDivElement>) => event.preventDefault());
      render(
        <>
          <Card onSelect={onSelect} onBlur={onBlur}>
            Plan
          </Card>
          <button type="button">Elsewhere</button>
        </>,
      );
      const card = screen.getByRole('button', { name: 'Plan' });
      card.focus();
      fireEvent.keyDown(card, { key: ' ' });
      await user.tab();
      expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
      expect(onBlur).toHaveBeenCalledTimes(1);
      card.focus();
      fireEvent.keyUp(card, { key: ' ' });
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('selectionControl="checkbox" (layout#35)', () => {
    it('renders a native checkbox labelled by the header title; the root is not a widget', () => {
      render(
        <Card onSelect={() => {}} selected selectionControl="checkbox" data-testid="card">
          {cardWithAction}
        </Card>,
      );
      const card = screen.getByTestId('card');
      expect(card).not.toHaveAttribute('role');
      expect(card).not.toHaveAttribute('tabindex');
      expect(card).not.toHaveAttribute('aria-pressed');
      const checkbox = screen.getByRole('checkbox', { name: 'Pro plan' });
      expect(checkbox.tagName).toBe('INPUT');
      expect(checkbox).toBeChecked();
      expect(checkbox).toHaveClass('focus-visible:outline-2', 'focus-visible:outline-ring');
      // The checkbox itself is the selected cue: no extra glyph.
      expect(card.querySelector('[data-wave-icon="check"]')).toBeNull();
    });

    it('reflects selected={false} and a missing selected as unchecked', () => {
      const { rerender } = render(
        <Card onSelect={() => {}} selected={false} selectionControl="checkbox">
          <CardHeader title="Pro plan" />
        </Card>,
      );
      expect(screen.getByRole('checkbox', { name: 'Pro plan' })).not.toBeChecked();
      rerender(
        <Card onSelect={() => {}} selectionControl="checkbox">
          <CardHeader title="Pro plan" />
        </Card>,
      );
      expect(screen.getByRole('checkbox', { name: 'Pro plan' })).not.toBeChecked();
    });

    it('uses selectLabel as the checkbox name', () => {
      render(
        <Card onSelect={() => {}} selectionControl="checkbox" selectLabel="Select the Pro plan">
          <CardHeader title="Pro plan" />
        </Card>,
      );
      expect(screen.getByRole('checkbox', { name: 'Select the Pro plan' })).toBeInTheDocument();
    });

    it('selects once from the checkbox (click and Space)', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <Card onSelect={onSelect} selectionControl="checkbox">
          {cardWithAction}
        </Card>,
      );
      const checkbox = screen.getByRole('checkbox', { name: 'Pro plan' });
      await user.click(checkbox);
      expect(onSelect).toHaveBeenCalledTimes(1);
      checkbox.focus();
      await user.keyboard(' ');
      expect(onSelect).toHaveBeenCalledTimes(2);
    });

    it('toggles on pointer clicks on non-interactive card areas', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <Card onSelect={onSelect} selectionControl="checkbox">
          {cardWithAction}
        </Card>,
      );
      await user.click(screen.getByText('Unlimited projects.'));
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('does not select from the footer button (click or Enter)', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <Card onSelect={onSelect} selectionControl="checkbox">
          {cardWithAction}
        </Card>,
      );
      const details = screen.getByRole('button', { name: 'Details' });
      await user.click(details);
      details.focus();
      await user.keyboard('{Enter}');
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('does not select from content portaled out of the card (footer menu, dialog)', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <Card onSelect={onSelect} selectionControl="checkbox">
          <CardHeader title="Pro plan" />
          <CardFooter>
            {createPortal(
              <div role="menu" aria-label="Plan actions">
                <div role="menuitem" tabIndex={-1}>
                  Delete
                </div>
                <p>Deleting cannot be undone.</p>
              </div>,
              document.body,
            )}
          </CardFooter>
        </Card>,
      );
      await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
      await user.click(screen.getByText('Deleting cannot be undone.'));
      expect(onSelect).not.toHaveBeenCalled();
      // A click on the card itself still toggles.
      await user.click(screen.getByText('Pro plan'));
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('does not warn about tabbable content', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Card onSelect={() => {}} selectionControl="checkbox">
          {cardWithAction}
        </Card>,
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it('warns in development when the checkbox has no name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Card onSelect={() => {}} selectionControl="checkbox">
          <CardBody>No header here.</CardBody>
        </Card>,
      );
      const messages = warn.mock.calls.map((call) => String(call[0]));
      expect(messages.some((message) => message.includes('selectLabel'))).toBe(true);
    });

    it('passes axe with a footer Button (no nested-interactive)', async () => {
      render(
        <Card onSelect={() => {}} selected selectionControl="checkbox">
          {cardWithAction}
        </Card>,
      );
      await expectNoA11yViolations();
    });

    it('the card mode with a footer Button is what the checkbox mode fixes (nested-interactive)', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Card onSelect={() => {}}>{cardWithAction}</Card>);
      const results = await axe(document.body);
      expect(results.violations.map((violation) => violation.id)).toContain('nested-interactive');
    });
  });

  describe('flat sub-component exports (repo-level#2, C-COMPOUND)', () => {
    it('exports every sub-component under its flat name', () => {
      expect(CardHeader).toBe(Card.Header);
      expect(CardBody).toBe(Card.Body);
      expect(CardFooter).toBe(Card.Footer);
    });
  });

  describe('types (button-provider#8, #27)', () => {
    it('type-checks props against the `as` element', () => {
      const anchorRef = React.createRef<HTMLAnchorElement>();
      const onAnchorClick = (event: React.MouseEvent<HTMLAnchorElement>) => event.preventDefault();
      render(
        <>
          <Card as="a" href="#plans" ref={anchorRef} onClick={onAnchorClick}>
            Plans
          </Card>
          <Card as="section" aria-label="Summary">
            <CardHeader as="h3" title="Title" />
          </Card>
        </>,
      );
      expect(anchorRef.current).toBe(screen.getByRole('link', { name: 'Plans' }));

      const elements = [
        // @ts-expect-error href does not exist on the default <div>
        <Card key="1" href="/nope" />,
        // @ts-expect-error selectionControl is 'card' | 'checkbox'
        <Card key="2" selectionControl="radio" />,
        // @ts-expect-error onSelect takes no event (0.4 signature)
        <Card key="3" onSelect={(value: string) => value} />,
        // @ts-expect-error href does not exist on the default <div>
        <CardFooter key="4" href="/nope" />,
      ];
      expect(elements).toHaveLength(4);
    });

    it('CardProps (0.4 name) is the default-tag props type, extendable, with ref (C-REF)', () => {
      interface TrackedCardProps extends CardProps {
        tracking?: string;
      }
      const TrackedCard = ({ tracking, ...props }: TrackedCardProps) => (
        <Card data-tracking={tracking} {...props} />
      );
      const ref = React.createRef<HTMLDivElement>();
      render(
        <TrackedCard ref={ref} tracking="plans">
          Plan
        </TrackedCard>,
      );
      expect(ref.current).toHaveAttribute('data-tracking', 'plans');

      expectTypeOf<CardProps>().toEqualTypeOf<CardProps<'div'>>();
      expectTypeOf<CardProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
      expectTypeOf<CardProps<'a'>>().toHaveProperty('href');
      expectTypeOf<CardHeaderProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
      expectTypeOf<CardBodyProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
      expectTypeOf<CardFooterProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
      expectTypeOf<keyof CardOwnProps>().toEqualTypeOf<
        'selected' | 'onSelect' | 'selectionControl' | 'selectLabel'
      >();
      expectTypeOf<keyof CardHeaderOwnProps>().toEqualTypeOf<'title' | 'subtitle'>();
      expectTypeOf<CardHeaderProps['title']>().toEqualTypeOf<React.ReactNode>();
    });
  });
});

describe('Card.Header', () => {
  testSystemProps(Card.Header, {
    expectedTag: 'div',
    displayName: 'CardHeader',
    polymorphic: true,
    defaultProps: { title: 'Header Title' },
  });

  it('renders title', () => {
    render(<Card.Header title="Header Title" />);
    expect(screen.getByText('Header Title')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<Card.Header title="Title" subtitle="Subtitle" />);
    expect(screen.getByText('Subtitle')).toHaveClass('text-caption-1', 'text-muted-foreground');
  });

  it('renders children', () => {
    render(<Card.Header>Custom content</Card.Header>);
    expect(screen.getByText('Custom content')).toBeInTheDocument();
  });
});

describe('Card.Body', () => {
  testSystemProps(Card.Body, {
    expectedTag: 'div',
    displayName: 'CardBody',
    polymorphic: true,
    defaultProps: { children: 'Body content' },
    conflictingClass: { className: 'p-8', overrides: 'p-4' },
  });

  it('renders children', () => {
    render(<Card.Body>Body content</Card.Body>);
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });
});

describe('Card.Footer', () => {
  testSystemProps(Card.Footer, {
    expectedTag: 'div',
    displayName: 'CardFooter',
    polymorphic: true,
    defaultProps: { children: 'Footer content' },
    conflictingClass: { className: 'justify-start', overrides: 'justify-end' },
  });

  it('renders children', () => {
    render(<Card.Footer>Footer content</Card.Footer>);
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });
});

describe('Card composition', () => {
  it('renders full card with header, body, and footer', () => {
    render(
      <Card data-testid="card">
        <Card.Header title="My Card" subtitle="Description" />
        <Card.Body>Body text</Card.Body>
        <Card.Footer>
          <button type="button">Action</button>
        </Card.Footer>
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card).toHaveTextContent('My Card');
    expect(card).toHaveTextContent('Description');
    expect(card).toHaveTextContent('Body text');
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });
});
