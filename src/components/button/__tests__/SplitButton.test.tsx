import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SplitButton } from '../SplitButton';
import type { SplitButtonMenuButtonProps, SplitButtonProps } from '../SplitButton';
import {
  testSystemProps,
  testFocusEvents,
  testNoImplicitSubmit,
  renderWithProviders,
} from '../../../test-utils';
import type { Size } from '../../../lib/types';

/**
 * Local stand-in for the props `Menu.Trigger` passes to a render-prop child (spec §5.2, §5.9):
 * P01 tests never import P13's Menu.
 */
function createTriggerProps() {
  const ref = React.createRef<HTMLButtonElement>();
  return {
    ref,
    props: {
      id: 'save-menu-trigger',
      'aria-haspopup': 'menu' as const,
      'aria-expanded': true,
      'aria-controls': 'save-menu',
      onClick: vi.fn(),
      onKeyDown: vi.fn(),
      ref,
    },
  };
}

const PHYSICAL = /(^|:)-?(ml|mr|pl|pr|left|right)-|(^|:)(border|rounded)-(l|r|tl|tr|bl|br)(\b|-)/;

describe('SplitButton', () => {
  testSystemProps(SplitButton, {
    expectedTag: 'div',
    displayName: 'SplitButton',
    defaultProps: { children: 'Save' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
      { name: 'primary', props: { appearance: 'primary' } },
      { name: 'menu open', props: { menuButtonProps: { 'aria-expanded': true } } },
    ],
  });

  testFocusEvents(SplitButton, { children: 'Save' }, 'button');

  testNoImplicitSubmit(SplitButton, { defaultProps: { children: 'Save' } });

  it('renders a group with the primary action and the menu button, named by role', () => {
    render(<SplitButton aria-label="Save options">Save</SplitButton>);
    const group = screen.getByRole('group', { name: 'Save options' });
    const primary = screen.getByRole('button', { name: 'Save' });
    const menu = screen.getByRole('button', { name: 'More options' });
    expect(group).toContainElement(primary);
    expect(group).toContainElement(menu);
    expect(screen.getAllByRole('button')).toEqual([primary, menu]);
  });

  it('both halves are type="button" (button-provider#1)', () => {
    render(<SplitButton>Save</SplitButton>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'More options' })).toHaveAttribute('type', 'button');
  });

  it('the menu button has aria-haspopup="menu" and a decorative shared chevron', () => {
    render(<SplitButton>Save</SplitButton>);
    const menu = screen.getByRole('button', { name: 'More options' });
    expect(menu).toHaveAttribute('aria-haspopup', 'menu');
    const svg = menu.querySelector('svg');
    expect(svg).toHaveAttribute('data-wave-icon', 'chevron-down');
    expect(svg?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('calls onClick for the primary button only', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onMenuClick = vi.fn();
    render(
      <SplitButton onClick={onClick} onMenuClick={onMenuClick}>
        Save
      </SplitButton>,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onMenuClick).not.toHaveBeenCalled();
  });

  it('calls onMenuClick for the menu button only', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onMenuClick = vi.fn();
    render(
      <SplitButton onClick={onClick} onMenuClick={onMenuClick}>
        Save
      </SplitButton>,
    );
    await user.click(screen.getByRole('button', { name: 'More options' }));
    expect(onMenuClick).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disables both buttons when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onMenuClick = vi.fn();
    render(
      <SplitButton disabled onClick={onClick} onMenuClick={onMenuClick}>
        Save
      </SplitButton>,
    );
    const primary = screen.getByRole('button', { name: 'Save' });
    const menu = screen.getByRole('button', { name: 'More options' });
    for (const button of [primary, menu]) {
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
      await user.click(button);
    }
    expect(onClick).not.toHaveBeenCalled();
    expect(onMenuClick).not.toHaveBeenCalled();
  });

  describe('menu button pass-through (button-provider#13)', () => {
    it('menuButtonLabel names the menu button', () => {
      render(<SplitButton menuButtonLabel="Weitere Optionen">Speichern</SplitButton>);
      expect(screen.getByRole('button', { name: 'Weitere Optionen' })).toHaveAttribute(
        'aria-haspopup',
        'menu',
      );
      expect(screen.queryByRole('button', { name: 'More options' })).toBeNull();
    });

    it('menuButtonProps: aria-expanded, aria-controls, onKeyDown, aria-label and ref land on the menu button', () => {
      const ref = React.createRef<HTMLButtonElement>();
      const onKeyDown = vi.fn();
      render(
        <>
          <ul id="save-menu" aria-label="Save as">
            <li>Draft</li>
          </ul>
          <SplitButton
            menuButtonProps={{
              'aria-expanded': true,
              'aria-controls': 'save-menu',
              'aria-label': 'Save as',
              onKeyDown,
              ref,
              'data-testid': 'chevron',
            }}
          >
            Save
          </SplitButton>
        </>,
      );
      const menu = screen.getByRole('button', { name: 'Save as' });
      expect(menu).toHaveAttribute('aria-expanded', 'true');
      expect(menu).toHaveAttribute('aria-controls', 'save-menu');
      expect(menu).toHaveAttribute('data-testid', 'chevron');
      expect(ref.current).toBe(menu);
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      expect(onKeyDown).toHaveBeenCalledTimes(1);
      // Nothing leaked onto the group or the primary button.
      expect(screen.getByRole('group')).not.toHaveAttribute('aria-expanded');
      expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('aria-expanded');
    });

    it('menuButtonProps.onClick composes with onMenuClick (consumer first)', async () => {
      const user = userEvent.setup();
      const order: string[] = [];
      render(
        <SplitButton
          onMenuClick={() => order.push('onMenuClick')}
          menuButtonProps={{ onClick: () => order.push('menuButtonProps') }}
        >
          Save
        </SplitButton>,
      );
      await user.click(screen.getByRole('button', { name: 'More options' }));
      expect(order).toEqual(['menuButtonProps', 'onMenuClick']);
    });

    it('primaryActionButtonProps land on the primary button and compose with onClick', async () => {
      const user = userEvent.setup();
      const ref = React.createRef<HTMLButtonElement>();
      const order: string[] = [];
      render(
        <SplitButton
          onClick={() => order.push('onClick')}
          primaryActionButtonProps={{
            ref,
            title: 'Save the document',
            onClick: () => order.push('primaryActionButtonProps'),
            className: 'custom-primary',
          }}
        >
          Save
        </SplitButton>,
      );
      const primary = screen.getByRole('button', { name: 'Save' });
      expect(ref.current).toBe(primary);
      expect(primary).toHaveAttribute('title', 'Save the document');
      expect(primary).toHaveClass('custom-primary', 'rounded-e-none');
      await user.click(primary);
      expect(order).toEqual(['primaryActionButtonProps', 'onClick']);
    });

    it('works with the Menu.Trigger render-prop props (feedback-navigation#51, spec §5.2)', async () => {
      const user = userEvent.setup();
      const onMenuClick = vi.fn();
      const { ref, props } = createTriggerProps();
      render(
        <SplitButton menuButtonProps={props} onMenuClick={onMenuClick}>
          Save
        </SplitButton>,
      );
      const menu = screen.getByRole('button', { name: 'More options' });
      expect(menu).toHaveAttribute('id', 'save-menu-trigger');
      expect(menu).toHaveAttribute('aria-haspopup', 'menu');
      expect(menu).toHaveAttribute('aria-expanded', 'true');
      expect(menu).toHaveAttribute('aria-controls', 'save-menu');
      expect(ref.current).toBe(menu);
      await user.click(menu);
      expect(props.onClick).toHaveBeenCalledTimes(1);
      expect(onMenuClick).toHaveBeenCalledTimes(1);
      fireEvent.keyDown(menu, { key: 'ArrowUp' });
      expect(props.onKeyDown).toHaveBeenCalledTimes(1);
    });
  });

  describe('prop routing (overlays#5)', () => {
    it('routes aria-describedby from the root to the primary button', () => {
      render(
        <>
          <span id="save-hint">Saves a draft</span>
          <SplitButton aria-describedby="save-hint">Save</SplitButton>
        </>,
      );
      expect(screen.getByRole('button', { name: 'Save' })).toHaveAccessibleDescription(
        'Saves a draft',
      );
      expect(screen.getByRole('group')).not.toHaveAttribute('aria-describedby');
      expect(screen.getByRole('button', { name: 'More options' })).not.toHaveAttribute(
        'aria-describedby',
      );
    });

    it('joins a routed aria-describedby with the one from primaryActionButtonProps', () => {
      render(
        <>
          <span id="tooltip">Tooltip</span>
          <span id="hint">Hint</span>
          <SplitButton
            aria-describedby="tooltip"
            primaryActionButtonProps={{ 'aria-describedby': 'hint' }}
          >
            Save
          </SplitButton>
        </>,
      );
      expect(
        screen.getByRole('button', { name: 'Save' }).getAttribute('aria-describedby')?.split(' '),
      ).toEqual(expect.arrayContaining(['tooltip', 'hint']));
    });

    it('keeps aria-label, data attributes, className and ref on the group', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <SplitButton ref={ref} aria-label="Save options" className="custom" data-testid="split">
          Save
        </SplitButton>,
      );
      const group = screen.getByRole('group', { name: 'Save options' });
      expect(ref.current).toBe(group);
      expect(group).toHaveClass('custom', 'inline-flex');
      expect(group).toHaveAttribute('data-testid', 'split');
    });

    it('a forwarded role={undefined} keeps role="group"; a defined role wins', () => {
      const { rerender } = render(
        <SplitButton aria-label="Save options" role={undefined}>
          Save
        </SplitButton>,
      );
      expect(screen.getByRole('group', { name: 'Save options' })).toBeInTheDocument();
      rerender(
        <SplitButton aria-label="Save options" role="toolbar">
          Save
        </SplitButton>,
      );
      expect(screen.getByRole('toolbar', { name: 'Save options' })).toBeInTheDocument();
    });
  });

  describe('styles (button-provider#3, #10, #19, #22, repo-level#7)', () => {
    const chevronPadding: Record<Size, string> = {
      'extra-small': 'px-1.5',
      small: 'px-1.5',
      medium: 'px-2',
      large: 'px-2',
      'extra-large': 'px-3',
    };

    it.each(Object.keys(chevronPadding) as Size[])(
      'the %s menu button target is at least 24x24 CSS px (button-provider#22)',
      (size) => {
        render(<SplitButton size={size}>Save</SplitButton>);
        const menu = screen.getByRole('button', { name: 'More options' });
        expect(menu).toHaveClass('min-w-6', 'min-h-6', chevronPadding[size]);
        // No fixed square width and no narrower padding left over from the icon-only sizing.
        for (const cls of ['w-5', 'w-6', 'w-8', 'px-0', 'px-0.5', 'px-1']) {
          expect(menu).not.toHaveClass(cls);
        }
        // Both halves share the height, so the primary half matches at extra-small.
        expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('min-h-6');
      },
    );

    it('uses logical corners and separator (no physical utilities), also in RTL', () => {
      renderWithProviders(<SplitButton>Save</SplitButton>, { dir: 'rtl' });
      const primary = screen.getByRole('button', { name: 'Save' });
      const menu = screen.getByRole('button', { name: 'More options' });
      expect(primary.closest('[dir]')).toHaveAttribute('dir', 'rtl');
      expect(primary).toHaveClass('rounded-e-none', 'border-e-0');
      expect(menu).toHaveClass('rounded-s-none', 'border-s-stroke');
      for (const el of [primary, menu, screen.getByRole('group')]) {
        expect(Array.from(el.classList).filter((c) => PHYSICAL.test(c))).toEqual([]);
      }
    });

    it('primary: token colors, a primary-foreground separator and gated hover (no raw colors)', () => {
      render(<SplitButton appearance="primary">Save</SplitButton>);
      const primary = screen.getByRole('button', { name: 'Save' });
      const menu = screen.getByRole('button', { name: 'More options' });
      for (const button of [primary, menu]) {
        expect(button).toHaveClass(
          'bg-primary',
          'text-primary-foreground',
          'not-disabled:not-aria-disabled:hover:bg-primary-hover',
          'not-disabled:not-aria-disabled:active:bg-primary-pressed',
        );
        expect(Array.from(button.classList).filter((c) => /\[(#|rgba?\()/.test(c))).toEqual([]);
      }
      expect(menu).toHaveClass('border-s-primary-foreground/30');
    });

    it('outline uses the stroke token for its border and separator', () => {
      render(<SplitButton>Save</SplitButton>);
      expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('border-stroke');
      expect(screen.getByRole('button', { name: 'More options' })).toHaveClass(
        'border-stroke',
        'border-s-stroke',
      );
    });

    it('never uses the enabled: variant', () => {
      render(<SplitButton>Save</SplitButton>);
      for (const button of screen.getAllByRole('button')) {
        expect(Array.from(button.classList).filter((c) => c.includes('enabled:'))).toEqual([]);
      }
    });

    it('extra-large uses a larger font than large (button-provider#19)', () => {
      render(
        <>
          <SplitButton size="large">Large</SplitButton>
          <SplitButton size="extra-large">Extra large</SplitButton>
        </>,
      );
      expect(screen.getByRole('button', { name: 'Large' })).toHaveClass('text-body-2');
      const xl = screen.getByRole('button', { name: 'Extra large' });
      expect(xl).toHaveClass('text-[18px]/[24px]');
      expect(xl).not.toHaveClass('text-sm');
    });
  });

  describe('types (button-provider#13, #27)', () => {
    it('SplitButtonProps carries ref; the half props accept button attributes and ref', () => {
      expectTypeOf<SplitButtonProps['ref']>().toEqualTypeOf<
        React.Ref<HTMLDivElement> | undefined
      >();
      expectTypeOf<SplitButtonMenuButtonProps['ref']>().toEqualTypeOf<
        React.Ref<HTMLButtonElement> | undefined
      >();
      expectTypeOf<SplitButtonProps['menuButtonProps']>().toEqualTypeOf<
        SplitButtonMenuButtonProps | undefined
      >();
      const elements = [
        // @ts-expect-error href is not a <button> attribute
        <SplitButton key="1" menuButtonProps={{ href: '/menu' }} />,
        // @ts-expect-error the menu label is a string
        <SplitButton key="2" menuButtonLabel={42} />,
      ];
      expect(elements).toHaveLength(2);
    });
  });
});
