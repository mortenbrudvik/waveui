import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AvatarGroup } from '../AvatarGroup';
import type { AvatarGroupProps } from '../AvatarGroup';
import { Avatar } from '../Avatar';
import { DismissLayerProvider, useDismiss } from '../../../hooks/useDismiss';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import {
  expectNoA11yViolations,
  renderWithProviders,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';
import type { Size } from '../../../lib/types';

const NAMES = ['Alice', 'Bob', 'Charlie', 'Diana'];
const PHOTO = 'https://example.com/photo.jpg';
const members = (names: string[] = NAMES) => names.map((n) => <Avatar key={n} name={n} />);

/**
 * Stand-in for a modal surface (§5.9: raw F4 hooks, no Dialog): a focus trap on its own dismiss
 * layer, with the group's overflow button as its last tab stop unless `inside` adds one after it.
 * Like a third-party trap, it does not make the rest of the page inert: `outside` renders a tab
 * stop after it on the page.
 */
function TrappedGroup({
  inside = false,
  outside = false,
}: {
  inside?: boolean;
  outside?: boolean;
}) {
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const { layerId } = useDismiss({
    open: true,
    onDismiss: () => {},
    refs: [containerRef],
    outsidePress: false,
  });
  useFocusTrap(container, { enabled: true, layerId, initialFocus: 'container' });
  const setRefs = React.useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setContainer(node);
  }, []);
  return (
    <>
      <DismissLayerProvider layerId={layerId}>
        <div ref={setRefs} tabIndex={-1}>
          <button type="button">First</button>
          <AvatarGroup aria-label="Team" max={2}>
            {members()}
          </AvatarGroup>
          {inside && <button type="button">Last</button>}
        </div>
      </DismissLayerProvider>
      {outside && <button type="button">Outside</button>}
    </>
  );
}

describe('AvatarGroup', () => {
  testSystemProps(AvatarGroup, {
    expectedTag: 'div',
    displayName: 'AvatarGroup',
    defaultProps: { 'aria-label': 'Project team', children: members() },
    a11yVariants: [{ name: 'overflow', props: { max: 2 } }],
  });

  testNoImplicitSubmit(AvatarGroup, {
    defaultProps: { 'aria-label': 'Project team', max: 1, children: members() },
  });

  // data-display#26
  describe('group semantics', () => {
    it('is a group named by the consumer', () => {
      render(<AvatarGroup aria-label="Project team">{members()}</AvatarGroup>);
      const group = screen.getByRole('group', { name: 'Project team' });
      for (const name of NAMES) {
        expect(within(group).getByRole('img', { name })).toBeInTheDocument();
      }
    });

    it('warns once in development when the group has no name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(<AvatarGroup>{members()}</AvatarGroup>);
        render(<AvatarGroup>{members()}</AvatarGroup>);
        const calls = warn.mock.calls.filter(([message]) =>
          String(message).includes('AvatarGroup'),
        );
        expect(calls).toHaveLength(1);
        expect(String(calls[0]![0])).toMatch(/^\[WaveUI\] .*aria-label/);
      } finally {
        warn.mockRestore();
      }
    });

    it.each([
      ['aria-label', { 'aria-label': 'Team' }],
      ['aria-labelledby', { 'aria-labelledby': 'heading' }],
    ])('does not warn when named with %s', (_name, props) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(<AvatarGroup {...props}>{members()}</AvatarGroup>);
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });
  });

  // data-display#17
  describe('max', () => {
    it('renders all children when max is not set', () => {
      render(<AvatarGroup aria-label="Team">{members()}</AvatarGroup>);
      expect(screen.getAllByRole('img')).toHaveLength(4);
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('hides the avatars beyond max and shows the overflow count', () => {
      render(
        <AvatarGroup aria-label="Team" max={2}>
          {members()}
        </AvatarGroup>,
      );
      expect(screen.getByRole('img', { name: 'Alice' })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Bob' })).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'Charlie' })).toBeNull();
      expect(screen.queryByRole('img', { name: 'Diana' })).toBeNull();
      expect(screen.getByRole('button', { name: '2 more' })).toHaveTextContent('+2');
    });

    it('shows no overflow at the exact-fit boundary', () => {
      render(
        <AvatarGroup aria-label="Team" max={4}>
          {members()}
        </AvatarGroup>,
      );
      expect(screen.getAllByRole('img')).toHaveLength(4);
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('shows only the overflow indicator for max={0}', () => {
      render(
        <AvatarGroup aria-label="Team" max={0}>
          {members()}
        </AvatarGroup>,
      );
      expect(screen.queryAllByRole('img')).toHaveLength(0);
      expect(screen.getByRole('button', { name: '4 more' })).toHaveTextContent('+4');
    });
  });

  // data-display#26
  describe('overflow button', () => {
    const renderOverflow = (props: Partial<React.ComponentProps<typeof AvatarGroup>> = {}) =>
      render(
        <AvatarGroup aria-label="Team" max={2} {...props}>
          {members()}
        </AvatarGroup>,
      );

    it('is a collapsed, non-submitting button', () => {
      renderOverflow();
      const button = screen.getByRole('button', { name: '2 more' });
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    });

    it.each([
      ['a string', 'Show 2 hidden members', 'Show 2 hidden members'],
      ['a function', (count: number) => `${count} weitere`, '2 weitere'],
    ] as const)('accepts overflowLabel as %s', (_kind, overflowLabel, name) => {
      renderOverflow({ overflowLabel });
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    });

    it('lists the names of the hidden members when clicked', async () => {
      const user = userEvent.setup();
      renderOverflow();
      const button = screen.getByRole('button', { name: '2 more' });
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      const popup = screen.getByRole('dialog', { name: '2 more' });
      expect(button).toHaveAttribute('aria-controls', popup.id);
      const items = within(popup).getAllByRole('listitem');
      expect(items.map((item) => item.textContent)).toEqual(['Charlie', 'Diana']);
      expect(within(popup).queryByText('Alice')).toBeNull();
      await expectNoA11yViolations();
    });

    it('toggles closed on a second click', async () => {
      const user = userEvent.setup();
      renderOverflow();
      const button = screen.getByRole('button', { name: '2 more' });
      await user.click(button);
      await user.click(button);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens from the keyboard, moves focus into the popup and returns it on Escape', async () => {
      const user = userEvent.setup();
      renderOverflow();
      await user.tab();
      const button = screen.getByRole('button', { name: '2 more' });
      expect(button).toHaveFocus();

      await user.keyboard('{Enter}');
      const popup = screen.getByRole('dialog', { name: '2 more' });
      expect(popup).toHaveFocus();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute('aria-expanded', 'false');

      await user.keyboard(' ');
      expect(screen.getByRole('dialog', { name: '2 more' })).toBeInTheDocument();
    });

    it('keeps focus in the popup and restores it on Escape under StrictMode', async () => {
      const user = userEvent.setup();
      render(
        <React.StrictMode>
          <AvatarGroup aria-label="Team" max={2}>
            {members()}
          </AvatarGroup>
        </React.StrictMode>,
      );
      const button = screen.getByRole('button', { name: '2 more' });
      await user.click(button);
      expect(screen.getByRole('dialog', { name: '2 more' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(button).toHaveFocus();
    });

    it('closes on an outside press', async () => {
      const user = userEvent.setup();
      render(
        <>
          <AvatarGroup aria-label="Team" max={2}>
            {members()}
          </AvatarGroup>
          <p>Elsewhere</p>
        </>,
      );
      await user.click(screen.getByRole('button', { name: '2 more' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.click(screen.getByText('Elsewhere'));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes on Tab and continues tabbing from the button', async () => {
      const user = userEvent.setup();
      render(
        <>
          <AvatarGroup aria-label="Team" max={2}>
            {members()}
          </AvatarGroup>
          <button type="button">Next</button>
        </>,
      );
      await user.click(screen.getByRole('button', { name: '2 more' }));
      expect(screen.getByRole('dialog')).toHaveFocus();
      await user.tab();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
    });

    it('lets Tab proceed from the button when it is the last tab stop of the page', async () => {
      const user = userEvent.setup();
      renderOverflow();
      const button = screen.getByRole('button', { name: '2 more' });
      await user.click(button);
      const popup = screen.getByRole('dialog');
      // `fireEvent` returns false when a handler prevented the default action.
      expect(fireEvent.keyDown(popup, { key: 'Tab' })).toBe(true);
      await act(async () => {});
      expect(screen.queryByRole('dialog')).toBeNull();
      // Focus is back on the button, from which the browser's own Tab moves on (out of the page).
      expect(button).toHaveFocus();
    });

    it.each([
      ['the last tab stop of the page', false],
      ['followed by a tab stop outside the trap (page not inert)', true],
    ])(
      'lets an enclosing focus trap wrap Tab when the button is its last tab stop, %s',
      async (_case, outside) => {
        const user = userEvent.setup();
        render(<TrappedGroup outside={outside} />);
        await user.click(screen.getByRole('button', { name: '2 more' }));
        expect(screen.getByRole('dialog', { name: '2 more' })).toHaveFocus();
        await user.tab();
        expect(screen.queryByRole('dialog', { name: '2 more' })).toBeNull();
        expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
      },
    );

    it('moves Tab on to the tab stop after the button inside an enclosing focus trap', async () => {
      const user = userEvent.setup();
      render(<TrappedGroup inside outside />);
      await user.click(screen.getByRole('button', { name: '2 more' }));
      const popup = screen.getByRole('dialog', { name: '2 more' });
      expect(popup).toHaveFocus();
      // Handled by the group itself (default prevented), not left to the trap.
      expect(fireEvent.keyDown(popup, { key: 'Tab' })).toBe(false);
      expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
      await act(async () => {});
      expect(screen.queryByRole('dialog', { name: '2 more' })).toBeNull();
    });

    it('closes on Shift+Tab and returns focus to the button', async () => {
      const user = userEvent.setup();
      renderOverflow();
      const button = screen.getByRole('button', { name: '2 more' });
      await user.click(button);
      await user.tab({ shift: true });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(button).toHaveFocus();
    });

    it('closes when no member is hidden any more', async () => {
      const user = userEvent.setup();
      const { rerender } = renderOverflow();
      await user.click(screen.getByRole('button', { name: '2 more' }));
      rerender(
        <AvatarGroup aria-label="Team" max={4}>
          {members()}
        </AvatarGroup>,
      );
      expect(screen.queryByRole('dialog')).toBeNull();
      rerender(
        <AvatarGroup aria-label="Team" max={2}>
          {members()}
        </AvatarGroup>,
      );
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('button', { name: '2 more' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });

    // A hidden member can be interactive (the linked-avatar pattern): Tab moves through the
    // popup's tabbables and closes it only when leaving the last (or, with Shift, the first) one.
    describe('with interactive members', () => {
      const renderLinked = () =>
        render(
          <>
            <AvatarGroup aria-label="Team" max={1}>
              <Avatar name="Alice" />
              <a href="#bob">
                <Avatar name="Bob" />
              </a>
              <a href="#carol">
                <Avatar name="Carol" />
              </a>
            </AvatarGroup>
            <button type="button">Next</button>
          </>,
        );

      it('reaches every link in the popup with Tab, then moves on from the button', async () => {
        const user = userEvent.setup();
        renderLinked();
        await user.click(screen.getByRole('button', { name: '2 more' }));
        const popup = screen.getByRole('dialog', { name: '2 more' });
        expect(popup).toHaveFocus();
        await expectNoA11yViolations();

        await user.tab();
        expect(within(popup).getByRole('link', { name: 'Bob' })).toHaveFocus();
        await user.tab();
        expect(within(popup).getByRole('link', { name: 'Carol' })).toHaveFocus();

        await user.tab();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
      });

      it('moves back with Shift+Tab and closes before the first link', async () => {
        const user = userEvent.setup();
        renderLinked();
        const button = screen.getByRole('button', { name: '2 more' });
        await user.click(button);
        const popup = screen.getByRole('dialog', { name: '2 more' });
        await user.tab();
        await user.tab();
        expect(within(popup).getByRole('link', { name: 'Carol' })).toHaveFocus();

        await user.tab({ shift: true });
        expect(within(popup).getByRole('link', { name: 'Bob' })).toHaveFocus();
        await user.tab({ shift: true });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(button).toHaveFocus();
      });

      it('returns focus to the button on Escape from a link', async () => {
        const user = userEvent.setup();
        renderLinked();
        const button = screen.getByRole('button', { name: '2 more' });
        await user.click(button);
        await user.tab();
        expect(screen.getByRole('link', { name: 'Bob' })).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(button).toHaveFocus();
      });
    });

    // Only an Avatar is listed by a text name, taken from its accessible name: `aria-label` before
    // `name`. Any other element is rendered as it is, so a labelled link stays a link.
    it('lists an Avatar by its aria-label before its name', async () => {
      const user = userEvent.setup();
      render(
        <AvatarGroup aria-label="Team" max={1}>
          <Avatar name="Alice" />
          <Avatar name="Jane" aria-label="Jane, admin" />
        </AvatarGroup>,
      );
      await user.click(screen.getByRole('button', { name: '1 more' }));
      const items = within(screen.getByRole('dialog')).getAllByRole('listitem');
      expect(items.map((item) => item.textContent)).toEqual(['Jane, admin']);
    });

    it('keeps a labelled link member a link in the popup', async () => {
      const user = userEvent.setup();
      render(
        <AvatarGroup aria-label="Team" max={1}>
          <Avatar name="Alice" />
          <a href="#bob" aria-label="Bob profile">
            <Avatar name="Bob" decorative />
          </a>
        </AvatarGroup>,
      );
      await user.click(screen.getByRole('button', { name: '1 more' }));
      const popup = screen.getByRole('dialog');
      expect(within(popup).getByRole('link', { name: 'Bob profile' })).toHaveAttribute(
        'href',
        '#bob',
      );
      await expectNoA11yViolations();
    });

    it('renders a non-Avatar member with a name prop as it is', async () => {
      const user = userEvent.setup();
      render(
        <AvatarGroup aria-label="Team" max={1}>
          <Avatar name="Alice" />
          <button type="button" name="invite">
            Invite Carol
          </button>
        </AvatarGroup>,
      );
      await user.click(screen.getByRole('button', { name: '1 more' }));
      const popup = screen.getByRole('dialog');
      expect(within(popup).getByRole('button', { name: 'Invite Carol' })).toBeInTheDocument();
      expect(within(popup).queryByText('invite')).toBeNull();
    });

    it('lists unnamed members by rendering them', async () => {
      const user = userEvent.setup();
      render(
        <AvatarGroup aria-label="Team" max={1}>
          <Avatar name="Alice" />
          <span data-testid="custom">Custom member</span>
        </AvatarGroup>,
      );
      await user.click(screen.getByRole('button', { name: '1 more' }));
      const popup = screen.getByRole('dialog');
      expect(within(popup).getByTestId('custom')).toHaveTextContent('Custom member');
    });

    // A hidden member with no usable name would be an empty (aria-hidden) list item.
    it.each([
      ['an icon-only Avatar', <Avatar key="m" icon={<svg />} />],
      ['an Avatar with a blank name', <Avatar key="m" name="   " />],
      ['an image Avatar without a name', <Avatar key="m" src={PHOTO} />],
      ['a decorative Avatar', <Avatar key="m" image={<img src={PHOTO} alt="Bob" />} decorative />],
      ['a blank string', '   '],
    ] as Array<[string, React.ReactNode]>)(
      'lists %s as "Unnamed member" and warns once',
      async (_kind, member) => {
        const user = userEvent.setup();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
          render(
            <AvatarGroup aria-label="Team" max={1}>
              <Avatar name="Alice" />
              {member}
            </AvatarGroup>,
          );
          await user.click(screen.getByRole('button', { name: '1 more' }));
          const items = within(screen.getByRole('dialog')).getAllByRole('listitem');
          expect(items.map((item) => item.textContent)).toEqual(['Unnamed member']);
          await user.click(screen.getByRole('button', { name: '1 more' }));
          await user.click(screen.getByRole('button', { name: '1 more' }));
          const calls = warn.mock.calls.filter(([message]) =>
            String(message).includes('AvatarGroup'),
          );
          expect(calls).toHaveLength(1);
          expect(String(calls[0]![0])).toMatch(/^\[WaveUI\] AvatarGroup: .*`name` or `aria-label`/);
        } finally {
          warn.mockRestore();
        }
      },
    );

    it('localises the unnamed member label with unnamedMemberLabel', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(
          <AvatarGroup aria-label="Team" max={1} unnamedMemberLabel="Unbenanntes Mitglied">
            <Avatar name="Alice" />
            <Avatar icon={<svg />} />
          </AvatarGroup>,
        );
        await user.click(screen.getByRole('button', { name: '1 more' }));
        const items = within(screen.getByRole('dialog')).getAllByRole('listitem');
        expect(items.map((item) => item.textContent)).toEqual(['Unbenanntes Mitglied']);
        expect(String(warn.mock.calls[0]?.[0])).toContain('"Unbenanntes Mitglied"');
      } finally {
        warn.mockRestore();
      }
    });

    it.each([
      ['aria-labelledby', <Avatar key="m" aria-labelledby="bob-caption" icon={<svg />} />],
      [
        'aria-labelledby over its name',
        <Avatar key="m" aria-labelledby="bob-caption" name="Robert" />,
      ],
      ['an element image alt', <Avatar key="m" image={<img src={PHOTO} alt="Bob" />} />],
      ['an object image alt', <Avatar key="m" image={{ src: PHOTO, alt: 'Bob' }} />],
    ] as Array<[string, React.ReactNode]>)(
      'lists an Avatar named by %s by rendering it',
      async (_kind, member) => {
        const user = userEvent.setup();
        render(
          <>
            <span id="bob-caption">Bob</span>
            <AvatarGroup aria-label="Team" max={1}>
              <Avatar name="Alice" />
              {member}
            </AvatarGroup>
          </>,
        );
        await user.click(screen.getByRole('button', { name: '1 more' }));
        const popup = screen.getByRole('dialog');
        expect(within(popup).getByRole('img', { name: 'Bob' })).toBeInTheDocument();
        expect(within(popup).queryByText('Unnamed member')).toBeNull();
      },
    );
  });

  // data-display#16
  it.each([
    ['extra-small', 'w-6'],
    ['small', 'w-8'],
    ['medium', 'w-10'],
    ['large', 'w-12'],
    ['extra-large', 'w-14'],
  ] as Array<[Size, string]>)('size %s renders a %s overflow button', (size, width) => {
    render(
      <AvatarGroup aria-label="Team" max={1} size={size}>
        {members()}
      </AvatarGroup>,
    );
    expect(screen.getByRole('button')).toHaveClass(width, width.replace('w-', 'h-'));
  });

  // feedback-navigation#34 / button-provider#3
  it('overlaps members with a logical negative margin and a background ring (RTL-safe)', () => {
    renderWithProviders(
      <AvatarGroup aria-label="Team" max={2}>
        {members()}
      </AvatarGroup>,
      { dir: 'rtl' },
    );
    const second = screen.getByRole('img', { name: 'Bob' }).parentElement!;
    const first = screen.getByRole('img', { name: 'Alice' }).parentElement!;
    expect(first).not.toHaveClass('-ms-2');
    expect(second).toHaveClass('-ms-2', 'ring-2', 'ring-background');
    expect(second.className).not.toMatch(/-ml-|ring-white/);
    expect(screen.getByRole('button')).toHaveClass('-ms-2', 'ring-background');
  });

  // button-provider#27 (C-REF): ref is declared in the props interface.
  it('declares ref in AvatarGroupProps (C-REF)', () => {
    expectTypeOf<AvatarGroupProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
  });
});
