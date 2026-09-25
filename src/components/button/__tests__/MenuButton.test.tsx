import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';
import { MenuButton } from '../MenuButton';
import type { MenuButtonProps } from '../MenuButton';
import { buttonClassName, buttonSizeClasses } from '../buttonStyles';
import { testSystemProps, testFocusEvents, testNoImplicitSubmit } from '../../../test-utils';
import type { Appearance, Size, Slot } from '../../../lib/types';
import { composeStories } from '@storybook/react';
import * as stories from '../../../../stories/MenuButton.stories';

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

const APPEARANCES: Appearance[] = ['primary', 'outline', 'subtle', 'transparent'];

/** The warning of an unnamed menu button whose only content is decorative (icon, indicator). */
const MENU_ICON_ONLY_WARNING =
  '[WaveUI] MenuButton: an icon-only menu button has no accessible name. Pass `aria-label`, `aria-labelledby` or `title` (the icon and the menu indicator are decorative and hidden from assistive technology).';
/** Button's own warning, which applies when no indicator renders. */
const BUTTON_ICON_ONLY_WARNING =
  '[WaveUI] Button: an icon-only button has no accessible name. Pass `aria-label`, `aria-labelledby` or `title` (the icon is decorative and hidden from assistive technology).';
/** The development warning of a button passed as `menuIcon` (`kind` says which form). */
const menuIconButtonWarning = (kind: string) =>
  `[WaveUI] MenuButton: \`menuIcon\` received ${kind}; its children render as the menu indicator and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. \`menuIcon={<MyIcon />}\`.`;

const GearIcon = () => (
  <svg data-testid="gear-icon" viewBox="0 0 16 16" width="16" height="16">
    <circle cx="8" cy="8" r="5" fill="currentColor" />
  </svg>
);

/**
 * Local stand-in for the props `Menu.Trigger` passes to its child (spec §5.2, §5.9): the unit
 * tests never import P13's Menu. Only the stories block renders the real Menu, through the
 * `WithMenu` story that composes it.
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
      { name: 'disabledFocusable', props: { disabledFocusable: true } },
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
      ['an empty Set', new Set<React.ReactNode>()],
      ['a Set of empty values', new Set(['', <React.Fragment key="f" />])],
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
        // Without an indicator, Button's own check reports it (MenuButton stays silent).
        expect(warn.mock.calls).toEqual([[BUTTON_ICON_ONLY_WARNING]]);
      },
    );

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
          'a slot object whose `as` is a Wave Button',
          {
            as: Button,
            'aria-label': 'Open',
            children: <svg data-testid="glyph" />,
          } as Slot<'span'>,
          'a slot object that renders a button',
        ],
      ])(
        '%s: its children are the decorative indicator, its props are dropped, one warning',
        (_name, menuIcon, kind) => {
          const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
          const error = vi.spyOn(console, 'error').mockImplementation(() => {});
          render(
            <>
              <MenuButton menuIcon={menuIcon}>Actions</MenuButton>
              <MenuButton menuIcon={menuIcon}>More</MenuButton>
            </>,
          );
          expect(screen.getAllByRole('button')).toHaveLength(2);
          for (const name of ['Actions', 'More']) {
            const button = screen.getByRole('button', { name });
            expect(button.querySelector('button')).toBeNull();
            const glyph = within(button).getByTestId('glyph');
            expect(glyph.parentElement).toHaveAttribute('aria-hidden', 'true');
            expect(button.querySelector('[data-wave-icon="chevron-down"]')).toBeNull();
          }
          expect(warn.mock.calls).toEqual([[menuIconButtonWarning(kind)]]);
          expect(error).not.toHaveBeenCalled();
        },
      );

      it('a button whose children render nothing keeps the chevron (its icon prop is dropped); only the button warning', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
          <MenuButton
            menuIcon={<Button icon={<svg data-testid="button-icon" />} aria-label="Open" />}
          >
            Actions
          </MenuButton>,
        );
        const button = screen.getByRole('button', { name: 'Actions' });
        expect(button.querySelector('button')).toBeNull();
        expect(button.querySelector('svg')).toHaveAttribute('data-wave-icon', 'chevron-down');
        expect(screen.queryByTestId('button-icon')).toBeNull();
        expect(warn.mock.calls).toEqual([[menuIconButtonWarning('a button element')]]);
        expect(error).not.toHaveBeenCalled();
      });
    });
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
      expect(warn.mock.calls).toEqual([[MENU_ICON_ONLY_WARNING]]);
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
      expect(warn.mock.calls).toEqual([[MENU_ICON_ONLY_WARNING]]);
    });

    it('menuIcon={false}: an icon-only menu button without a name logs exactly one warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<MenuButton icon={<GearIcon />} menuIcon={false} />);
      expect(warn.mock.calls).toEqual([[BUTTON_ICON_ONLY_WARNING]]);
    });

    it('renders the items of a label given as a generator (read once by the name check)', () => {
      const warn = vi.spyOn(console, 'warn');
      const error = vi.spyOn(console, 'error');
      function* label(): Generator<React.ReactNode> {
        yield 'More ';
        yield <b key="actions">actions</b>;
      }
      render(<MenuButton icon={<GearIcon />}>{label()}</MenuButton>);
      expect(screen.getByRole('button', { name: 'More actions' })).toHaveClass('gap-1.5');
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty string', ''],
      ['an empty array', []],
      ['an empty Fragment', <></>],
    ])(
      'treats %s icon like no icon, as Button does: no icon span, and the chevron-only button without a name warns once',
      (_name, icon) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(<MenuButton icon={icon} />);
        const button = screen.getByRole('button');
        expect(button.querySelector('[aria-hidden="true"]:not([data-wave-icon])')).toBeNull();
        expect(button.querySelector('[data-wave-icon]')).toHaveAttribute(
          'data-wave-icon',
          'chevron-down',
        );
        expect(warn.mock.calls.map((call) => String(call[0]))).toEqual([
          expect.stringMatching(/^\[WaveUI\] MenuButton: .*no accessible name/),
        ]);
      },
    );

    it('warns once when a chevron-only menu button has no accessible name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <MenuButton appearance="subtle" />
          <MenuButton menuIcon={<span>▾</span>} />
        </>,
      );
      expect(warn.mock.calls.map((call) => String(call[0]))).toEqual([
        expect.stringMatching(/^\[WaveUI\] MenuButton: .*no accessible name/),
      ]);
    });

    it.each([
      ['aria-label', { 'aria-label': 'More actions' }],
      ['aria-labelledby', { 'aria-labelledby': 'more-label' }],
      ['title', { title: 'More actions' }],
    ])('does not warn when a chevron-only menu button has %s', (_name, props) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <span id="more-label">More actions</span>
          <MenuButton {...props} />
        </>,
      );
      expect(screen.getByRole('button', { name: 'More actions' })).toHaveAttribute(
        'aria-haspopup',
        'menu',
      );
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

    describe('without a label', () => {
      /** The padding of a menu button without a label: that of SplitButton's menu half. */
      const compactPadding: Record<Size, string> = {
        'extra-small': 'px-1.5',
        small: 'px-1.5',
        medium: 'px-2',
        large: 'px-2',
        'extra-large': 'px-3',
      };
      /** The labelled size classes Button would use (height, 96px minimum width, padding, font). */
      const labelled = (size: Size) => buttonSizeClasses[size].split(' ');
      const SIZES = Object.keys(compactPadding) as Size[];

      it.each(SIZES)(
        'an icon-only %s menu button drops the labelled minimum width and padding',
        (size) => {
          render(<MenuButton size={size} icon={<GearIcon />} aria-label="Settings" />);
          const button = screen.getByRole('button', { name: 'Settings' });
          const [height, minWidth, , font] = labelled(size);
          expect(button).toHaveClass(height, font, 'min-w-0');
          expect(button).not.toHaveClass(minWidth);
          // The compact padding replaces the labelled one (no second `px-*` class is left).
          const padding = Array.from(button.classList).filter((cls) => cls.startsWith('px-'));
          expect(padding).toEqual([compactPadding[size]]);
          expect(button.querySelector('[data-wave-icon]')).toHaveAttribute(
            'data-wave-icon',
            'chevron-down',
          );
        },
      );

      it.each(SIZES)('a chevron-only %s menu button is sized the same way', (size) => {
        render(<MenuButton size={size} aria-label="More actions" />);
        const button = screen.getByRole('button', { name: 'More actions' });
        expect(button).toHaveClass('min-w-0');
        expect(button).not.toHaveClass('min-w-24');
        const padding = Array.from(button.classList).filter((cls) => cls.startsWith('px-'));
        expect(padding).toEqual([compactPadding[size]]);
      });

      it('menuIcon={false} leaves an icon-only menu button to Button: square, no padding', () => {
        render(<MenuButton icon={<GearIcon />} menuIcon={false} aria-label="Settings" />);
        const button = screen.getByRole('button', { name: 'Settings' });
        expect(button).toHaveClass('h-8', 'w-8', 'px-0');
        expect(button).not.toHaveClass('min-w-24');
        expect(button).not.toHaveClass('min-w-0');
      });

      it('a labelled menu button keeps the labelled sizing', () => {
        render(<MenuButton icon={<GearIcon />}>Settings</MenuButton>);
        expect(screen.getByRole('button', { name: 'Settings' })).toHaveClass(...labelled('medium'));
      });

      it('a consumer className still wins over the compact padding', () => {
        render(<MenuButton icon={<GearIcon />} aria-label="Settings" className="px-4" />);
        const button = screen.getByRole('button', { name: 'Settings' });
        expect(button).toHaveClass('px-4', 'min-w-0');
        expect(button).not.toHaveClass('px-2');
      });
    });

    it('disabledFocusable: focusable, the three attributes, and activation prevented', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onKeyDown = vi.fn();
      render(
        <MenuButton disabledFocusable onClick={onClick} onKeyDown={onKeyDown}>
          Actions
        </MenuButton>,
      );
      const button = screen.getByRole('button', { name: 'Actions' });
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('data-disabled', '');
      expect(button).toHaveAttribute('data-disabled-focusable', '');
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
      expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');

      await user.tab();
      expect(button).toHaveFocus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      await user.click(button);
      expect(onClick).not.toHaveBeenCalled();
      expect(onKeyDown).not.toHaveBeenCalled();
      // The arrow keys still reach the handler (Menu.Trigger decides what they do).
      fireEvent.keyDown(button, { key: 'ArrowDown' });
      expect(onKeyDown).toHaveBeenCalledTimes(1);
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
      expectTypeOf<MenuButtonProps['disabledFocusable']>().toEqualTypeOf<boolean | undefined>();
      const ref = React.createRef<HTMLButtonElement>();
      render(<MenuButton ref={ref}>Actions</MenuButton>);
      expect(ref.current).toBe(screen.getByRole('button', { name: 'Actions' }));
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

    it('WithMenu opens a real Menu from the MenuButton as the Menu.Trigger child', async () => {
      const user = userEvent.setup();
      const { WithMenu } = composed;
      render(<WithMenu />);
      const trigger = screen.getByRole('button', { name: 'Actions' });
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();

      await user.click(trigger);
      const menu = screen.getByRole('menu', { name: 'Actions' });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls', menu.id);
      expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
      expect(expandedWithoutMenu()).toEqual([]);

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveFocus();
    });
  });
});
