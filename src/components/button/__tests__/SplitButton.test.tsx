import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SplitButton } from '../SplitButton';
import type { SplitButtonMenuButtonProps, SplitButtonProps } from '../SplitButton';
import { Button } from '../Button';
import { MenuButton } from '../MenuButton';
import {
  asClientReference,
  testSystemProps,
  testFocusEvents,
  testNoImplicitSubmit,
  renderWithProviders,
} from '../../../test-utils';
import type { IconPosition, Size, Slot } from '../../../lib/types';
import { composeStories } from '@storybook/react';
import * as stories from '../../../../stories/SplitButton.stories';

/**
 * Elements that show an open popup (`aria-expanded="true"`) without controlling a rendered menu:
 * a story must not show the open state of a menu that does not exist.
 */
function expandedWithoutMenu(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[aria-expanded="true"]')).filter(
    (element) => {
      const controls = element.getAttribute('aria-controls');
      return !controls || document.getElementById(controls)?.getAttribute('role') !== 'menu';
    },
  );
}

/**
 * Local stand-in for the props `Menu.Trigger` passes to a render-prop child (spec §5.2, §5.9):
 * the unit tests never import P13's Menu. Only the stories block renders the real Menu, through
 * the `WithMenu` story that composes it.
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

/** The development warning of a `menuIcon` that renders nothing. */
const MENU_ICON_EMPTY_WARNING =
  '[WaveUI] SplitButton: `menuIcon` renders nothing, so the menu button shows the default chevron. Unlike `MenuButton`, a SplitButton always shows a menu indicator: pass an icon, or leave `menuIcon` unset.';

/** The development warning of a button passed as `menuIcon` (`kind` says which form). */
const menuIconButtonWarning = (kind: string) =>
  `[WaveUI] SplitButton: \`menuIcon\` received ${kind}; its children render as the glyph of the menu button and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. \`menuIcon={<MyIcon />}\`.`;

/** A Wave Button written in a Server Component: a lazy client reference (C-COMPOUND). */
const ClientButton = asClientReference(Button);

const SaveIcon = () => (
  <svg data-testid="save-icon" viewBox="0 0 16 16" width="16" height="16">
    <path d="M3 2h8l2 2v10H3z" fill="currentColor" />
  </svg>
);

describe('SplitButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  testSystemProps(SplitButton, {
    expectedTag: 'div',
    displayName: 'SplitButton',
    defaultProps: { children: 'Save' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
      { name: 'primary', props: { appearance: 'primary' } },
      { name: 'menu open', props: { menuButtonProps: { 'aria-expanded': true } } },
      { name: 'disabledFocusable', props: { disabledFocusable: true } },
      { name: 'with icon', props: { icon: <SaveIcon /> } },
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

  describe('per-half disabled and className', () => {
    it('menuButtonProps.disabled disables only the menu button; its className is merged', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onMenuClick = vi.fn();
      render(
        <SplitButton
          menuButtonProps={{ disabled: true, className: 'custom-menu' }}
          onClick={onClick}
          onMenuClick={onMenuClick}
        >
          Save
        </SplitButton>,
      );
      const primary = screen.getByRole('button', { name: 'Save' });
      const menu = screen.getByRole('button', { name: 'More options' });
      expect(menu).toBeDisabled();
      expect(menu).toHaveClass('custom-menu', 'rounded-s-none', 'opacity-50');
      expect(primary).toBeEnabled();
      expect(primary).not.toHaveClass('opacity-50');

      await user.click(menu);
      expect(onMenuClick).not.toHaveBeenCalled();
      await user.click(primary);
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('primaryActionButtonProps.disabled disables only the primary button', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onMenuClick = vi.fn();
      render(
        <SplitButton
          primaryActionButtonProps={{ disabled: true }}
          onClick={onClick}
          onMenuClick={onMenuClick}
        >
          Save
        </SplitButton>,
      );
      const primary = screen.getByRole('button', { name: 'Save' });
      const menu = screen.getByRole('button', { name: 'More options' });
      expect(primary).toBeDisabled();
      expect(primary).toHaveClass('opacity-50');
      expect(menu).toBeEnabled();
      expect(menu).not.toHaveClass('opacity-50');

      await user.click(primary);
      expect(onClick).not.toHaveBeenCalled();
      await user.click(menu);
      expect(onMenuClick).toHaveBeenCalledOnce();
    });

    it('a half-only disabled={false} does not enable a disabled SplitButton', () => {
      render(
        <SplitButton
          disabled
          primaryActionButtonProps={{ disabled: false }}
          menuButtonProps={{ disabled: false }}
        >
          Save
        </SplitButton>,
      );
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'More options' })).toBeDisabled();
    });
  });

  describe('icon and iconPosition (primary action)', () => {
    it.each([
      ['by default', undefined],
      ['with iconPosition="before"', 'before'],
    ] as const)('renders the icon before the label %s', (_name, iconPosition) => {
      render(
        <SplitButton icon={<SaveIcon />} iconPosition={iconPosition}>
          Save
        </SplitButton>,
      );
      const primary = screen.getByRole('button', { name: 'Save' });
      expect(primary.firstChild).toBe(screen.getByTestId('save-icon').parentElement);
      expect(primary.firstChild).toHaveAttribute('aria-hidden', 'true');
      expect(primary.lastChild?.textContent).toBe('Save');
    });

    it('renders the icon after the label with iconPosition="after"; the menu half is unchanged', () => {
      render(
        <SplitButton icon={<SaveIcon />} iconPosition="after">
          Save
        </SplitButton>,
      );
      const primary = screen.getByRole('button', { name: 'Save' });
      expect(primary.firstChild?.textContent).toBe('Save');
      expect(primary.lastChild).toBe(screen.getByTestId('save-icon').parentElement);
      const menu = screen.getByRole('button', { name: 'More options' });
      expect(menu.childNodes).toHaveLength(1);
      expect(menu.querySelector('[data-wave-icon="chevron-down"]')).not.toBeNull();
    });

    it('an icon-only primary action is named through primaryActionButtonProps', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <SplitButton
          icon={<SaveIcon />}
          primaryActionButtonProps={{ 'aria-label': 'Save' }}
          aria-label="Save options"
        />,
      );
      const primary = screen.getByRole('button', { name: 'Save' });
      expect(primary.childNodes).toHaveLength(1);
      expect(primary).toHaveClass('w-8', 'px-0');
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('menuIcon', () => {
    it('a custom menuIcon replaces the chevron, aria-hidden inside the menu half', () => {
      render(<SplitButton menuIcon={<span data-testid="menu-icon">▾</span>}>Save</SplitButton>);
      const menu = screen.getByRole('button', { name: 'More options' });
      const icon = screen.getByTestId('menu-icon');
      expect(menu).toContainElement(icon);
      expect(icon.parentElement).toHaveAttribute('aria-hidden', 'true');
      expect(menu.querySelector('svg')).toBeNull();
      expect(screen.getByRole('button', { name: 'Save' })).not.toContainElement(icon);
    });

    it('a slot object menuIcon keeps its classes and stays decorative', () => {
      render(
        <SplitButton
          menuIcon={{ children: <span data-testid="menu-icon">▾</span>, className: 'custom' }}
        >
          Save
        </SplitButton>,
      );
      const wrapper = screen.getByTestId('menu-icon').parentElement;
      expect(wrapper).toHaveClass('custom', 'shrink-0');
      expect(wrapper).toHaveAttribute('aria-hidden', 'true');
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
    ])('menuIcon={%s} keeps the chevron without a warning', (_name, menuIcon) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<SplitButton menuIcon={menuIcon}>Save</SplitButton>);
      const menu = screen.getByRole('button', { name: 'More options' });
      expect(menu.querySelector('svg')).toHaveAttribute('data-wave-icon', 'chevron-down');
      expect(warn).not.toHaveBeenCalled();
    });

    it('menuIcon={false} keeps the chevron and warns once, unlike MenuButton, which hides it', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <SplitButton menuIcon={false}>Save</SplitButton>
          <SplitButton menuIcon={false}>Share</SplitButton>
          <MenuButton menuIcon={false}>Actions</MenuButton>
        </>,
      );
      for (const menu of screen.getAllByRole('button', { name: 'More options' })) {
        expect(menu.querySelector('svg')).toHaveAttribute('data-wave-icon', 'chevron-down');
      }
      expect(screen.getByRole('button', { name: 'Actions' }).querySelector('svg')).toBeNull();
      expect(warn.mock.calls).toEqual([[MENU_ICON_EMPTY_WARNING]]);
    });

    it.each([
      ['true', true],
      ['an empty string', ''],
      ['an empty array', []],
      ['an empty Fragment', <></>],
    ])('menuIcon that renders nothing (%s) keeps the chevron and warns once', (_name, menuIcon) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<SplitButton menuIcon={menuIcon}>Save</SplitButton>);
      const menu = screen.getByRole('button', { name: 'More options' });
      expect(menu.querySelector('svg')).toHaveAttribute('data-wave-icon', 'chevron-down');
      // One decorative icon span (the chevron), no empty span next to it.
      expect(menu.childNodes).toHaveLength(1);
      expect(warn.mock.calls).toEqual([[MENU_ICON_EMPTY_WARNING]]);
    });

    describe('a button passed as menuIcon is unwrapped, never nested (C-SLOTS)', () => {
      it.each([
        [
          'a Wave Button element',
          <Button key="b" aria-label="Open" onClick={() => {}}>
            <svg data-testid="glyph" />
          </Button>,
          'a button element',
        ],
        [
          'a <button> element',
          <button key="n" type="button" aria-label="Open">
            <svg data-testid="glyph" />
          </button>,
          'a button element',
        ],
        [
          'a Wave Button written in a Server Component',
          <ClientButton key="c" aria-label="Open">
            <svg data-testid="glyph" />
          </ClientButton>,
          'a button element',
        ],
        [
          'a slot object whose `as` is a Wave Button',
          {
            as: Button,
            'aria-label': 'Open',
            children: <svg data-testid="glyph" />,
          } as Slot<'span'>,
          'a slot object that renders a button',
        ],
        [
          'a slot object whose `as` is "button"',
          {
            as: 'button',
            'aria-label': 'Open',
            children: <svg data-testid="glyph" />,
          } as Slot<'span'>,
          'a slot object that renders a button',
        ],
      ])(
        '%s: its children are the decorative glyph, its props are dropped, one warning',
        (_name, menuIcon, kind) => {
          const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
          const error = vi.spyOn(console, 'error').mockImplementation(() => {});
          render(
            <>
              <SplitButton menuIcon={menuIcon}>Save</SplitButton>
              <SplitButton menuIcon={menuIcon}>Share</SplitButton>
            </>,
          );
          expect(screen.getAllByRole('button')).toHaveLength(4);
          for (const menu of screen.getAllByRole('button', { name: 'More options' })) {
            expect(menu.querySelector('button')).toBeNull();
            const glyph = within(menu).getByTestId('glyph');
            expect(glyph.parentElement).toHaveAttribute('aria-hidden', 'true');
            expect(menu.querySelector('[data-wave-icon="chevron-down"]')).toBeNull();
          }
          expect(screen.queryByRole('button', { name: 'Open' })).toBeNull();
          expect(warn.mock.calls).toEqual([[menuIconButtonWarning(kind)]]);
          expect(error).not.toHaveBeenCalled();
        },
      );

      it('a button whose children render nothing keeps the chevron (its icon prop is dropped); only the button warning', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
          <SplitButton
            menuIcon={<Button icon={<svg data-testid="button-icon" />} aria-label="Open" />}
          >
            Save
          </SplitButton>,
        );
        const menu = screen.getByRole('button', { name: 'More options' });
        expect(menu.querySelector('button')).toBeNull();
        expect(menu.querySelector('svg')).toHaveAttribute('data-wave-icon', 'chevron-down');
        expect(screen.queryByTestId('button-icon')).toBeNull();
        expect(warn.mock.calls).toEqual([[menuIconButtonWarning('a button element')]]);
        expect(error).not.toHaveBeenCalled();
      });
    });
  });

  describe('disabledFocusable', () => {
    it('cascades to both halves: focusable, aria-disabled, no onClick or onMenuClick', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onMenuClick = vi.fn();
      render(
        <SplitButton disabledFocusable onClick={onClick} onMenuClick={onMenuClick}>
          Save
        </SplitButton>,
      );
      const primary = screen.getByRole('button', { name: 'Save' });
      const menu = screen.getByRole('button', { name: 'More options' });
      for (const half of [primary, menu]) {
        expect(half).not.toBeDisabled();
        expect(half).toHaveAttribute('aria-disabled', 'true');
        expect(half).toHaveAttribute('data-disabled', '');
        expect(half).toHaveAttribute('data-disabled-focusable', '');
        expect(half).toHaveClass('opacity-50', 'cursor-not-allowed');
      }

      await user.tab();
      expect(primary).toHaveFocus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      await user.tab();
      expect(menu).toHaveFocus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      await user.click(primary);
      await user.click(menu);
      expect(onClick).not.toHaveBeenCalled();
      expect(onMenuClick).not.toHaveBeenCalled();
    });

    it("a half's own disabledFocusable affects only that half", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onMenuClick = vi.fn();
      render(
        <SplitButton
          menuButtonProps={{ disabledFocusable: true }}
          onClick={onClick}
          onMenuClick={onMenuClick}
        >
          Save
        </SplitButton>,
      );
      const primary = screen.getByRole('button', { name: 'Save' });
      const menu = screen.getByRole('button', { name: 'More options' });
      expect(menu).toHaveAttribute('data-disabled-focusable', '');
      expect(primary).not.toHaveAttribute('aria-disabled');
      expect(primary).not.toHaveAttribute('data-disabled');
      await user.click(menu);
      expect(onMenuClick).not.toHaveBeenCalled();
      await user.click(primary);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("a root disabled with a half's disabledFocusable: that half is focusable, the other natively disabled", async () => {
      const user = userEvent.setup();
      render(
        <SplitButton disabled primaryActionButtonProps={{ disabledFocusable: true }}>
          Save
        </SplitButton>,
      );
      const primary = screen.getByRole('button', { name: 'Save' });
      const menu = screen.getByRole('button', { name: 'More options' });
      expect(primary).not.toBeDisabled();
      expect(primary).toHaveAttribute('data-disabled-focusable', '');
      expect(menu).toBeDisabled();
      expect(menu).not.toHaveAttribute('data-disabled-focusable');
      await user.tab();
      expect(primary).toHaveFocus();
      await user.tab();
      expect(menu).not.toHaveFocus();
    });

    it('the root disabledFocusable wins over a half disabled', () => {
      render(
        <SplitButton disabledFocusable menuButtonProps={{ disabled: true }}>
          Save
        </SplitButton>,
      );
      const menu = screen.getByRole('button', { name: 'More options' });
      expect(menu).not.toBeDisabled();
      expect(menu).toHaveAttribute('data-disabled-focusable', '');
    });
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
      expectTypeOf<SplitButtonProps['icon']>().toEqualTypeOf<Slot<'span'> | undefined>();
      expectTypeOf<SplitButtonProps['menuIcon']>().toEqualTypeOf<Slot<'span'> | undefined>();
      expectTypeOf<SplitButtonProps['iconPosition']>().toEqualTypeOf<IconPosition | undefined>();
      expectTypeOf<SplitButtonProps['disabledFocusable']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<SplitButtonMenuButtonProps['disabledFocusable']>().toEqualTypeOf<
        boolean | undefined
      >();
      const elements = [
        // @ts-expect-error href is not a <button> attribute
        <SplitButton key="1" menuButtonProps={{ href: '/menu' }} />,
        // @ts-expect-error the menu label is a string
        <SplitButton key="2" menuButtonLabel={42} />,
        // @ts-expect-error iconPosition is 'before' | 'after'
        <SplitButton key="3" iconPosition="end" />,
      ];
      expect(elements).toHaveLength(3);
    });
  });

  describe('stories (probe-menu-trigger-composition.5)', () => {
    const composed = composeStories(stories);

    it.each(Object.entries(composed))(
      '%s shows no open-menu state without a menu',
      (_name, Story) => {
        render(<Story />);
        expect(expandedWithoutMenu()).toEqual([]);
      },
    );

    it('WithMenu opens a real Menu from the chevron through the Menu.Trigger render-prop', async () => {
      const user = userEvent.setup();
      const { WithMenu } = composed;
      render(<WithMenu />);
      const primary = screen.getByRole('button', { name: 'Save' });
      const more = screen.getByRole('button', { name: 'More options' });
      expect(primary).not.toHaveAttribute('aria-haspopup');
      expect(more).toHaveAttribute('aria-haspopup', 'menu');
      expect(more).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();

      await user.click(primary);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();

      await user.click(more);
      const menu = screen.getByRole('menu', { name: 'More options' });
      expect(more).toHaveAttribute('aria-expanded', 'true');
      expect(more).toHaveAttribute('aria-controls', menu.id);
      expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
      expect(expandedWithoutMenu()).toEqual([]);

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(more).toHaveAttribute('aria-expanded', 'false');
      expect(more).toHaveFocus();
    });
  });
});
