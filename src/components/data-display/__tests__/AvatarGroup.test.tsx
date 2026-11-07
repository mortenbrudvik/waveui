import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { avatarGroupClassNames, avatarGroupItemClassNames } from '../../../lib/classNames';
import { AvatarGroup, AvatarGroupItem, AvatarGroupPopover } from '../AvatarGroup';
import type {
  AvatarGroupProps,
  AvatarGroupItemProps,
  AvatarGroupOpenChangeDetails,
} from '../AvatarGroup';
import { Avatar } from '../Avatar';
import { AvatarGroupContext } from '../AvatarGroup.context';
import type { AvatarProps } from '../Avatar';
import { Toolbar } from '../../button/Toolbar';
import { Portal } from '../../portal/Portal';
import { WaveProvider } from '../../provider/WaveProvider';
import { DismissLayerProvider, useDismiss } from '../../../hooks/useDismiss';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import {
  asClientReference,
  expectInertSlotProps,
  expectNoA11yViolations,
  openingTags,
  renderWithProviders,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';
import type { Size } from '../../../lib/types';
import type { AvatarSize } from '../Avatar.sizes';

const NAMES = ['Alice', 'Bob', 'Charlie', 'Diana'];
const PHOTO = 'https://example.com/photo.jpg';
const members = (names: string[] = NAMES) => names.map((n) => <Avatar key={n} name={n} />);

const UNNAMED_GROUP_WARNING =
  '[WaveUI] AvatarGroup: the group has no accessible name. Pass `aria-label` (or `aria-labelledby`) describing the people it shows.';
const unnamedMemberWarning = (label: string) =>
  `[WaveUI] AvatarGroup: a hidden member has no accessible name and is listed as "${label}". Give each member a \`name\` or \`aria-label\`.`;

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
        expect(warn.mock.calls).toEqual([[UNNAMED_GROUP_WARNING]]);
      } finally {
        warn.mockRestore();
      }
    });

    // The name given by aria-labelledby reaches the group (the warning is
    // computed from the props, so it stays silent even when the attribute is lost).
    it('is a group named by aria-labelledby', () => {
      render(
        <>
          <span id="team">Design team</span>
          <AvatarGroup aria-labelledby="team">{members()}</AvatarGroup>
        </>,
      );
      expect(screen.getByRole('group', { name: 'Design team' })).toHaveAttribute(
        'aria-labelledby',
        'team',
      );
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

    // A computed max is sanitised. A negative value shows only the
    // overflow button (never `slice(0, -1)`), a fraction is rounded down and NaN is no limit.
    it.each([
      ['a negative max', -1, [], '4 more'],
      ['a fractional max', 2.9, ['Alice', 'Bob'], '2 more'],
      ['NaN', NaN, NAMES, null],
    ] as Array<[string, number, string[], string | null]>)(
      'sanitises %s',
      (_case, max, shown, overflowName) => {
        render(
          <AvatarGroup aria-label="Team" max={max}>
            {members()}
          </AvatarGroup>,
        );
        const names = screen.queryAllByRole('img').map((img) => img.getAttribute('aria-label'));
        expect(names).toEqual(shown);
        if (overflowName === null) {
          expect(screen.queryByRole('button')).toBeNull();
        } else {
          expect(screen.getByRole('button', { name: overflowName })).toBeInTheDocument();
        }
      },
    );

    // C-COMPOUND: the members of a Fragment count one by one.
    it('counts, slices and overlaps the members of a Fragment one by one', () => {
      render(
        <AvatarGroup aria-label="Team" max={2}>
          <>
            <Avatar name="Alice" />
            <>
              <Avatar name="Bob" />
            </>
          </>
          <Avatar name="Charlie" />
          {null}
          {false}
        </AvatarGroup>,
      );
      const alice = screen.getByRole('img', { name: 'Alice' });
      const bob = screen.getByRole('img', { name: 'Bob' });
      expect(screen.queryByRole('img', { name: 'Charlie' })).toBeNull();
      expect(screen.getByRole('button', { name: '1 more' })).toHaveTextContent('+1');
      // Each member has its own overlap wrapper.
      expect(alice.parentElement).not.toBe(bob.parentElement);
      expect(alice.parentElement).not.toHaveClass('wave:-ms-2');
      expect(bob.parentElement).toHaveClass('wave:-ms-2', 'wave:ring-2', 'wave:ring-background');
    });
  });

  // C-COMPOUND: a member written in a Server Component reaches the client as a lazy reference
  // (`element.type` is not `Avatar`); it is still listed by its name.
  describe('members written in a Server Component', () => {
    const ClientAvatar = asClientReference(Avatar);
    const group = (Member: typeof Avatar) => (
      <AvatarGroup aria-label="Team" max={1}>
        <Member name="Alice" />
        <Member name="Bob" aria-label="Bob, admin" />
        <Member name="Carol" />
        <Member icon={<svg />} />
      </AvatarGroup>
    );

    it('renders the same markup as with the plain component', () => {
      expect(renderToString(group(ClientAvatar))).toBe(renderToString(group(Avatar)));
    });

    it.each([
      ['plain', Avatar],
      ['lazy', ClientAvatar],
    ] as Array<[string, typeof Avatar]>)(
      'lists hidden %s members by their names',
      async (_kind, Member) => {
        const user = userEvent.setup();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
          render(group(Member));
          await user.click(screen.getByRole('button', { name: '3 more' }));
          const items = within(screen.getByRole('dialog')).getAllByRole('listitem');
          expect(items.map((item) => item.textContent)).toEqual([
            'Bob, admin',
            'Carol',
            'Unnamed member',
          ]);
          expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
            expect.stringMatching(
              /^\[WaveUI\] AvatarGroup: a hidden member has no accessible name/,
            ),
          ]);
        } finally {
          warn.mockRestore();
        }
      },
    );
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

      // A member can open a portal of its own (a card, a menu). Its keys bubble through the
      // React tree to the popup, but its content is not in the popup's DOM: its Tab is its own.
      it.each([
        ['Tab', false],
        ['Shift+Tab', true],
      ])('ignores a %s that bubbles from a portal a member opened', async (_name, shiftKey) => {
        const user = userEvent.setup();
        function MemberWithCard() {
          return (
            <span>
              Dana
              <Portal>
                <button type="button">Dana's card</button>
                <button type="button">Message Dana</button>
              </Portal>
            </span>
          );
        }
        render(
          <>
            <AvatarGroup aria-label="Team" max={1}>
              <Avatar name="Alice" />
              <a href="#bob">
                <Avatar name="Bob" />
              </a>
              <MemberWithCard />
            </AvatarGroup>
            <button type="button">Next</button>
          </>,
        );
        await user.click(screen.getByRole('button', { name: '2 more' }));
        const popup = screen.getByRole('dialog', { name: '2 more' });
        const card = screen.getByRole('button', { name: "Dana's card" });
        expect(popup).not.toContainElement(card);
        act(() => card.focus());

        expect(fireEvent.keyDown(card, { key: 'Tab', shiftKey })).toBe(true);
        expect(card).toHaveFocus();
        expect(screen.getByRole('dialog', { name: '2 more' })).toBe(popup);
      });

      // The popup can be portaled into another document (an iframe or a popout window), whose
      // nodes are not instances of this realm's `Node`: Tab is still the popup's.
      it('handles Tab in a popup portaled into another document realm (an iframe)', async () => {
        const iframe = document.createElement('iframe');
        document.body.appendChild(iframe);
        let unmount: (() => void) | undefined;
        try {
          const frameBody = iframe.contentDocument!.body;
          ({ unmount } = render(
            <WaveProvider portalContainer={frameBody}>
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
            </WaveProvider>,
          ));
          fireEvent.click(screen.getByRole('button', { name: '2 more' }));
          await act(async () => {});
          const popup = within(frameBody).getByRole('dialog', { name: '2 more' });
          const bob = within(popup).getByRole('link', { name: 'Bob' });
          const carol = within(popup).getByRole('link', { name: 'Carol' });
          expect(bob).not.toBeInstanceOf(Node);

          act(() => bob.focus());
          expect(fireEvent.keyDown(bob, { key: 'Tab' })).toBe(false);
          expect(carol).toHaveFocus();

          expect(fireEvent.keyDown(carol, { key: 'Tab' })).toBe(false);
          await act(async () => {});
          expect(within(frameBody).queryByRole('dialog')).toBeNull();
          expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
        } finally {
          unmount?.();
          iframe.remove();
        }
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
          expect(warn.mock.calls).toEqual([[unnamedMemberWarning('Unnamed member')]]);
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
        expect(warn.mock.calls).toEqual([[unnamedMemberWarning('Unbenanntes Mitglied')]]);
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

    // A member named only by its image alt keeps that name when the image
    // fails in the popup, so its list item is never empty for assistive technology.
    it.each([
      [
        'an element image alt',
        <img key="i" src="https://example.com/expired.png" alt="Bob Smith" />,
      ],
      ['an object image alt', { src: 'https://example.com/expired.png', alt: 'Bob Smith' }],
    ] as Array<[string, React.ComponentProps<typeof Avatar>['image']]>)(
      'keeps a member named by %s named when its image fails',
      async (_kind, image) => {
        const user = userEvent.setup();
        render(
          <AvatarGroup aria-label="Team" max={1}>
            <Avatar name="Alice" />
            <Avatar image={image} />
          </AvatarGroup>,
        );
        await user.click(screen.getByRole('button', { name: '1 more' }));
        const popup = screen.getByRole('dialog');
        fireEvent.error(popup.querySelector('img')!);
        expect(popup.querySelector('img')).toBeNull();
        const item = within(popup).getByRole('listitem');
        expect(within(item).getByRole('img', { name: 'Bob Smith' })).not.toHaveAttribute(
          'aria-hidden',
        );
        await expectNoA11yViolations();
      },
    );
  });

  // data-display#16
  it.each([
    ['extra-small', 'wave:w-6'],
    ['small', 'wave:w-8'],
    ['medium', 'wave:w-10'],
    ['large', 'wave:w-12'],
    ['extra-large', 'wave:w-14'],
  ] as Array<[Size, string]>)('size %s renders a %s overflow button', (size, width) => {
    render(
      <AvatarGroup aria-label="Team" max={1} size={size}>
        {NAMES.map((name) => (
          <Avatar key={name} name={name} size={size} />
        ))}
      </AvatarGroup>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveClass(width, width.replace('w-', 'h-'));
    // The button takes the same-size avatars' own size classes.
    const sizeClasses = (el: Element) =>
      Array.from(el.classList).filter((cls) =>
        /^wave:(w-|h-|text-(\[|xs$|sm$|base$|lg$))/.test(cls),
      );
    expect(sizeClasses(button)).toHaveLength(3);
    expect(sizeClasses(button)).toEqual(sizeClasses(screen.getByRole('img', { name: 'Alice' })));
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
    expect(first).not.toHaveClass('wave:-ms-2');
    expect(second).toHaveClass('wave:-ms-2', 'wave:ring-2', 'wave:ring-background');
    expect(second.className).not.toMatch(/-ml-|ring-white/);
    expect(screen.getByRole('button')).toHaveClass('wave:-ms-2', 'wave:ring-background');
  });

  // button-provider#27 (C-REF): ref is declared in the props interface.
  it('declares ref in AvatarGroupProps (C-REF)', () => {
    expectTypeOf<AvatarGroupProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
  });

  describe('layouts and member size (0.13)', () => {
    const items = (root: HTMLElement) =>
      Array.from(root.querySelectorAll<HTMLElement>('.wave-avatar-group__item'));

    it('renders data-layout, stack by default', () => {
      render(<AvatarGroup aria-label="Team">{members()}</AvatarGroup>);
      expect(screen.getByRole('group', { name: 'Team' })).toHaveAttribute('data-layout', 'stack');
    });

    it('size reaches the members that set none, and the overflow button', () => {
      render(
        <AvatarGroup aria-label="Team" size="large" max={1}>
          {members(['Alice', 'Bob'])}
        </AvatarGroup>,
      );
      const group = screen.getByRole('group', { name: 'Team' });
      expect(group.querySelector('.wave-avatar')).toHaveAttribute('data-size', 'large');
      expect(screen.getByRole('button', { name: '1 more' }).className).toContain('wave:w-12');
    });

    it('a member with its own size keeps it', () => {
      render(
        <AvatarGroup aria-label="Team" size="large">
          <Avatar name="Alice" size="small" />
          <Avatar name="Bob" />
        </AvatarGroup>,
      );
      const avatars = screen.getByRole('group', { name: 'Team' }).querySelectorAll('.wave-avatar');
      expect(avatars[0]).toHaveAttribute('data-size', 'small');
      expect(avatars[1]).toHaveAttribute('data-size', 'large');
    });

    it('the default size is medium, as before', () => {
      render(<AvatarGroup aria-label="Team">{members(['Alice'])}</AvatarGroup>);
      expect(screen.getByRole('group').querySelector('.wave-avatar')).toHaveAttribute(
        'data-size',
        'medium',
      );
    });

    it('numeric sizes reach the members', () => {
      render(
        <AvatarGroup aria-label="Team" size={64}>
          {members(['Alice'])}
        </AvatarGroup>,
      );
      expect(screen.getByRole('group').querySelector('.wave-avatar')).toHaveAttribute(
        'data-size',
        '64',
      );
    });

    it('stack overlaps every member after the first', () => {
      render(<AvatarGroup aria-label="Team">{members()}</AvatarGroup>);
      const [first, ...rest] = items(screen.getByRole('group'));
      expect(first!.className).not.toContain('wave:-ms-2');
      for (const item of rest) expect(item).toHaveClass('wave:-ms-2');
    });

    it('spread puts the members side by side with a gap and no overlap', () => {
      render(
        <AvatarGroup aria-label="Team" layout="spread">
          {members()}
        </AvatarGroup>,
      );
      const group = screen.getByRole('group', { name: 'Team' });
      expect(group).toHaveAttribute('data-layout', 'spread');
      expect(group).toHaveClass('wave:gap-1');
      for (const item of items(group)) expect(item.className).not.toContain('wave:-ms-2');
    });

    it('spread keeps the overflow button without overlap', () => {
      render(
        <AvatarGroup aria-label="Team" layout="spread" max={2}>
          {members()}
        </AvatarGroup>,
      );
      expect(screen.getByRole('button', { name: '2 more' }).className).not.toContain('wave:-ms-2');
    });

    it('pie draws up to three wedges as one circle, hidden from assistive technology', () => {
      render(
        <AvatarGroup aria-label="Team" layout="pie">
          {members(['Alice', 'Bob', 'Charlie'])}
        </AvatarGroup>,
      );
      const group = screen.getByRole('group', { name: 'Team' });
      expect(group).toHaveAttribute('data-layout', 'pie');
      const wedges = items(group);
      expect(wedges).toHaveLength(3);
      for (const wedge of wedges) {
        expect(wedge).toHaveAttribute('aria-hidden', 'true');
        expect(wedge.className).toContain('clip-path');
      }
      expect(screen.queryByRole('img', { name: 'Alice' })).toBeNull();
    });

    it('pie defaults to the large size and sends members past three to the overflow', () => {
      render(
        <AvatarGroup aria-label="Team" layout="pie">
          {members(['A', 'B', 'C', 'D', 'E'])}
        </AvatarGroup>,
      );
      const group = screen.getByRole('group', { name: 'Team' });
      expect(items(group)).toHaveLength(3);
      expect(group.querySelector('.wave-avatar')).toHaveAttribute('data-size', 'large');
      expect(screen.getByRole('button', { name: '2 more' })).toBeInTheDocument();
    });

    it('a pie of one member is a full circle and a pie of two is two halves', () => {
      const { rerender } = render(
        <AvatarGroup aria-label="Team" layout="pie">
          {members(['Alice'])}
        </AvatarGroup>,
      );
      expect(items(screen.getByRole('group'))).toHaveLength(1);
      expect(items(screen.getByRole('group'))[0]!.className).not.toContain('clip-path');
      rerender(
        <AvatarGroup aria-label="Team" layout="pie">
          {members(['Alice', 'Bob'])}
        </AvatarGroup>,
      );
      const [left, right] = items(screen.getByRole('group'));
      expect(left!.className).toContain('inset(0_50%_0_0)');
      expect(right!.className).toContain('inset(0_0_0_50%)');
    });

    it('is axe clean in every layout', async () => {
      for (const layout of ['stack', 'spread', 'pie'] as const) {
        const { container, unmount } = render(
          <AvatarGroup aria-label="Team" layout={layout} max={4}>
            {members(['A', 'B', 'C', 'D', 'E'])}
          </AvatarGroup>,
        );
        await expectNoA11yViolations(container);
        unmount();
      }
    });

    it('types layout and numeric size', () => {
      expectTypeOf<AvatarGroupProps['layout']>().toEqualTypeOf<
        'stack' | 'spread' | 'pie' | undefined
      >();
      expectTypeOf<AvatarGroupProps['size']>().toEqualTypeOf<AvatarSize | undefined>();
    });
  });

  describe('parts, indicator and controlled open (0.13)', () => {
    const names = (count: number) => Array.from({ length: count }, (_, i) => `Person ${i + 1}`);

    it('exposes Item and Popover as compound members and flat names', () => {
      expect(AvatarGroupItem).toBe(AvatarGroup.Item);
      expect(AvatarGroupPopover).toBe(AvatarGroup.Popover);
      expect(AvatarGroup.Item.displayName).toBe('AvatarGroupItem');
      expect(AvatarGroup.Popover.displayName).toBe('AvatarGroupPopover');
    });

    it('server output of a part written in a Server Component equals the plain parts', () => {
      const plain = (
        <AvatarGroup aria-label="Team" max={1}>
          <AvatarGroup.Item name="Alice" />
          <AvatarGroup.Item name="Bob" />
        </AvatarGroup>
      );
      const client = (
        <AvatarGroup aria-label="Team" max={1}>
          {React.createElement(asClientReference(AvatarGroup.Item), { name: 'Alice' })}
          {React.createElement(asClientReference(AvatarGroup.Item), { name: 'Bob' })}
        </AvatarGroup>
      );
      expect(renderToString(client)).toBe(renderToString(plain));
    });

    it('an Item renders an avatar in the group', () => {
      render(
        <AvatarGroup aria-label="Team">
          <AvatarGroup.Item name="Alice" />
        </AvatarGroup>,
      );
      expect(screen.getByRole('img', { name: 'Alice' })).toBeInTheDocument();
    });

    it('caps the shown count at 99+ while the name keeps the real number', () => {
      render(
        <AvatarGroup aria-label="Team" max={0}>
          {names(120).map((n) => (
            <AvatarGroup.Item key={n} name={n} />
          ))}
        </AvatarGroup>,
      );
      const button = screen.getByRole('button', { name: '120 more' });
      expect(button).toHaveTextContent('99+');
      expect(button).not.toHaveTextContent('120');
    });

    it('shows the exact count up to 99', () => {
      render(
        <AvatarGroup aria-label="Team" max={0}>
          {names(99).map((n) => (
            <AvatarGroup.Item key={n} name={n} />
          ))}
        </AvatarGroup>,
      );
      expect(screen.getByRole('button', { name: '99 more' })).toHaveTextContent('+99');
    });

    it('the icon indicator draws an icon instead of the count, with the same name', () => {
      render(
        <AvatarGroup aria-label="Team" max={1} overflowIndicator="icon">
          {names(4).map((n) => (
            <AvatarGroup.Item key={n} name={n} />
          ))}
        </AvatarGroup>,
      );
      const button = screen.getByRole('button', { name: '3 more' });
      expect(button.querySelector('svg')).not.toBeNull();
      expect(button).not.toHaveTextContent('+');
    });

    it('lists hidden Items as avatars with their names', async () => {
      const user = userEvent.setup();
      render(
        <AvatarGroup aria-label="Team" max={1}>
          <AvatarGroup.Item name="Alice" />
          <AvatarGroup.Item name="Bob Builder" />
          <AvatarGroup.Item name="Carol" />
        </AvatarGroup>,
      );
      await user.click(screen.getByRole('button', { name: '2 more' }));
      const list = within(screen.getByRole('dialog', { name: '2 more' })).getByRole('list');
      const rows = within(list).getAllByRole('listitem');
      expect(rows).toHaveLength(2);
      expect(within(rows[0]!).getByText('Bob Builder')).toBeInTheDocument();
      expect(rows[0]!.querySelector('.wave-avatar')).not.toBeNull();
      expect(within(rows[1]!).getByText('Carol')).toBeInTheDocument();
    });

    it('lists a hidden direct Avatar by its name only, as in 0.12', async () => {
      const user = userEvent.setup();
      render(
        <AvatarGroup aria-label="Team" max={1}>
          {members(['Alice', 'Bob'])}
        </AvatarGroup>,
      );
      await user.click(screen.getByRole('button', { name: '1 more' }));
      const row = within(screen.getByRole('dialog')).getByRole('listitem');
      expect(row).toHaveTextContent(/^Bob$/);
      expect(row.querySelector('.wave-avatar')).toBeNull();
    });

    it('a consumer-written Popover with its own overflow items replaces the automatic one', async () => {
      const user = userEvent.setup();
      render(
        <AvatarGroup aria-label="Team">
          <AvatarGroup.Item name="Alice" />
          <AvatarGroup.Popover>
            <AvatarGroup.Item name="Bob Builder" />
            <AvatarGroup.Item name="Carol" />
          </AvatarGroup.Popover>
        </AvatarGroup>,
      );
      expect(screen.getAllByRole('img', { name: 'Alice' })).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: '2 more' }));
      const dialog = screen.getByRole('dialog', { name: '2 more' });
      expect(within(dialog).getByText('Bob Builder')).toBeInTheDocument();
      expect(within(dialog).getByText('Carol')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('button', { name: '2 more' })).toHaveFocus();
    });

    it('defaultOpen opens the popup at mount', () => {
      render(
        <AvatarGroup aria-label="Team" max={1} defaultOpen>
          {members(['Alice', 'Bob'])}
        </AvatarGroup>,
      );
      expect(screen.getByRole('dialog', { name: '1 more' })).toBeInTheDocument();
    });

    it('a controlled open follows the prop and reports requests with a reason', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const { rerender } = render(
        <AvatarGroup aria-label="Team" max={1} open={false} onOpenChange={onOpenChange}>
          {members(['Alice', 'Bob'])}
        </AvatarGroup>,
      );
      await user.click(screen.getByRole('button', { name: '1 more' }));
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenLastCalledWith(
        true,
        expect.objectContaining({ reason: 'trigger', event: expect.any(Event) }),
      );
      expect(screen.queryByRole('dialog')).toBeNull();
      rerender(
        <AvatarGroup aria-label="Team" max={1} open onOpenChange={onOpenChange}>
          {members(['Alice', 'Bob'])}
        </AvatarGroup>,
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ reason: 'escape' }),
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('reports an outside press with its reason', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <>
          <button type="button">Elsewhere</button>
          <AvatarGroup aria-label="Team" max={1} defaultOpen onOpenChange={onOpenChange}>
            {members(['Alice', 'Bob'])}
          </AvatarGroup>
        </>,
      );
      await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
      expect(onOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: 'outside-press' }),
      );
    });

    it('calls onOpenChange once per request in StrictMode, with its details', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <React.StrictMode>
          <AvatarGroup aria-label="Team" max={1} onOpenChange={onOpenChange}>
            {members(['Alice', 'Bob'])}
          </AvatarGroup>
        </React.StrictMode>,
      );
      await user.click(screen.getByRole('button', { name: '1 more' }));
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(true, {
        reason: 'trigger',
        event: expect.any(Event),
      });
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledTimes(2);
      expect(onOpenChange).toHaveBeenLastCalledWith(false, {
        reason: 'escape',
        event: expect.any(Event),
      });
    });

    it('is axe clean closed and open, with Items', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <AvatarGroup aria-label="Team" max={1}>
          <AvatarGroup.Item name="Alice" />
          <AvatarGroup.Item name="Bob" />
          <AvatarGroup.Item name="Carol" />
        </AvatarGroup>,
      );
      await expectNoA11yViolations(container);
      await user.click(screen.getByRole('button', { name: '2 more' }));
      await expectNoA11yViolations(document.body);
    });

    it('types the new props', () => {
      expectTypeOf<AvatarGroupProps['overflowIndicator']>().toEqualTypeOf<
        'count' | 'icon' | undefined
      >();
      expectTypeOf<AvatarGroupProps['open']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<NonNullable<AvatarGroupProps['onOpenChange']>>().toBeFunction();
      // `details` is required (1.0).
      expectTypeOf<NonNullable<AvatarGroupProps['onOpenChange']>>().parameters.toEqualTypeOf<
        [open: boolean, details: AvatarGroupOpenChangeDetails]
      >();
      expectTypeOf<Omit<AvatarGroupItemProps, 'slotProps'>>().toEqualTypeOf<
        Omit<AvatarProps, 'slotProps'>
      >();
    });
  });

  describe('pie layout initials', () => {
    it('hides the initials of wedges, which would overlap, and keeps them in other layouts', () => {
      const { container, rerender } = render(
        <AvatarGroup aria-label="Team" layout="pie">
          {members(['Alice Smith', 'Bob Jones', 'Carol White'])}
        </AvatarGroup>,
      );
      const initials = () => Array.from(container.querySelectorAll('.wave-avatar__initials'));
      expect(initials()).toHaveLength(3);
      for (const el of initials()) expect(el).toHaveClass('wave:invisible');
      rerender(
        <AvatarGroup aria-label="Team" layout="stack">
          {members(['Alice Smith', 'Bob Jones', 'Carol White'])}
        </AvatarGroup>,
      );
      for (const el of initials()) expect(el).not.toHaveClass('wave:invisible');
    });
  });
});

describe('AvatarGroup and AvatarGroup.Item — slotProps', () => {
  type GroupSlotProps = NonNullable<AvatarGroupProps['slotProps']>;
  type ItemSlotProps = NonNullable<AvatarGroupItemProps['slotProps']>;
  const GROUP_PARTS: GroupSlotProps = { item: {}, pie: {}, surface: {}, list: {}, listItem: {} };
  const all = (root: ParentNode, cls: string) =>
    Array.from(root.querySelectorAll<HTMLElement>(`.${cls}`));
  const STRUCTURE_LOCKS = ['role', 'tabindex', 'data-roving-container', 'hidden', 'inert'];

  /** Two members shown, two in the open popup (an Item, which draws a row, and an Avatar). */
  function Team({
    parts,
    item,
    ...props
  }: Partial<AvatarGroupProps> & { parts?: GroupSlotProps; item?: ItemSlotProps }) {
    return (
      <AvatarGroup aria-label="Team" max={2} defaultOpen slotProps={parts} {...props}>
        <AvatarGroup.Item name="Alice Smith" slotProps={item} />
        <AvatarGroup.Item name="Bob Jones" slotProps={item} />
        <AvatarGroup.Item name="Carol White" slotProps={item} />
        <Avatar name="Dave" />
      </AvatarGroup>
    );
  }
  function Pie({ parts }: { parts?: GroupSlotProps }) {
    return (
      <AvatarGroup aria-label="Team" layout="pie" slotProps={parts}>
        <AvatarGroup.Item name="Alice Smith" />
        <AvatarGroup.Item name="Bob Jones" />
      </AvatarGroup>
    );
  }
  const surfaceOf = () => document.querySelector<HTMLElement>(`.${avatarGroupClassNames.surface}`)!;

  // Captured from 112d7f8's dist: the open popup on the client (a portal renders nothing on the
  // server); the pie on the client and the server alike.
  const ITEM =
    'wave-avatar-group__item wave:inline-flex wave:rounded-full wave:ring-2 wave:ring-background';
  const SURFACE =
    'wave-avatar-group__surface wave:min-w-32 wave:max-w-xs wave:rounded-md wave:border wave:border-border wave:bg-background wave:p-2 wave:text-body-1 wave:text-foreground wave:shadow-16 wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:transition-[opacity,translate] wave:duration-wave-normal wave:ease-wave-decelerate-mid wave:data-[presence=exiting]:duration-wave-faster wave:data-[presence=exiting]:ease-wave-accelerate-min wave:motion-reduce:transition-none wave:data-[presence=entering]:starting:opacity-0 wave:data-[presence=exiting]:opacity-0 wave:data-[side=top]:data-[presence=entering]:starting:translate-y-1 wave:data-[side=top]:data-[presence=exiting]:translate-y-1 wave:data-[side=bottom]:data-[presence=entering]:starting:-translate-y-1 wave:data-[side=bottom]:data-[presence=exiting]:-translate-y-1 wave:data-[side=left]:data-[presence=entering]:starting:translate-x-1 wave:data-[side=left]:data-[presence=exiting]:translate-x-1 wave:data-[side=right]:data-[presence=entering]:starting:-translate-x-1 wave:data-[side=right]:data-[presence=exiting]:-translate-x-1';
  const OPEN_PINS = [
    `<span class="${ITEM}">`,
    `<span class="${ITEM} wave:-ms-2">`,
    `<div aria-label="2 more" class="${SURFACE}" data-align="start" data-presence="entered" data-side="bottom" data-state="open" id="avatar-group-overflow-_id0_" role="dialog" tabindex="-1">`,
    '<ul class="wave-avatar-group__list wave:m-0 wave:flex wave:list-none wave:flex-col wave:gap-1 wave:p-0">',
    '<li class="wave-avatar-group__list-item wave:px-1 wave:py-0.5">',
    '<li class="wave-avatar-group__list-item wave:px-1 wave:py-0.5">',
    '<span class="wave-avatar-group-item__name">',
  ].join('\n');
  const PIE_PINS = [
    '<span class="wave-avatar-group__pie wave:relative wave:inline-block wave:shrink-0 wave:overflow-hidden wave:rounded-full wave:w-12 wave:h-12 wave:text-base">',
    '<span aria-hidden="true" class="wave-avatar-group__item wave:absolute wave:inset-0 wave:inline-flex wave:[clip-path:inset(0_50%_0_0)]">',
    '<span aria-hidden="true" class="wave-avatar-group__item wave:absolute wave:inset-0 wave:inline-flex wave:[clip-path:inset(0_0_0_50%)]">',
  ].join('\n');
  const openParts = () => [
    ...all(document, avatarGroupClassNames.item),
    surfaceOf(),
    ...all(document, avatarGroupClassNames.list),
    ...all(document, avatarGroupClassNames.listItem),
    ...all(document, avatarGroupItemClassNames.name),
  ];
  const pieParts = (root: ParentNode = document) => [
    ...all(root, avatarGroupClassNames.pie),
    ...all(root, avatarGroupClassNames.item),
  ];

  it('renders the parts of 112d7f8 (attributes sorted): the open popup and the pie', () => {
    for (const [parts, item] of [
      [undefined, undefined],
      [GROUP_PARTS, { name: {} }],
    ] as const) {
      const view = render(<Team parts={parts} item={item} />);
      // The position is the positioning's (tested below), not a pinned value.
      const surface = surfaceOf();
      expect(surface.style.position).toBe('fixed');
      const style = surface.getAttribute('style')!;
      surface.removeAttribute('style');
      expect(openingTags(...openParts())).toBe(OPEN_PINS);
      surface.setAttribute('style', style);
      view.unmount();

      const pie = render(<Pie parts={parts} />);
      expect(openingTags(...pieParts())).toBe(PIE_PINS);
      pie.unmount();
      const template = document.createElement('template');
      template.innerHTML = renderToString(<Pie parts={parts} />);
      expect(openingTags(...pieParts(template.content))).toBe(PIE_PINS);
    }
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    expectInertSlotProps(
      (parts: GroupSlotProps | undefined) => <Team parts={parts} />,
      GROUP_PARTS,
    );
    expectInertSlotProps((item: ItemSlotProps | undefined) => <Team item={item} />, { name: {} });
    expectInertSlotProps((parts: GroupSlotProps | undefined) => <Pie parts={parts} />, GROUP_PARTS);
    expectInertSlotProps(
      (parts: GroupSlotProps | undefined) => (
        <AvatarGroup aria-label="Team" layout="spread" slotProps={parts}>
          <AvatarGroup.Item name="Alice Smith" />
          <AvatarGroup.Popover defaultOpen label="More people">
            <AvatarGroup.Item name="Bob Jones" />
            <a href="#erin">Erin</a>
          </AvatarGroup.Popover>
        </AvatarGroup>
      ),
      GROUP_PARTS,
    );
  });

  it('puts your className, style, data-* and ref on each part', () => {
    const refs: Element[] = [];
    const collect = (node: Element | null) => void (node && refs.push(node));
    const part = (name: string, className: string) => ({
      className: `my-${name} ${className}`,
      style: { opacity: 0.5 },
      'data-part': name,
      ref: collect,
    });
    render(
      <Team
        parts={{
          item: part('item', 'ring-4'),
          surface: part('surface', 'shadow-4'),
          list: part('list', 'gap-2'),
          listItem: part('listItem', 'px-2'),
        }}
        item={{ name: part('name', '') }}
      />,
    );
    for (const [cls, name, conflict, count] of [
      [avatarGroupClassNames.item, 'item', 'wave:ring-2', 2],
      [avatarGroupClassNames.surface, 'surface', 'wave:shadow-16', 1],
      [avatarGroupClassNames.list, 'list', 'wave:gap-1', 1],
      [avatarGroupClassNames.listItem, 'listItem', 'wave:px-1', 2],
      [avatarGroupItemClassNames.name, 'name', undefined, 1],
    ] as const) {
      const elements = all(document, cls);
      expect(elements).toHaveLength(count);
      for (const element of elements) {
        expect(element.classList[0]).toBe(cls);
        expect(element).toHaveClass(`my-${name}`);
        // Your class replaces a conflicting one of the part.
        if (conflict) expect(element).not.toHaveClass(conflict);
        expect(element).toHaveAttribute('data-part', name);
        expect(element).toHaveStyle({ opacity: '0.5' });
        expect(refs).toContain(element);
      }
    }
    expect(refs).toHaveLength(7);
    // The group, the button and the members take none of it.
    expect(screen.getByRole('group', { name: 'Team' })).not.toHaveAttribute('data-part');
    expect(screen.getByRole('button', { name: '2 more' })).not.toHaveAttribute('data-part');
  });

  it('puts the pie and wedge parts on the pie', () => {
    const pieRef = React.createRef<HTMLSpanElement>();
    render(
      <Pie
        parts={{
          pie: { className: 'my-pie rounded-md', 'data-part': 'pie', ref: pieRef },
          item: { className: 'my-wedge', 'data-part': 'wedge' },
        }}
      />,
    );
    const [pie] = all(document, avatarGroupClassNames.pie);
    expect(pie.classList[0]).toBe(avatarGroupClassNames.pie);
    expect(pie).toHaveClass('my-pie', 'rounded-md');
    expect(pie).not.toHaveClass('wave:rounded-full');
    expect(pie).toHaveAttribute('data-part', 'pie');
    expect(pieRef.current).toBe(pie);
    const wedges = all(document, avatarGroupClassNames.item);
    expect(wedges).toHaveLength(2);
    for (const wedge of wedges) {
      expect(wedge).toHaveClass('my-wedge');
      expect(wedge).toHaveAttribute('data-part', 'wedge');
      expect(pie).toContainElement(wedge);
    }
  });

  it('locks the role, tab stop, roving marker and hidden state of the wrappers and the list', () => {
    const attempt = {
      role: 'button',
      tabIndex: 0,
      'data-roving-container': '',
      hidden: true,
      inert: true,
      'aria-hidden': true,
    } as unknown as GroupSlotProps['item'];
    render(
      <Team
        parts={{
          item: attempt,
          list: attempt as GroupSlotProps['list'],
          listItem: attempt as GroupSlotProps['listItem'],
        }}
      />,
    );
    for (const cls of [
      avatarGroupClassNames.item,
      avatarGroupClassNames.list,
      avatarGroupClassNames.listItem,
    ]) {
      for (const element of all(document, cls)) {
        for (const name of [...STRUCTURE_LOCKS, 'aria-hidden']) {
          expect(element).not.toHaveAttribute(name);
        }
      }
    }
    expect(screen.getByRole('img', { name: 'Alice Smith' })).toBeVisible();
    expect(within(screen.getByRole('dialog')).getAllByRole('listitem')).toHaveLength(2);
  });

  it('locks the pie as the wrappers, and keeps its wedges hidden from assistive technology', () => {
    const attempt = {
      role: 'img',
      tabIndex: 0,
      'data-roving-container': '',
      hidden: true,
      inert: true,
      'aria-hidden': false,
    } as unknown as GroupSlotProps['item'];
    render(<Pie parts={{ pie: attempt, item: attempt }} />);
    const [pie, ...wedges] = pieParts();
    for (const name of [...STRUCTURE_LOCKS, 'aria-hidden']) {
      expect(pie).not.toHaveAttribute(name);
    }
    for (const wedge of wedges) {
      for (const name of STRUCTURE_LOCKS) expect(wedge).not.toHaveAttribute(name);
      expect(wedge).toHaveAttribute('aria-hidden', 'true');
    }
    expect(screen.getByRole('group', { name: 'Team' })).toBeInTheDocument();
  });

  it('locks the popup’s wiring, state and position', () => {
    const attempt = {
      id: 'mine',
      role: 'menu',
      'aria-label': 'Replaced',
      'aria-modal': true,
      tabIndex: 0,
      'data-state': 'closed',
      'data-side': 'top',
      'data-align': 'end',
      hidden: true,
      inert: true,
      'aria-hidden': true,
      style: { position: 'static', top: '9px', opacity: 0.5 },
    } as unknown as GroupSlotProps['surface'];
    render(<Team parts={{ surface: attempt }} />);
    const surface = screen.getByRole('dialog', { name: '2 more' });
    expect(surface).toHaveClass(avatarGroupClassNames.surface);
    expect(surface.id).not.toBe('mine');
    expect(screen.getByRole('button', { name: '2 more' })).toHaveAttribute(
      'aria-controls',
      surface.id,
    );
    expect(surface).toHaveAttribute('tabindex', '-1');
    expect(surface).toHaveAttribute('data-state', 'open');
    expect(surface).toHaveAttribute('data-side', 'bottom');
    expect(surface).toHaveAttribute('data-align', 'start');
    for (const name of ['aria-modal', 'hidden', 'inert', 'aria-hidden']) {
      expect(surface).not.toHaveAttribute(name);
    }
    // The position wins over your style; the rest of it applies.
    expect(surface.style.position).toBe('fixed');
    expect(surface.style.top).toBe('0px');
    expect(surface).toHaveStyle({ opacity: '0.5' });
  });

  it('runs your key handler before the popup’s Tab handling, which preventDefault() skips', () => {
    const onOpenChange = vi.fn();
    const onKeyDown = vi.fn();
    const { rerender } = render(
      <Team parts={{ surface: { onKeyDown } }} onOpenChange={onOpenChange} />,
    );
    fireEvent.keyDown(surfaceOf(), { key: 'Tab' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(
      <Team
        key="again"
        parts={{ surface: { onKeyDown: (event) => event.preventDefault() } }}
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.keyDown(surfaceOf(), { key: 'Tab' });
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('moves focus to the popup and keeps its own refs with an inline ref of the part', async () => {
    const refs: Array<HTMLDivElement | null> = [];
    const ui = () => (
      <Team parts={{ surface: { ref: (node: HTMLDivElement | null) => void refs.push(node) } }} />
    );
    const { rerender } = render(ui());
    await act(async () => {});
    const surface = screen.getByRole('dialog');
    expect(document.activeElement).toBe(surface);
    rerender(ui());
    rerender(ui());
    expect(refs.filter((node) => node !== null)).toEqual([surface, surface, surface]);
    // Escape still closes it (the dismiss layer knows the surface) and focus returns.
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '2 more' }));
  });

  it('gives an AvatarGroup.Popover of your own the popup’s parts', () => {
    render(
      <AvatarGroup
        aria-label="Team"
        slotProps={{
          surface: { className: 'my-surface' },
          list: { className: 'my-list' },
          listItem: { className: 'my-list-item' },
        }}
      >
        <AvatarGroup.Item name="Alice Smith" />
        <AvatarGroup.Popover defaultOpen label="More people">
          <AvatarGroup.Item name="Bob Jones" slotProps={{ name: { className: 'my-name' } }} />
          <a href="#erin">Erin</a>
        </AvatarGroup.Popover>
      </AvatarGroup>,
    );
    const surface = screen.getByRole('dialog', { name: 'More people' });
    expect(surface).toHaveClass('my-surface');
    expect(within(surface).getByRole('list')).toHaveClass('my-list');
    for (const listItem of within(surface).getAllByRole('listitem')) {
      expect(listItem).toHaveClass('my-list-item');
    }
    expect(within(surface).getByText('Bob Jones')).toHaveClass('my-name');
  });

  it('locks the role, name and hidden state of the name of an item row', () => {
    const attempt = {
      role: 'heading',
      'aria-label': 'Replaced',
      hidden: true,
      inert: true,
      'aria-hidden': true,
    } as unknown as ItemSlotProps['name'];
    render(<Team item={{ name: attempt }} />);
    const [name] = all(document, avatarGroupItemClassNames.name);
    for (const attribute of ['role', 'aria-label', 'hidden', 'inert', 'aria-hidden']) {
      expect(name).not.toHaveAttribute(attribute);
    }
    expect(within(screen.getByRole('dialog')).getByText('Carol White')).toBe(name);
  });

  it('draws no name in the group: an inline item takes its own props', () => {
    render(
      <AvatarGroup aria-label="Team">
        <AvatarGroup.Item
          name="Alice Smith"
          className="my-item"
          slotProps={{ name: { className: 'my-name' } }}
        />
      </AvatarGroup>,
    );
    expect(all(document, avatarGroupItemClassNames.name)).toHaveLength(0);
    expect(document.querySelector('.my-name')).toBeNull();
    expect(screen.getByRole('img', { name: 'Alice Smith' })).toHaveClass(
      avatarGroupItemClassNames.root,
      'my-item',
    );
  });

  it('keeps the arrow-key order of a toolbar around the group', async () => {
    const user = userEvent.setup();
    const attempt = { tabIndex: 0, 'data-roving-container': '' } as GroupSlotProps['item'];
    render(
      <Toolbar aria-label="Tools">
        <Toolbar.Button>Edit</Toolbar.Button>
        <AvatarGroup aria-label="Team" max={2} slotProps={{ item: attempt }}>
          <a href="#alice">Alice</a>
          <a href="#bob">Bob</a>
          <Avatar name="Carol" />
        </AvatarGroup>
      </Toolbar>,
    );
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('link', { name: 'Bob' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: '1 more' })).toHaveFocus();
    expect(toolbar.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    for (const item of all(toolbar, avatarGroupClassNames.item)) {
      expect(item).not.toHaveAttribute('tabindex');
      expect(item).not.toHaveAttribute('data-roving-container');
    }
  });

  it('renders the members again for a new popup part, not for a new wrapper part', () => {
    // A member that reads the group's context, as an Avatar does, counting its renders.
    const renders = vi.fn();
    const Member = () => {
      renders(React.useContext(AvatarGroupContext));
      return <Avatar name="Alice Smith" />;
    };
    const member = <Member />;
    const surface = { className: 'my-surface' };
    const ui = (parts: GroupSlotProps) => (
      <AvatarGroup aria-label="Team" slotProps={parts}>
        {member}
      </AvatarGroup>
    );
    const { rerender } = render(ui({ item: { className: 'a' }, surface }));
    renders.mockClear();
    rerender(ui({ item: { className: 'b' }, surface }));
    expect(renders).not.toHaveBeenCalled();
    rerender(ui({ item: { className: 'b' }, surface: { className: 'my-surface' } }));
    expect(renders).toHaveBeenCalledTimes(1);
    expect(renders.mock.calls[0][0]).toMatchObject({ surface: { className: 'my-surface' } });
  });

  it('calls each part handler once per event in StrictMode', () => {
    const item = vi.fn();
    const listItem = vi.fn();
    const name = vi.fn();
    render(
      <React.StrictMode>
        <Team
          parts={{ item: { onClick: item }, listItem: { onClick: listItem } }}
          item={{ name: { onClick: name } }}
        />
      </React.StrictMode>,
    );
    fireEvent.click(all(document, avatarGroupClassNames.item)[0]);
    fireEvent.click(all(document, avatarGroupItemClassNames.name)[0]);
    expect(item).toHaveBeenCalledTimes(1);
    expect(listItem).toHaveBeenCalledTimes(1);
    expect(name).toHaveBeenCalledTimes(1);
  });

  it('keeps the overlap of a stack in right-to-left layouts', () => {
    renderWithProviders(<Team parts={{ item: { className: 'my-item' } }} />, { dir: 'rtl' });
    const [first, second] = all(document, avatarGroupClassNames.item);
    expect(first).toHaveClass('my-item');
    expect(first).not.toHaveClass('wave:-ms-2');
    expect(second).toHaveClass('my-item', 'wave:-ms-2');
  });

  it('has no accessibility violations with every part customised', async () => {
    render(
      <Team
        parts={{
          item: { className: 'my-item' },
          surface: { className: 'my-surface', 'aria-describedby': undefined },
          list: { className: 'my-list' },
          listItem: { className: 'my-list-item' },
        }}
        item={{ name: { className: 'my-name' } }}
      />,
    );
    await act(async () => {});
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof GroupSlotProps>().toEqualTypeOf<
      'item' | 'pie' | 'surface' | 'list' | 'listItem'
    >();
    expectTypeOf<keyof ItemSlotProps>().toEqualTypeOf<'name'>();
    expectTypeOf<NonNullable<GroupSlotProps['surface']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<GroupSlotProps['list']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLUListElement> | undefined
    >();
    expectTypeOf<NonNullable<GroupSlotProps['listItem']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLLIElement> | undefined
    >();
    expectTypeOf<NonNullable<ItemSlotProps['name']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    // @ts-expect-error -- the group draws the content of the popup
    const parts: GroupSlotProps = { surface: { children: 'x' } };
    // @ts-expect-error -- the item draws the name
    const item: ItemSlotProps = { name: { children: 'x' } };
    expect([parts, item]).toHaveLength(2);
  });
});
