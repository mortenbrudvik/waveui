import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuButton } from '../MenuButton';
import type { MenuButtonProps } from '../MenuButton';
import { buttonClassName } from '../buttonStyles';
import { testSystemProps, testFocusEvents, testNoImplicitSubmit } from '../../../test-utils';
import type { Appearance } from '../../../lib/types';

const APPEARANCES: Appearance[] = ['primary', 'outline', 'subtle', 'transparent'];

const GearIcon = () => (
  <svg data-testid="gear-icon" viewBox="0 0 16 16" width="16" height="16">
    <circle cx="8" cy="8" r="5" fill="currentColor" />
  </svg>
);

/**
 * Local stand-in for the props `Menu.Trigger` passes to its child (spec §5.2, §5.9): P01 tests
 * never import P13's Menu.
 */
function createTriggerProps(overrides: { expanded?: boolean } = {}) {
  const ref = React.createRef<HTMLButtonElement>();
  return {
    ref,
    props: {
      id: 'actions-trigger',
      'aria-haspopup': 'menu' as const,
      'aria-expanded': overrides.expanded ?? true,
      'aria-controls': 'actions-menu',
      onClick: vi.fn(),
      onKeyDown: vi.fn(),
      ref,
    },
  };
}

describe('MenuButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  testSystemProps(MenuButton, {
    expectedTag: 'button',
    displayName: 'MenuButton',
    defaultProps: { children: 'Actions' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
      { name: 'expanded', props: { expanded: true } },
      { name: 'collapsed', props: { expanded: false } },
      { name: 'with icon', props: { icon: <GearIcon /> } },
      { name: 'primary', props: { appearance: 'primary' } },
    ],
  });

  testFocusEvents(MenuButton, { children: 'Actions' });

  testNoImplicitSubmit(MenuButton, { defaultProps: { children: 'Actions' } });

  it('renders a native button with type="button" that a consumer may override (button-provider#1)', () => {
    const { rerender } = render(<MenuButton>Actions</MenuButton>);
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute('type', 'button');
    rerender(<MenuButton type="submit">Actions</MenuButton>);
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute('type', 'submit');
  });

  it('has aria-haspopup="menu"', () => {
    render(<MenuButton>Actions</MenuButton>);
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute(
      'aria-haspopup',
      'menu',
    );
  });

  describe('expanded (button-provider#25)', () => {
    it('sets aria-expanded="true" when expanded', () => {
      render(<MenuButton expanded>Actions</MenuButton>);
      expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });

    it('sets aria-expanded="false" when expanded={false}', () => {
      render(<MenuButton expanded={false}>Actions</MenuButton>);
      expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });

    it('omits aria-expanded when expanded is not set', () => {
      render(<MenuButton>Actions</MenuButton>);
      expect(screen.getByRole('button', { name: 'Actions' })).not.toHaveAttribute('aria-expanded');
    });
  });

  describe('menu icon (button-provider#20, #21, #25)', () => {
    it('renders the shared chevron (aria-hidden) when menuIcon is not provided', () => {
      render(<MenuButton>Actions</MenuButton>);
      const button = screen.getByRole('button', { name: 'Actions' });
      const svgs = button.querySelectorAll('svg');
      expect(svgs).toHaveLength(1);
      expect(svgs[0]).toHaveAttribute('data-wave-icon', 'chevron-down');
      expect(svgs[0]).toHaveAttribute('aria-hidden', 'true');
    });

    it('a custom menuIcon replaces the chevron: exactly one icon, no default svg', () => {
      render(<MenuButton menuIcon={<span data-testid="menu-icon">▾</span>}>Actions</MenuButton>);
      const button = screen.getByRole('button', { name: 'Actions' });
      expect(button.querySelectorAll('svg')).toHaveLength(0);
      expect(button.querySelectorAll('[data-testid="menu-icon"]')).toHaveLength(1);
      expect(screen.getByTestId('menu-icon').parentElement).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders menuIcon as SlotObject, aria-hidden by default', () => {
      render(
        <MenuButton
          menuIcon={{ children: <span data-testid="slot-menu-icon">V</span>, className: 'custom' }}
        >
          Actions
        </MenuButton>,
      );
      const wrapper = screen.getByTestId('slot-menu-icon').parentElement;
      expect(wrapper).toHaveClass('custom', 'shrink-0');
      expect(wrapper).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByRole('button', { name: 'Actions' }).querySelector('svg')).toBeNull();
    });

    it('menuIcon={false} hides the chevron (supported value)', () => {
      render(<MenuButton menuIcon={false}>Actions</MenuButton>);
      const button = screen.getByRole('button', { name: 'Actions' });
      expect(button.querySelector('svg')).toBeNull();
      expect(button.querySelector('[aria-hidden]')).toBeNull();
    });

    it('menuIcon={null} keeps the default chevron', () => {
      render(<MenuButton menuIcon={null}>Actions</MenuButton>);
      expect(
        screen.getByRole('button', { name: 'Actions' }).querySelector('[data-wave-icon]'),
      ).toHaveAttribute('data-wave-icon', 'chevron-down');
    });

    it.each([
      ['true', true],
      ['an empty string', ''],
      ['an empty array', []],
      ['an empty Fragment', <></>],
      ['a nested empty Fragment', <>{''}</>],
    ])(
      'menuIcon that renders nothing (%s) hides the indicator: no chevron, no empty span',
      (_name, menuIcon) => {
        render(<MenuButton menuIcon={menuIcon}>Actions</MenuButton>);
        const button = screen.getByRole('button', { name: 'Actions' });
        expect(button.querySelector('svg')).toBeNull();
        expect(button.querySelector('[aria-hidden]')).toBeNull();
        expect(button.children).toHaveLength(0);
        expect(button.textContent).toBe('Actions');
      },
    );

    it.each([
      ['an empty string', ''],
      ['an empty array', []],
      ['an empty Fragment', <></>],
    ])(
      'menuIcon that renders nothing (%s): an unnamed icon-only menu button warns exactly once',
      (_name, menuIcon) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(<MenuButton icon={<GearIcon />} menuIcon={menuIcon} />);
        const button = screen.getByRole('button');
        expect(button.querySelector('[data-wave-icon]')).toBeNull();
        expect(button.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
        const messages = warn.mock.calls
          .map((call) => String(call[0]))
          .filter((m) => m.includes('no accessible name'));
        expect(messages).toHaveLength(1);
      },
    );
  });

  describe('icon slot (button-provider#21, data-display#31)', () => {
    it('renders the icon shorthand inside an aria-hidden span', () => {
      render(<MenuButton icon={<GearIcon />}>Options</MenuButton>);
      const icon = screen.getByTestId('gear-icon');
      expect(icon.parentElement).toHaveAttribute('aria-hidden', 'true');
      expect(icon.parentElement).toHaveClass('inline-flex', 'shrink-0');
    });

    it('renders icon as SlotObject', () => {
      render(
        <MenuButton
          icon={{ children: <span data-testid="slot-icon">I</span>, className: 'custom' }}
        >
          Options
        </MenuButton>,
      );
      expect(screen.getByTestId('slot-icon').parentElement).toHaveClass('custom', 'shrink-0');
    });

    it('keeps icon text and emoji out of the accessible name', () => {
      render(<MenuButton icon={{ children: '⚙' }}>Options</MenuButton>);
      expect(screen.getByRole('button', { name: 'Options' })).toBeInTheDocument();
    });

    it('icon before the label, chevron after it', () => {
      render(<MenuButton icon={<GearIcon />}>Options</MenuButton>);
      const button = screen.getByRole('button', { name: 'Options' });
      const icon = screen.getByTestId('gear-icon');
      const chevron = button.querySelector('[data-wave-icon="chevron-down"]');
      expect(button.firstElementChild).toContainElement(icon);
      expect(button.lastElementChild).toBe(chevron);
      expect(button.textContent).toBe('Options');
    });

    it('warns once in development when an icon-only menu button has no accessible name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <MenuButton icon={<GearIcon />} />
          <MenuButton icon={<GearIcon />} appearance="primary" />
        </>,
      );
      const messages = warn.mock.calls
        .map((call) => String(call[0]))
        .filter((m) => m.includes('MenuButton') && m.includes('no accessible name'));
      expect(messages).toHaveLength(1);
      expect(messages[0].startsWith('[WaveUI] ')).toBe(true);
    });

    it('renders a one-shot generator icon: the icon-only check never iterates it (C-SLOTS)', () => {
      function* gearIcons() {
        yield <GearIcon key="gear" />;
      }
      const { unmount } = render(<MenuButton icon={gearIcons()}>Options</MenuButton>);
      expect(screen.getByTestId('gear-icon').parentElement).toHaveAttribute('aria-hidden', 'true');
      unmount();

      render(<MenuButton icon={gearIcons()} aria-label="Settings" />);
      const button = screen.getByRole('button', { name: 'Settings' });
      expect(button).toContainElement(screen.getByTestId('gear-icon'));
    });

    it('warns once for an icon-only menu button whose icon is a generator, and still renders it', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function* gearIcons() {
        yield <GearIcon key="gear" />;
      }
      render(<MenuButton icon={gearIcons()} />);
      expect(screen.getByTestId('gear-icon')).toBeInTheDocument();
      const messages = warn.mock.calls
        .map((call) => String(call[0]))
        .filter((m) => m.includes('no accessible name'));
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('MenuButton');
    });

    it('menuIcon={false}: an icon-only menu button without a name logs exactly one warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<MenuButton icon={<GearIcon />} menuIcon={false} />);
      const messages = warn.mock.calls
        .map((call) => String(call[0]))
        .filter((m) => m.includes('no accessible name'));
      expect(messages).toHaveLength(1);
      expect(messages[0].startsWith('[WaveUI] ')).toBe(true);
    });

    it.each([
      ['an empty string', ''],
      ['an empty array', []],
      ['an empty Fragment', <></>],
    ])('treats %s icon like no icon, as Button does (no icon-only warning)', (_name, icon) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<MenuButton icon={icon} />);
      const button = screen.getByRole('button');
      expect(button.querySelector('[aria-hidden="true"]:not([data-wave-icon])')).toBeNull();
      expect(warn).not.toHaveBeenCalled();
    });

    it.each([
      ['aria-label', { 'aria-label': 'Settings' }],
      ['aria-labelledby', { 'aria-labelledby': 'settings-label' }],
      ['title', { title: 'Settings' }],
      ['a text label', { children: 'Settings' }],
    ])('does not warn when the icon menu button has %s', (_name, props) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <span id="settings-label">Settings</span>
          <MenuButton icon={<GearIcon />} {...props} />
        </>,
      );
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('Menu.Trigger compatibility (feedback-navigation#51, spec §5.2)', () => {
    it('trigger props land on the button: id, ARIA state, handlers and ref', async () => {
      const user = userEvent.setup();
      const { ref, props } = createTriggerProps();
      render(<MenuButton {...props}>Actions</MenuButton>);
      const button = screen.getByRole('button', { name: 'Actions' });
      expect(button).toHaveAttribute('id', 'actions-trigger');
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(button).toHaveAttribute('aria-controls', 'actions-menu');
      expect(ref.current).toBe(button);

      await user.click(button);
      expect(props.onClick).toHaveBeenCalledTimes(1);
      fireEvent.keyDown(button, { key: 'ArrowDown' });
      expect(props.onKeyDown).toHaveBeenCalledTimes(1);
    });

    it('trigger ARIA state wins over the expanded prop (props after the internal defaults)', () => {
      const { props } = createTriggerProps({ expanded: false });
      render(
        <MenuButton expanded {...props}>
          Actions
        </MenuButton>,
      );
      expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });

    it('a consumer may override aria-haspopup', () => {
      render(<MenuButton aria-haspopup="listbox">Sort</MenuButton>);
      expect(screen.getByRole('button', { name: 'Sort' })).toHaveAttribute(
        'aria-haspopup',
        'listbox',
      );
    });

    it('a forwarded undefined keeps aria-haspopup="menu" and the expanded state', () => {
      const { rerender } = render(
        <MenuButton expanded aria-haspopup={undefined} aria-expanded={undefined}>
          Actions
        </MenuButton>,
      );
      const button = screen.getByRole('button', { name: 'Actions' });
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
      expect(button).toHaveAttribute('aria-expanded', 'true');

      rerender(
        <MenuButton expanded={false} aria-haspopup={undefined} aria-expanded={undefined}>
          Actions
        </MenuButton>,
      );
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('a wrapper that forwards its own unset ARIA props keeps the defaults', () => {
      const ActionsButton = ({
        'aria-haspopup': hasPopup,
        'aria-expanded': ariaExpanded,
        ...rest
      }: MenuButtonProps) => (
        <MenuButton aria-haspopup={hasPopup} aria-expanded={ariaExpanded} {...rest} />
      );
      render(<ActionsButton expanded>Actions</ActionsButton>);
      const button = screen.getByRole('button', { name: 'Actions' });
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('a forwarded null (untyped wrapper) keeps the defaults too', () => {
      const untyped = {
        'aria-haspopup': null,
        'aria-expanded': null,
      } as unknown as MenuButtonProps;
      render(
        <MenuButton expanded {...untyped}>
          Actions
        </MenuButton>,
      );
      const button = screen.getByRole('button', { name: 'Actions' });
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('a defined consumer aria-expanded still wins over expanded', () => {
      render(
        <MenuButton expanded aria-expanded={false}>
          Actions
        </MenuButton>,
      );
      expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });
  });

  describe('styles (button-provider#3, #10, #19, #20)', () => {
    it.each(APPEARANCES)('%s uses the shared button classes plus the label gap', (appearance) => {
      render(<MenuButton appearance={appearance}>Actions</MenuButton>);
      const button = screen.getByRole('button', { name: 'Actions' });
      const expected = [...buttonClassName({ appearance }).split(/\s+/), 'gap-1.5'].sort();
      expect(Array.from(button.classList).sort()).toEqual(expected);
    });

    it('primary uses the primary tokens with gated hover and pressed colors', () => {
      render(<MenuButton appearance="primary">Actions</MenuButton>);
      expect(screen.getByRole('button', { name: 'Actions' })).toHaveClass(
        'bg-primary',
        'text-primary-foreground',
        'not-disabled:not-aria-disabled:hover:bg-primary-hover',
        'not-disabled:not-aria-disabled:active:bg-primary-pressed',
      );
    });

    it('never uses the enabled: variant', () => {
      render(<MenuButton>Actions</MenuButton>);
      const classes = Array.from(screen.getByRole('button', { name: 'Actions' }).classList);
      expect(classes.filter((c) => c.includes('enabled:'))).toEqual([]);
    });

    it('extra-large uses a larger font than large (button-provider#19)', () => {
      render(
        <>
          <MenuButton size="large">Large</MenuButton>
          <MenuButton size="extra-large">Extra large</MenuButton>
        </>,
      );
      expect(screen.getByRole('button', { name: 'Large' })).toHaveClass('text-body-2');
      const xl = screen.getByRole('button', { name: 'Extra large' });
      expect(xl).toHaveClass('text-[18px]/[24px]');
      expect(xl).not.toHaveClass('text-sm');
    });

    it('disabled: native disabled and the disabled look', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <MenuButton disabled onClick={onClick}>
          Actions
        </MenuButton>,
      );
      const button = screen.getByRole('button', { name: 'Actions' });
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
      await user.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  it('calls onClick handler', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<MenuButton onClick={onClick}>Actions</MenuButton>);
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  describe('types (button-provider#27)', () => {
    it('MenuButtonProps carries ref (C-REF)', () => {
      expectTypeOf<MenuButtonProps['ref']>().toEqualTypeOf<
        React.Ref<HTMLButtonElement> | undefined
      >();
      const ref = React.createRef<HTMLButtonElement>();
      render(<MenuButton ref={ref}>Actions</MenuButton>);
      expect(ref.current).toBe(screen.getByRole('button', { name: 'Actions' }));
    });
  });
});
