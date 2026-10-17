import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';
import {
  BUTTON_OWN_PROP_KEYS,
  MERGED_DISABLED_FOCUSABLE_PROPS,
  placeButtonIcon,
  unwrapButtonGlyph,
  withPartClass,
} from '../Button.slots';
import { renderSlot } from '../../../lib/slot';
import { asClientReference } from '../../../test-utils';
import type { Slot } from '../../../lib/types';

describe('Button.slots', () => {
  describe('BUTTON_OWN_PROP_KEYS', () => {
    it('lists `as` and every own prop of Button except the native `disabled`', () => {
      // The compiler checks the list against ButtonOwnProps; this pins what a merge drops.
      expect([...BUTTON_OWN_PROP_KEYS].sort()).toEqual([
        'appearance',
        'as',
        'disabledFocusable',
        'icon',
        'iconPosition',
        'size',
      ]);
      expect(BUTTON_OWN_PROP_KEYS.has('disabled')).toBe(false);
    });
  });

  describe('placeButtonIcon', () => {
    it.each([
      ['before by default', undefined, ['icon', 'label']],
      ['before', 'before', ['icon', 'label']],
      ['after', 'after', ['label', 'icon']],
    ])('places the icon %s the content', (_name, iconPosition, order) => {
      render(
        <button type="button">
          {placeButtonIcon(<span data-testid="icon" aria-hidden="true" />, 'Close', iconPosition)}
        </button>,
      );
      const button = screen.getByRole('button', { name: 'Close' });
      const childOrder = Array.from(button.childNodes).map((node) =>
        node.nodeType === Node.TEXT_NODE ? 'label' : 'icon',
      );
      expect(childOrder).toEqual(order);
    });
  });

  describe('MERGED_DISABLED_FOCUSABLE_PROPS', () => {
    it('makes a wired button unavailable but focusable and blocks its activation (it wins when spread last)', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onParentClick = vi.fn();
      const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
      // Typed as a component spreads it (every prop optional), after its own `disabled`/`onClick`.
      const merged: React.ComponentProps<'button'> = MERGED_DISABLED_FOCUSABLE_PROPS;
      render(
        <form onSubmit={onSubmit} aria-label="Form">
          <div onClick={onParentClick}>
            <button type="submit" disabled onClick={onClick} {...merged}>
              Close
            </button>
          </div>
        </form>,
      );
      const button = screen.getByRole('button', { name: 'Close' });
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('data-disabled', '');
      expect(button).toHaveAttribute('data-disabled-focusable', '');
      await user.tab();
      expect(button).toHaveFocus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      await user.click(button);
      expect(onClick).not.toHaveBeenCalled();
      expect(onParentClick).not.toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('unwrapButtonGlyph', () => {
    const glyph = <svg data-testid="glyph" />;
    const ClientButton = asClientReference(Button);

    it.each([
      ['a <button> element', <button type="button">{glyph}</button>, 'a button element'],
      ['a Wave Button element', <Button aria-label="Open">{glyph}</Button>, 'a button element'],
      [
        'a Wave Button written in a Server Component',
        <ClientButton aria-label="Open">{glyph}</ClientButton>,
        'a button element',
      ],
      [
        'a slot object whose `as` is "button"',
        { as: 'button', children: glyph } as Slot<'span'>,
        'a slot object that renders a button',
      ],
      [
        'a slot object whose `as` is a Wave Button',
        { as: Button, children: glyph } as Slot<'span'>,
        'a slot object that renders a button',
      ],
    ])('unwraps %s to its children', (_name, slot, button) => {
      expect(unwrapButtonGlyph(slot)).toEqual({ glyph, button });
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['false', false],
      ['text', '▾'],
      ['an icon element', glyph],
      ['a span element', <span>{glyph}</span>],
      ['an array', [glyph]],
      ['a slot object without `as`', { children: glyph, className: 'custom' }],
      ['a slot object with another `as`', { as: 'i', children: glyph }],
    ])('returns %s as the glyph, unchanged', (_name, slot) => {
      const result = unwrapButtonGlyph(slot as Slot<'span'>);
      expect(result.glyph).toBe(slot);
      expect(result.button).toBeNull();
    });
  });

  describe('withPartClass', () => {
    const part = 'wave-test-part';

    it('wraps shorthand content in a span that carries the class', () => {
      render(<>{renderSlot(withPartClass(<svg data-testid="glyph" />, part), 'span', 'base')}</>);
      const box = screen.getByTestId('glyph').parentElement;
      expect(box?.tagName).toBe('SPAN');
      expect(box?.className).toBe(`base ${part}`);
    });

    it("keeps a slot object's element, attributes, ref and own classes, the part class before its own", () => {
      const ref = React.createRef<HTMLElement>();
      const slot = {
        as: 'i',
        className: 'custom',
        title: 'Bold',
        ref,
        children: 'B',
      } as Slot<'span'>;
      render(<>{renderSlot(withPartClass(slot, part), 'span', 'base')}</>);
      const el = screen.getByTitle('Bold');
      expect(el.tagName).toBe('I');
      expect(el.className).toBe(`base ${part} custom`);
      expect(el).toHaveTextContent('B');
      expect(ref.current).toBe(el);
    });

    it('keeps the void element of a slot object, without children', () => {
      const slot = { as: 'img', src: 'data:,', alt: 'Logo' } as Slot<'span'>;
      render(<>{renderSlot(withPartClass(slot, part), 'span')}</>);
      expect(screen.getByRole('img', { name: 'Logo' })).toHaveClass(part);
    });

    it('applies twice without a second wrapper (a variant of a variant)', () => {
      const icon = withPartClass(
        withPartClass(<svg data-testid="glyph" />, 'wave-test-inner'),
        'wave-test-outer',
      );
      const { container } = render(<>{renderSlot(icon, 'span', 'base')}</>);
      const box = screen.getByTestId('glyph').parentElement;
      expect(box?.className).toBe('base wave-test-outer wave-test-inner');
      expect(box?.parentElement).toBe(container);
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['false', false],
      ["''", ''],
      ['[]', []],
      ['<></>', <></>],
    ])(
      'returns %s unchanged: it renders nothing, so no empty icon element appears',
      (_name, slot) => {
        expect(withPartClass(slot as Slot<'span'>, part)).toBe(slot);
      },
    );

    it('treats 0 as content', () => {
      const { container } = render(<>{renderSlot(withPartClass(0, part), 'span')}</>);
      expect(container.querySelector(`.${part}`)).toHaveTextContent('0');
    });

    it('reads a generator once, so a second render shows the same items', () => {
      function* glyphs() {
        yield <svg key="glyph" data-testid="generated-glyph" />;
      }
      const slot = withPartClass(glyphs(), part);
      const { rerender } = render(<>{renderSlot(slot, 'span')}</>);
      rerender(<>{renderSlot(slot, 'span')}</>);
      expect(screen.getByTestId('generated-glyph').parentElement).toHaveClass(part);
    });

    it("becomes a Button's decorative icon span, with the class", () => {
      render(<Button icon={withPartClass(<svg data-testid="glyph" />, part)}>Bold</Button>);
      const span = screen.getByTestId('glyph').parentElement;
      expect(span).toHaveClass(part);
      expect(span).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByRole('button', { name: 'Bold' })).toContainElement(span);
    });
  });
});
