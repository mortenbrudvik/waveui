import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FOCUSABLE_SELECTOR } from '../../../lib/focus';
import { renderToString } from 'react-dom/server';
import { Card, CardBody, CardFooter, CardHeader, CardPreview } from '../Card';
import type {
  CardBodyProps,
  CardFooterProps,
  CardHeaderOwnProps,
  CardHeaderProps,
  CardOwnProps,
  CardProps,
} from '../Card';
import {
  asClientReference,
  axe,
  expectNoA11yViolations,
  testCompoundExposure,
  testComposedHandler,
  testSystemProps,
} from '../../../test-utils';

const onSelectSpy = vi.fn();

const NESTED_INTERACTIVE_WARNING =
  '[WaveUI] Card: a selectable card (`onSelect`) is a button and must not contain focusable elements (buttons, links, inputs). Use `selectionControl="checkbox"` for cards with interactive content.';
const CHECKBOX_NAME_WARNING =
  '[WaveUI] Card: the selection checkbox has no accessible name. Render a `Card.Header` with a `title`, or pass `selectLabel`.';

/** The messages a `console.warn` spy received. */
const messagesOf = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map((call) => String(call[0]));

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
      // Held Space: the repeated keydowns are prevented too (no page scroll) and only arm.
      expect(fireEvent.keyDown(card, { key: ' ', repeat: true })).toBe(false);
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
      // A held Enter: the auto-repeated keydowns are still prevented but do not select again.
      expect(fireEvent.keyDown(card, { key: 'Enter', repeat: true })).toBe(false);
      expect(fireEvent.keyDown(card, { key: 'Enter', repeat: true })).toBe(false);
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
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
      expect(messagesOf(warn)).toEqual([NESTED_INTERACTIVE_WARNING]);
    });

    it('ignores events from nested links, inputs and focusable elements', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
      expect(messagesOf(warn)).toEqual([NESTED_INTERACTIVE_WARNING]);
    });

    it('warns once in development when the card contains tabbable elements', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <Card onSelect={() => {}}>{cardWithAction}</Card>
          <Card onSelect={() => {}}>{cardWithAction}</Card>
        </>,
      );
      expect(messagesOf(warn)).toEqual([NESTED_INTERACTIVE_WARNING]);
    });

    it('skips the tabbable-content scan once the warning has fired', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
      expect(messagesOf(warn)).toEqual([NESTED_INTERACTIVE_WARNING]);
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
      expect(messagesOf(warn)).toEqual([NESTED_INTERACTIVE_WARNING]);
    });

    it('does not warn when the card has no tabbable content', () => {
      const warn = vi.spyOn(console, 'warn');
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
      const warn = vi.spyOn(console, 'warn');
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
      expect(messagesOf(warn)).toEqual([CHECKBOX_NAME_WARNING]);
    });

    it('a title and subtitle that render nothing get no element, so the missing name warns', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Card onSelect={() => {}} selectionControl="checkbox">
          <CardHeader title={[]} subtitle={[null, [false]]} data-testid="header" />
        </Card>,
      );
      expect(screen.getByTestId('header')).toBeEmptyDOMElement();
      expect(messagesOf(warn)).toEqual([CHECKBOX_NAME_WARNING]);
    });

    it('a title and subtitle of 0 are content: the title element names the checkbox', () => {
      const warn = vi.spyOn(console, 'warn');
      render(
        <Card onSelect={() => {}} selectionControl="checkbox">
          <CardHeader title={0} subtitle={0} data-testid="header" />
        </Card>,
      );
      const checkbox = screen.getByRole('checkbox', { name: '0' });
      const title = document.getElementById(checkbox.getAttribute('aria-labelledby')!);
      expect(title).toHaveClass('text-subtitle-1');
      expect(screen.getByTestId('header').children).toHaveLength(2);
      expect(warn).not.toHaveBeenCalled();
    });

    it('passes axe with a footer Button (no nested-interactive)', async () => {
      render(
        <Card onSelect={() => {}} selected selectionControl="checkbox">
          {cardWithAction}
        </Card>,
      );
      await expectNoA11yViolations();
    });

    it('keeps a heading header outside any button (card mode puts it inside role="button")', async () => {
      const heading = (
        <CardHeader as="h3" title="Pro plan" subtitle="Billed monthly" data-testid="header" />
      );
      const { unmount } = render(
        <Card onSelect={() => {}} selectionControl="checkbox">
          {heading}
        </Card>,
      );
      const header = screen.getByTestId('header');
      expect(header.tagName).toBe('H3');
      // Not inside a button, whose children are presentational: heading navigation still finds it.
      expect(header.closest('[role="button"], button')).toBeNull();
      expect(screen.getByRole('checkbox', { name: 'Pro plan' })).toBeInTheDocument();
      await expectNoA11yViolations();
      unmount();

      // The documented trade-off of the default mode: the heading is content of the button.
      render(<Card onSelect={() => {}}>{heading}</Card>);
      expect(screen.getByTestId('header').closest('[role="button"]')).not.toBeNull();
    });

    it('the card mode with a footer Button is what the checkbox mode fixes (nested-interactive)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Card onSelect={() => {}}>{cardWithAction}</Card>);
      const results = await axe(document.body);
      expect(results.violations.map((violation) => violation.id)).toContain('nested-interactive');
      expect(messagesOf(warn)).toEqual([NESTED_INTERACTIVE_WARNING]);
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
        | 'selected'
        | 'onSelect'
        | 'selectionControl'
        | 'selectLabel'
        | 'appearance'
        | 'size'
        | 'orientation'
        | 'checkbox'
        | 'floatingAction'
      >();
      expectTypeOf<keyof CardHeaderOwnProps>().toEqualTypeOf<
        'title' | 'subtitle' | 'image' | 'action'
      >();
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
    conflictingClass: { className: 'p-8', overrides: 'p-[var(--wave-card-padding,1rem)]' },
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

  describe('appearances, sizes and orientation (0.13)', () => {
    const APPEARANCES = ['filled', 'filled-alternative', 'outline', 'subtle'] as const;
    const card = () => screen.getByTestId('card');

    it('renders data-appearance, data-size and data-orientation with their defaults', () => {
      render(<Card data-testid="card">x</Card>);
      expect(card()).toHaveAttribute('data-appearance', 'filled');
      expect(card()).toHaveAttribute('data-size', 'medium');
      expect(card()).toHaveAttribute('data-orientation', 'vertical');
    });

    it('the default look is the 0.12 look', () => {
      render(<Card data-testid="card">x</Card>);
      expect(card()).toHaveClass(
        'overflow-hidden',
        'rounded-md',
        'border',
        'border-border',
        'bg-card',
        'shadow-4',
      );
      expect(card().className).not.toMatch(/(^| )flex( |$)/);
    });

    it.each([
      ['filled-alternative', ['bg-muted'], ['shadow-4', 'bg-card']],
      ['outline', ['border-border', 'bg-transparent'], ['shadow-4', 'bg-card']],
      ['subtle', ['border-transparent', 'bg-transparent'], ['shadow-4', 'border-border']],
    ] as const)('the %s appearance', (appearance, has, hasNot) => {
      render(
        <Card data-testid="card" appearance={appearance}>
          x
        </Card>,
      );
      expect(card()).toHaveAttribute('data-appearance', appearance);
      expect(card()).toHaveClass(...has);
      for (const name of hasNot) expect(card()).not.toHaveClass(name);
    });

    it.each(APPEARANCES)(
      'a selected %s card has the selected look and a Highlight outline',
      (appearance) => {
        render(
          <Card data-testid="card" appearance={appearance} selected>
            x
          </Card>,
        );
        expect(card()).toHaveClass('border-primary', 'bg-selected', 'ring-1', 'ring-primary');
        expect(card()).toHaveClass('forced-colors:outline-[Highlight]');
      },
    );

    it.each([
      ['filled', 'not-disabled:not-aria-disabled:hover:shadow-8'],
      ['filled-alternative', 'not-disabled:not-aria-disabled:hover:bg-muted-hover'],
      ['outline', 'not-disabled:not-aria-disabled:hover:bg-subtle-hover'],
      ['subtle', 'not-disabled:not-aria-disabled:hover:bg-subtle-hover'],
    ] as const)('a selectable %s card gets the gated hover look %s', (appearance, hover) => {
      render(
        <Card data-testid="card" appearance={appearance} onSelect={() => {}}>
          x
        </Card>,
      );
      expect(card()).toHaveClass(hover);
    });

    it('a selectable filled-alternative, outline and subtle card also has a gated pressed fill', () => {
      const { rerender } = render(
        <Card data-testid="card" appearance="filled-alternative" onSelect={() => {}}>
          x
        </Card>,
      );
      expect(card()).toHaveClass('not-disabled:not-aria-disabled:active:bg-muted-pressed');
      rerender(
        <Card data-testid="card" appearance="subtle" onSelect={() => {}}>
          x
        </Card>,
      );
      expect(card()).toHaveClass('not-disabled:not-aria-disabled:active:bg-subtle-pressed');
    });

    it('a card that is not selectable, or is selected, has no hover look', () => {
      const { rerender } = render(<Card data-testid="card">x</Card>);
      expect(card().className).not.toContain('hover:');
      rerender(
        <Card data-testid="card" onSelect={() => {}} selected>
          x
        </Card>,
      );
      expect(card().className).not.toContain('hover:bg-');
    });

    it.each([
      ['small', '[--wave-card-padding:0.75rem]'],
      ['medium', '[--wave-card-padding:1rem]'],
      ['large', '[--wave-card-padding:1.25rem]'],
    ] as const)('the %s size sets the padding variable', (size, variable) => {
      render(
        <Card data-testid="card" size={size}>
          x
        </Card>,
      );
      expect(card()).toHaveAttribute('data-size', size);
      expect(card()).toHaveClass(variable);
    });

    it('Header, Body and Footer read the padding variable, with a fallback outside a Card', () => {
      render(
        <>
          <Card.Header data-testid="header" title="T" />
          <Card.Body data-testid="body">b</Card.Body>
          <Card.Footer data-testid="footer">f</Card.Footer>
        </>,
      );
      expect(screen.getByTestId('header')).toHaveClass('p-[var(--wave-card-padding,1rem)]');
      expect(screen.getByTestId('body')).toHaveClass('p-[var(--wave-card-padding,1rem)]', 'pt-0');
      expect(screen.getByTestId('footer')).toHaveClass('p-[var(--wave-card-padding,1rem)]', 'pt-0');
    });

    it('horizontal lays the parts out in a row', () => {
      render(
        <Card data-testid="card" orientation="horizontal">
          x
        </Card>,
      );
      expect(card()).toHaveAttribute('data-orientation', 'horizontal');
      expect(card()).toHaveClass('flex', 'flex-row');
    });

    it('is axe clean in every appearance, size and orientation', async () => {
      for (const appearance of APPEARANCES) {
        const { container, unmount } = render(
          <Card appearance={appearance} size="large" orientation="horizontal">
            <Card.Header title="Title" subtitle="Sub" />
            <Card.Body>Body</Card.Body>
          </Card>,
        );
        await expectNoA11yViolations(container);
        unmount();
      }
    });

    it('types the new props', () => {
      expectTypeOf<CardOwnProps['appearance']>().toEqualTypeOf<
        'filled' | 'filled-alternative' | 'outline' | 'subtle' | undefined
      >();
      expectTypeOf<CardOwnProps['size']>().toEqualTypeOf<
        'small' | 'medium' | 'large' | undefined
      >();
      expectTypeOf<CardOwnProps['orientation']>().toEqualTypeOf<
        'horizontal' | 'vertical' | undefined
      >();
    });
  });

  describe('Preview, header slots, checkbox slot and floating action (0.13)', () => {
    const card = () => screen.getByTestId('card');

    it('exposes Preview as a compound member and flat name', () => {
      expect(CardPreview).toBe(Card.Preview);
      expect(CardPreview.displayName).toBe('CardPreview');
    });

    it('server output of a Preview written in a Server Component equals the plain one', () => {
      const plain = (
        <Card>
          <Card.Preview logo="L">media</Card.Preview>
        </Card>
      );
      const client = (
        <Card>{React.createElement(asClientReference(Card.Preview), { logo: 'L' }, 'media')}</Card>
      );
      expect(renderToString(client)).toBe(renderToString(plain));
    });

    it('Preview is edge to edge: no padding, and it carries its stable class', () => {
      render(
        <Card>
          <Card.Preview data-testid="preview">media</Card.Preview>
        </Card>,
      );
      const preview = screen.getByTestId('preview');
      expect(preview).toHaveClass('wave-card-preview', 'overflow-hidden');
      expect(preview.className).not.toMatch(/(^| )p[xytblrse]?-/);
    });

    it('Preview fills the width of a vertical card and the height of a horizontal one', () => {
      const { rerender } = render(
        <Card>
          <Card.Preview data-testid="preview">media</Card.Preview>
        </Card>,
      );
      expect(screen.getByTestId('preview')).toHaveClass('w-full');
      rerender(
        <Card orientation="horizontal">
          <Card.Preview data-testid="preview">media</Card.Preview>
        </Card>,
      );
      expect(screen.getByTestId('preview')).toHaveClass('shrink-0', 'self-stretch');
    });

    it.each([
      ['a string', 'Logo'],
      ['an element', <b key="b">Logo</b>],
      ['an object', { children: 'Logo', className: 'custom-logo' }],
    ])('Preview renders a logo slot (%s) in its bottom start corner', (_label, logo) => {
      render(
        <Card>
          <Card.Preview data-testid="preview" logo={logo}>
            media
          </Card.Preview>
        </Card>,
      );
      const node = screen.getByTestId('preview').querySelector('.wave-card-preview__logo');
      expect(node).toHaveTextContent('Logo');
      expect(node).toHaveClass('absolute', 'start-3', 'bottom-3');
    });

    it('Preview renders no logo element for an empty slot', () => {
      render(
        <Card>
          <Card.Preview data-testid="preview" logo={[]}>
            media
          </Card.Preview>
        </Card>,
      );
      expect(screen.getByTestId('preview').querySelector('.wave-card-preview__logo')).toBeNull();
    });

    it('Preview takes a polymorphic element', () => {
      render(
        <Card>
          <Card.Preview as="figure" data-testid="preview">
            media
          </Card.Preview>
        </Card>,
      );
      expect(screen.getByTestId('preview').tagName).toBe('FIGURE');
    });

    it('Header without image or action renders as in 0.12: no grid and no wrapper', () => {
      render(<Card.Header data-testid="header" title="T" subtitle="S" />);
      const header = screen.getByTestId('header');
      expect(header.className).not.toContain('grid');
      expect(header.firstElementChild).toHaveClass('wave-card-header__title');
    });

    it('Header lays out an image, the text and an action', () => {
      render(
        <Card.Header
          data-testid="header"
          title="T"
          subtitle="S"
          image={<i data-testid="image" />}
          action={<button type="button">Menu</button>}
        />,
      );
      const header = screen.getByTestId('header');
      expect(header).toHaveClass('grid');
      expect(header.querySelector('.wave-card-header__image')).toContainElement(
        screen.getByTestId('image'),
      );
      expect(header.querySelector('.wave-card-header__action')).toContainElement(
        screen.getByRole('button', { name: 'Menu' }),
      );
      expect(header.querySelector('.wave-card-header__text')).toHaveTextContent('TS');
    });

    it('Header slots that render nothing leave the 0.12 layout', () => {
      render(<Card.Header data-testid="header" title="T" image={[]} action="" />);
      expect(screen.getByTestId('header').className).not.toContain('grid');
    });

    it('a checkbox card with image and action still names the checkbox by the title', () => {
      render(
        <Card selectionControl="checkbox" onSelect={() => {}}>
          <Card.Header
            title="Quarterly report"
            image={<i />}
            action={<button type="button">Menu</button>}
          />
        </Card>,
      );
      expect(screen.getByRole('checkbox', { name: 'Quarterly report' })).toBeInTheDocument();
    });

    it('the checkbox slot merges an object onto the built-in checkbox', () => {
      render(
        <Card
          selectionControl="checkbox"
          onSelect={() => {}}
          selectLabel="Pick"
          checkbox={{ className: 'custom-box', 'aria-describedby': 'hint', name: 'picked' }}
        >
          x
        </Card>,
      );
      const box = screen.getByRole('checkbox', { name: 'Pick' });
      expect(box).toHaveClass('custom-box', 'wave-card__checkbox');
      expect(box).toHaveAttribute('aria-describedby', 'hint');
      expect(box).toHaveAttribute('name', 'picked');
      expect(box).toHaveAttribute('type', 'checkbox');
    });

    it('checkbox={null} removes the built-in control, with no role on the card and no warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Card data-testid="card" selectionControl="checkbox" onSelect={() => {}} checkbox={null}>
          x
        </Card>,
      );
      expect(screen.queryByRole('checkbox')).toBeNull();
      expect(card()).not.toHaveAttribute('role');
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('a checkbox element replaces the built-in control', () => {
      render(
        <Card
          selectionControl="checkbox"
          onSelect={() => {}}
          checkbox={<input type="checkbox" aria-label="Mine" />}
        >
          x
        </Card>,
      );
      expect(screen.getAllByRole('checkbox')).toHaveLength(1);
      expect(screen.getByRole('checkbox', { name: 'Mine' })).toBeInTheDocument();
    });

    it('the checkbox slot is ignored without the checkbox selection control', () => {
      render(
        <Card data-testid="card" onSelect={() => {}} checkbox={{ className: 'custom-box' }}>
          x
        </Card>,
      );
      expect(screen.queryByRole('checkbox')).toBeNull();
    });

    it('floatingAction renders at the top end corner and positions the card', () => {
      render(
        <Card data-testid="card" floatingAction={<button type="button">More</button>}>
          x
        </Card>,
      );
      const slot = card().querySelector('.wave-card__floating-action');
      expect(slot).toHaveClass('absolute', 'end-3', 'top-3');
      expect(card()).toHaveClass('relative');
      expect(slot).toContainElement(screen.getByRole('button', { name: 'More' }));
    });

    it('floatingAction that renders nothing renders no element', () => {
      render(
        <Card data-testid="card" floatingAction={[]}>
          x
        </Card>,
      );
      expect(card().querySelector('.wave-card__floating-action')).toBeNull();
      expect(card().className).not.toMatch(/(^| )relative( |$)/);
    });

    it('with a floating action the checkbox moves to the top start corner and the header pads for it', () => {
      render(
        <Card
          data-testid="card"
          selectionControl="checkbox"
          onSelect={() => {}}
          floatingAction={<button type="button">More</button>}
        >
          <Card.Header data-testid="header" title="T" />
        </Card>,
      );
      const box = screen.getByRole('checkbox', { name: 'T' });
      expect(box).toHaveClass('start-3', 'top-3');
      expect(box.className).not.toContain('end-3');
      expect(screen.getByTestId('header')).toHaveClass('ps-10', 'pe-10');
    });

    it('without a floating action the checkbox keeps the top end corner', () => {
      render(
        <Card selectionControl="checkbox" onSelect={() => {}}>
          <Card.Header title="T" />
        </Card>,
      );
      expect(screen.getByRole('checkbox', { name: 'T' })).toHaveClass('end-3', 'top-3');
    });

    it('is axe clean with the new parts and slots', async () => {
      const { container } = render(
        <Card
          selectionControl="checkbox"
          onSelect={() => {}}
          floatingAction={<button type="button">More</button>}
        >
          <Card.Preview logo={<span>L</span>}>
            <img alt="Cover" src="data:," />
          </Card.Preview>
          <Card.Header
            title="Title"
            subtitle="Sub"
            image={<i aria-hidden="true" />}
            action={<button type="button">Open menu</button>}
          />
          <Card.Body>Body</Card.Body>
        </Card>,
      );
      await expectNoA11yViolations(container);
    });
  });
});
