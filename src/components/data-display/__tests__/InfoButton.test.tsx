import * as React from 'react';
import { afterEach, beforeEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { InfoButton, type InfoButtonProps } from '../InfoButton';
import { Dialog } from '../../overlays/Dialog';
import { Popover } from '../../overlays/Popover';
import { infoButtonClassNames } from '../../../lib/classNames';
import {
  expectInertSlotProps,
  expectNoA11yViolations,
  findDanglingIdRefs,
  mockAnimations,
  mockRect,
  normaliseIds,
  sortAttributes,
  testComposedHandler,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

const INFO = (
  <>
    Use 12 characters. <a href="#rules">Rules</a>
  </>
);
const button = () => screen.getByRole('button', { name: 'Information' });
const note = () => screen.getByRole('note');

describe('InfoButton (Phase 4 D28, D30)', () => {
  testSystemProps(InfoButton, {
    expectedTag: 'button',
    displayName: 'InfoButton',
    defaultProps: { info: 'Some info' },
  });
  testNoImplicitSubmit(InfoButton, { defaultProps: { info: 'Some info' } });

  it('is named Information, or by its own aria-label, and has no aria-haspopup', () => {
    const { rerender } = render(<InfoButton info="x" />);
    expect(button()).not.toHaveAttribute('aria-haspopup');
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    rerender(<InfoButton info="x" aria-label="About billing" />);
    expect(screen.getByRole('button', { name: 'About billing' })).toBeInTheDocument();
  });

  it('closed: one hidden copy of info describes the button, also in the server HTML', () => {
    render(<InfoButton info={INFO} />);
    expect(button()).toHaveAccessibleDescription('Use 12 characters. Rules');
    expect(screen.queryByRole('note')).toBeNull();
    const html = renderToString(<InfoButton info="Use 12 characters." />);
    expect(html.split('Use 12 characters.')).toHaveLength(2);
  });

  it('a click opens the note without moving focus; the note describes the button, one copy', async () => {
    const user = userEvent.setup();
    render(<InfoButton info={INFO} openOnHover={false} />);
    await user.click(button());
    expect(button()).toHaveFocus();
    expect(button()).toHaveAttribute('aria-expanded', 'true');
    expect(button()).toHaveAttribute('aria-controls', note().id);
    expect(button()).toHaveAccessibleDescription('Use 12 characters. Rules');
    expect(screen.getAllByText('Use 12 characters.', { exact: false })).toHaveLength(1);
    expect(note()).toHaveAttribute('data-state', 'open');
    expect(note()).toHaveAttribute('data-presence');
    expect(note()).toHaveAttribute('data-wave-infolabel-surface', '');
    expect(note()).toHaveAccessibleName('Information');
    expect(note().querySelector('[data-wave-popover-arrow]')).not.toBeNull();
  });

  it('the note is not the description target (Firefox would read its name)', async () => {
    const user = userEvent.setup();
    render(<InfoButton info="Some info" openOnHover={false} />);
    await user.click(button());
    const describedBy = button().getAttribute('aria-describedby') ?? '';
    expect(describedBy.split(' ')).not.toContain(note().id);
    const description = document.getElementById(describedBy);
    expect(description).not.toBeNull();
    expect(note().contains(description)).toBe(true);
    expect(description).not.toHaveAttribute('aria-labelledby');
  });

  it('a click on a pinned note closes it', async () => {
    const user = userEvent.setup();
    render(<InfoButton info="Some info" openOnHover={false} />);
    await user.click(button());
    await user.click(button());
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('info changing while open updates the note, still one copy (Review Focus 5)', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<InfoButton info="First" openOnHover={false} />);
    await user.click(button());
    rerender(<InfoButton info="Second" openOnHover={false} />);
    expect(note()).toHaveTextContent('Second');
    expect(screen.getAllByText('Second')).toHaveLength(1);
    expect(screen.queryByText('First')).toBeNull();
  });

  it('sizes the glyph and keeps a 24px box', () => {
    render(<InfoButton info="x" size="large" />);
    expect(button()).toHaveClass('wave:size-6', 'wave:-my-px');
    expect(button()).toHaveAttribute('data-size', 'large');
    expect(button().querySelector('svg')).toHaveAttribute('width', '20');
  });

  it('passes axe open and closed, with no dangling ids', async () => {
    const user = userEvent.setup();
    render(<InfoButton info={INFO} openOnHover={false} />);
    expect(findDanglingIdRefs()).toEqual([]);
    await expectNoA11yViolations();
    await user.click(button());
    expect(findDanglingIdRefs()).toEqual([]);
    await expectNoA11yViolations();
  });

  it('opens once per activation in StrictMode', async () => {
    const user = userEvent.setup();
    render(
      <React.StrictMode>
        <InfoButton info="x" openOnHover={false} />
      </React.StrictMode>,
    );
    await user.click(button());
    expect(screen.getAllByRole('note')).toHaveLength(1);
  });

  // Structure, the note's exit state and width, labelling, description, handlers and sizes (D28).

  it('renders the description and the note next to the button, never inside it', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <InfoButton
        info={
          <>
            Use 12 characters. <button type="button">Show rules</button>
          </>
        }
        openOnHover={false}
        onClick={onClick}
      />,
    );
    const description = document.getElementById(button().getAttribute('aria-describedby') ?? '');
    expect(description).toHaveAttribute('hidden');
    expect(button().nextElementSibling).toBe(description);
    expect(button().contains(description)).toBe(false);

    await user.click(button());
    const shown = document.getElementById(button().getAttribute('aria-describedby') ?? '');
    expect(note().contains(shown)).toBe(true);
    expect(button().contains(note())).toBe(false);
    expect(button().querySelector('button')).toBeNull();
    // A click in the note never reaches the button's handlers, and the note stays open.
    await user.click(screen.getByRole('button', { name: 'Show rules' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(note()).toBeInTheDocument();
  });

  it('the note is data-state="open", then "closed" and inert while it exits', async () => {
    // The note takes no consumer attributes: its exit is found by its role and phase.
    const motion = mockAnimations({
      animated: (el) =>
        el.getAttribute('role') === 'note' && el.getAttribute('data-presence') === 'exiting',
    });
    const user = userEvent.setup();
    render(<InfoButton info="Some info" openOnHover={false} />);
    await user.click(button());
    const surface = note();
    expect(surface).toHaveAttribute('data-state', 'open');
    expect(surface).toHaveAttribute('data-presence', 'entered');
    expect(surface).not.toHaveAttribute('inert');

    await user.click(button());
    expect(note()).toBe(surface);
    expect(surface).toHaveAttribute('data-state', 'closed');
    expect(surface).toHaveAttribute('data-presence', 'exiting');
    expect(surface).toHaveAttribute('inert');
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    expect(button()).not.toHaveAttribute('aria-controls');
    // Still one copy while it exits: the info stays in the note.
    expect(screen.getAllByText('Some info')).toHaveLength(1);

    await act(async () => {
      await motion.finishAll();
    });
    expect(surface).not.toBeInTheDocument();
    expect(button()).toHaveAccessibleDescription('Some info');
  });

  it('caps the note width at min(20rem, 100vw - 1rem)', async () => {
    const user = userEvent.setup();
    render(<InfoButton info="Some info" openOnHover={false} />);
    await user.click(button());
    expect(note()).toHaveClass('wave:w-max', 'wave:max-w-[min(20rem,calc(100vw-1rem))]');
    expect(note()).not.toHaveClass('wave:max-w-xs');
  });

  it('labels the note like the button: its aria-labelledby ids, else its aria-label', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <>
        <h2 id="billing-heading">Billing</h2>
        <InfoButton
          id="billing-info"
          info="Invoices are sent monthly."
          aria-labelledby="billing-heading billing-info"
          openOnHover={false}
        />
      </>,
    );
    const named = screen.getByRole('button', { name: 'Billing Information' });
    await user.click(named);
    expect(note()).toHaveAttribute('aria-labelledby', 'billing-heading billing-info');
    expect(note()).toHaveAccessibleName('Billing Information');
    unmount();

    render(<InfoButton info="x" aria-label="About billing" openOnHover={false} />);
    await user.click(screen.getByRole('button', { name: 'About billing' }));
    expect(note()).toHaveAccessibleName('About billing');
  });

  it("joins the consumer's aria-describedby with the info", () => {
    render(
      <>
        <span id="billing-extra">Updated daily.</span>
        <InfoButton info="Some info" aria-describedby="billing-extra" />
      </>,
    );
    expect(button()).toHaveAccessibleDescription('Updated daily. Some info');
  });

  testComposedHandler(InfoButton, {
    handler: 'onClick',
    defaultProps: { info: 'Some info', openOnHover: false },
    act: async ({ user }) => {
      await user.click(button());
    },
    assertInternal: () => expect(note()).toBeInTheDocument(),
    assertInternalSuppressed: () => expect(screen.queryByRole('note')).toBeNull(),
  });

  it.each([
    ['small', 'wave:-my-1', '12'],
    ['medium', 'wave:-my-0.5', '16'],
  ] as const)('size %s: the glyph in the 24px box', (size, margin, glyph) => {
    render(<InfoButton info="x" size={size} />);
    expect(button()).toHaveClass('wave:size-6', margin);
    expect(button()).toHaveAttribute('data-size', size);
    expect(button().querySelector('svg')).toHaveAttribute('width', glyph);
  });

  it('renders and reports medium without a size, and for a size from untyped code', () => {
    const { rerender } = render(<InfoButton info="x" />);
    expect(button()).toHaveAttribute('data-size', 'medium');
    expect(button()).toHaveClass('wave:-my-0.5');
    // @ts-expect-error InfoButton has no extra-large size
    rerender(<InfoButton info="x" size="extra-large" />);
    expect(button()).toHaveAttribute('data-size', 'medium');
    expect(button()).toHaveClass('wave:size-6', 'wave:-my-0.5');
    expect(button().querySelector('svg')).toHaveAttribute('width', '16');
  });

  // Empty naming props fall back to the defaults, and the element after the button stays put.

  it('an empty aria-label still names the button and the note "Information"', async () => {
    const user = userEvent.setup();
    render(<InfoButton info="x" aria-label="" openOnHover={false} />);
    expect(button()).toHaveAttribute('aria-label', 'Information');
    await user.click(button());
    expect(note()).toHaveAccessibleName('Information');
  });

  it('an empty id gives the button a generated id, which still names the note', async () => {
    const user = userEvent.setup();
    render(<InfoButton info="x" id="" openOnHover={false} />);
    expect(button().id).not.toBe('');
    await user.click(button());
    expect(note()).toHaveAttribute('aria-labelledby', button().id);
    expect(note()).toHaveAccessibleName('Information');
  });

  it('an empty aria-labelledby labels the note by the button: "Information"', async () => {
    const user = userEvent.setup();
    render(<InfoButton info="x" aria-labelledby="" openOnHover={false} />);
    await user.click(button());
    expect(note()).toHaveAttribute('aria-labelledby', button().id);
    expect(note()).toHaveAccessibleName('Information');
  });

  it('keeps the same element after the button in every phase, and info in the document once', async () => {
    // A row styled by position (last-child, sibling selectors) must not shift on each toggle.
    const motion = mockAnimations({
      animated: (el) =>
        el.getAttribute('role') === 'note' && el.getAttribute('data-presence') === 'exiting',
    });
    const user = userEvent.setup();
    render(<InfoButton info="Some info" openOnHover={false} />);
    const sibling = button().nextElementSibling;
    expect(sibling).toHaveAttribute('hidden');
    expect(sibling).toHaveTextContent('Some info');
    expect(screen.getAllByText('Some info')).toHaveLength(1);

    await user.click(button());
    expect(note()).toHaveAttribute('data-presence', 'entered');
    expect(button().nextElementSibling).toBe(sibling);
    expect(sibling).toHaveAttribute('hidden');
    expect(sibling).not.toHaveAttribute('id');
    expect(sibling).toBeEmptyDOMElement();
    expect(screen.getAllByText('Some info')).toHaveLength(1);

    await user.click(button());
    expect(note()).toHaveAttribute('data-presence', 'exiting');
    expect(button().nextElementSibling).toBe(sibling);
    expect(sibling).toBeEmptyDOMElement();
    expect(screen.getAllByText('Some info')).toHaveLength(1);

    await act(async () => {
      await motion.finishAll();
    });
    expect(screen.queryByRole('note')).toBeNull();
    expect(button().nextElementSibling).toBe(sibling);
    expect(sibling).toHaveAttribute('id', button().getAttribute('aria-describedby'));
    expect(sibling).toHaveTextContent('Some info');
    expect(screen.getAllByText('Some info')).toHaveLength(1);
  });
});

describe('InfoButton behaviour (Phase 4 D29)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

  it('a mouse resting on the button opens the note after 250ms; leaving closes it after 250ms', async () => {
    const user = setup();
    render(<InfoButton info="Some info" />);
    await user.hover(button());
    advance(200);
    expect(screen.queryByRole('note')).toBeNull();
    advance(100);
    expect(note()).toBeInTheDocument();
    await user.unhover(button());
    advance(300);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('touch never hover-opens', () => {
    render(<InfoButton info="Some info" />);
    fireEvent.pointerEnter(button(), { pointerType: 'touch' });
    advance(1000);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('keyboard focus opens it; focus from a pointer press waits for the click', async () => {
    const user = setup();
    const { unmount } = render(<InfoButton info="Some info" />);
    await user.tab();
    expect(note()).toBeInTheDocument();
    unmount();
    render(<InfoButton info="Some info" />);
    fireEvent.pointerDown(button());
    fireEvent.mouseDown(button());
    act(() => button().focus());
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('a note opened by keyboard focus stays when a mouse passes over and leaves', async () => {
    const user = setup();
    render(<InfoButton info="Some info" />);
    await user.tab();
    await user.hover(button());
    await user.unhover(button());
    advance(1000);
    expect(note()).toBeInTheDocument();
  });

  it('a hover-opened note becomes focus-owned when the button takes keyboard focus', async () => {
    const user = setup();
    render(<InfoButton info="Some info" />);
    await user.hover(button());
    advance(300);
    await user.tab();
    await user.unhover(button());
    advance(1000);
    expect(note()).toBeInTheDocument();
  });

  it('Tab from the open button enters the note; Tab past it continues and closes it; Shift+Tab returns', async () => {
    const user = setup();
    render(
      <>
        <InfoButton info={INFO} />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Rules' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(button()).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    await act(async () => {});
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('Escape from a link closes it, returns focus, and focus restore does not reopen it', async () => {
    const user = setup();
    render(
      <>
        <InfoButton info={INFO} />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    await user.tab();
    await user.keyboard('{Escape}');
    expect(button()).toHaveFocus();
    expect(screen.queryByRole('note')).toBeNull();
    await user.tab(); // focus leaves both
    await user.tab({ shift: true }); // and comes back: opens again
    expect(note()).toBeInTheDocument();
  });

  it('an outside press on blank space closes it without reopening', async () => {
    const user = setup();
    render(<InfoButton info="Some info" />);
    await user.tab();
    await user.click(document.body);
    await act(async () => {});
    expect(screen.queryByRole('note')).toBeNull();
    advance(500);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('with openOnHover={false}, focus and hover do nothing and a click toggles', async () => {
    const user = setup();
    render(<InfoButton info="Some info" openOnHover={false} />);
    await user.tab();
    await user.hover(button());
    advance(1000);
    expect(screen.queryByRole('note')).toBeNull();
    await user.click(button());
    expect(note()).toBeInTheDocument();
  });

  it('enters the note from inside a modal focus trap when it is the last element', async () => {
    const user = setup();
    render(
      <Dialog open onOpenChange={() => {}}>
        <Dialog.Content title="Settings">
          <InfoButton info={INFO} />
        </Dialog.Content>
      </Dialog>,
    );
    await act(async () => {});
    act(() => screen.getByRole('button', { name: 'Information', hidden: true }).focus());
    await user.tab();
    expect(screen.getByRole('link', { name: 'Rules', hidden: true })).toHaveFocus();
  });

  // The rest of D29 and of the P4-04 Tests paragraph: the safe zone, the note under the pointer,
  // pen input, focus on opening and on the hover close, pinning, dismissed stays dismissed, the
  // Escape order in a Dialog, focus in a layer opened from the note, and StrictMode.

  it('keeps it open while the pointer crosses the gap to the note, even slowly (safe zone)', async () => {
    const user = setup();
    render(<InfoButton info="Some info" />);
    mockRect(button(), { x: 100, y: 100, width: 24, height: 24 });
    await user.pointer({ target: button(), coords: { clientX: 112, clientY: 112 } });
    advance(300);
    const surface = note();
    // Above the button, centred, 8px away.
    mockRect(surface, { x: 12, y: 40, width: 200, height: 52 });
    // Out through the button's top edge, then up and to the right across the gap: each step is
    // shorter than the close delay, all of them together far longer.
    await user.pointer({ target: document.body, coords: { clientX: 112, clientY: 99 } });
    for (const [clientX, clientY] of [
      [115, 97],
      [120, 95],
      [125, 94],
      [130, 93],
    ]) {
      advance(150);
      await user.pointer({ target: document.body, coords: { clientX, clientY } });
    }
    advance(150);
    expect(note()).toBe(surface);
    await user.pointer({ target: surface, coords: { clientX: 140, clientY: 80 } });
    advance(1000);
    expect(note()).toBe(surface);
  });

  it('closes 250ms after the pointer leaves the safe zone', async () => {
    const user = setup();
    render(<InfoButton info="Some info" />);
    mockRect(button(), { x: 100, y: 100, width: 24, height: 24 });
    await user.pointer({ target: button(), coords: { clientX: 112, clientY: 112 } });
    advance(300);
    mockRect(note(), { x: 12, y: 40, width: 200, height: 52 });
    await user.pointer({ target: document.body, coords: { clientX: 112, clientY: 99 } });
    // 150ms in the zone, moving towards the note: each move there restarts the close delay.
    advance(75);
    await user.pointer({ target: document.body, coords: { clientX: 114, clientY: 98 } });
    advance(75);
    await user.pointer({ target: document.body, coords: { clientX: 116, clientY: 97 } });
    // Beside the button, away from the note: the zone ends and the close timer runs on.
    await user.pointer({ target: document.body, coords: { clientX: 60, clientY: 110 } });
    // Past the close delay counted from leaving the button, not yet past the one of the last move.
    advance(150);
    expect(note()).toBeInTheDocument();
    advance(150);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('stays open while the pointer is on the note, and closes 250ms after it leaves', async () => {
    const user = setup();
    render(<InfoButton info="Some info" />);
    await user.hover(button());
    advance(300);
    await user.hover(note());
    advance(1000);
    expect(note()).toBeInTheDocument();
    await user.unhover(note());
    advance(150);
    expect(note()).toBeInTheDocument();
    advance(150);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('a pen never hover-opens', () => {
    render(<InfoButton info="Some info" />);
    fireEvent.pointerEnter(button(), { pointerType: 'pen' });
    advance(1000);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('opening by hover moves no focus, and neither does the hover close', async () => {
    const user = setup();
    render(<InfoButton info="Some info" />);
    await user.hover(button());
    advance(300);
    expect(note()).toBeInTheDocument();
    expect(document.body).toHaveFocus();
    await user.unhover(button());
    advance(300);
    expect(screen.queryByRole('note')).toBeNull();
    expect(document.body).toHaveFocus();
    advance(1000);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('a click pins a hover-opened note: leaving keeps it open, and a second click closes it', async () => {
    const user = setup();
    render(<InfoButton info="Some info" />);
    await user.hover(button());
    advance(300);
    await user.click(button());
    expect(note()).toBeInTheDocument();
    expect(button()).toHaveFocus();
    await user.unhover(button());
    advance(1000);
    expect(note()).toBeInTheDocument();
    await user.click(button());
    expect(screen.queryByRole('note')).toBeNull();
    expect(button()).toHaveAttribute('aria-expanded', 'false');
  });

  it('after Escape, hover opens it again only once the pointer has left the button', async () => {
    const user = setup();
    render(<InfoButton info="Some info" />);
    mockRect(button(), { x: 100, y: 100, width: 24, height: 24 });
    await user.pointer({ target: button(), coords: { clientX: 110, clientY: 110 } });
    advance(300);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('note')).toBeNull();
    await user.pointer({ target: button(), coords: { clientX: 114, clientY: 112 } });
    advance(1000);
    expect(screen.queryByRole('note')).toBeNull();
    await user.unhover(button());
    await user.hover(button());
    advance(300);
    expect(note()).toBeInTheDocument();
  });

  it('a note closed by focus moving past it opens again when keyboard focus comes back', async () => {
    const user = setup();
    render(
      <>
        <InfoButton info={INFO} />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    await user.tab();
    await user.tab();
    await act(async () => {});
    expect(screen.queryByRole('note')).toBeNull();
    await user.tab({ shift: true });
    expect(button()).toHaveFocus();
    expect(note()).toBeInTheDocument();
  });

  it('after a dismissal, a note that hover opened again becomes focus-owned when keyboard focus returns to the button', async () => {
    const user = setup();
    render(<InfoButton info={INFO} />);
    await user.tab();
    await user.keyboard('{Escape}');
    expect(button()).toHaveFocus();
    await user.hover(button());
    advance(300);
    expect(note()).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Rules' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(button()).toHaveFocus();
    await user.unhover(button());
    advance(1000);
    expect(note()).toBeInTheDocument();
  });

  it('after a dismissal, focus leaving through a note that a click opened again ends the dismissal', async () => {
    const user = setup();
    render(
      <>
        <InfoButton info={INFO} />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    await user.keyboard('{Escape}');
    await user.keyboard('{Enter}');
    expect(note()).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Rules' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    await act(async () => {});
    expect(screen.queryByRole('note')).toBeNull();
    await user.tab({ shift: true });
    expect(button()).toHaveFocus();
    expect(note()).toBeInTheDocument();
  });

  it('after Escape, a press on a spot that takes no focus ends the dismissal: keyboard focus opens it again', async () => {
    const user = setup();
    render(<InfoButton info="Some info" />);
    await user.tab();
    await user.keyboard('{Escape}');
    expect(button()).toHaveFocus();
    await user.click(document.body);
    expect(document.body).toHaveFocus();
    await user.tab();
    expect(button()).toHaveFocus();
    expect(note()).toBeInTheDocument();
  });

  it.each([
    [
      'a press on blank space closed a pinned note',
      async (user: ReturnType<typeof setup>) => {
        await user.click(button());
        await user.click(document.body);
      },
    ],
    [
      'Escape closed a note that keyboard focus opened',
      async (user: ReturnType<typeof setup>) => {
        await user.tab();
        await user.keyboard('{Escape}');
      },
    ],
  ])('after %s, a switch of window or tab does not reopen it', async (_, dismiss) => {
    const user = setup();
    render(<InfoButton info="Some info" />);
    await dismiss(user);
    expect(screen.queryByRole('note')).toBeNull();
    expect(button()).toHaveFocus();
    // The window loses focus: the button blurs, to nothing, but stays the document's focused
    // element. When the window comes back, the browser focuses the button again, from nothing.
    fireEvent.blur(button());
    fireEvent.focusOut(button());
    fireEvent(window, new FocusEvent('blur'));
    fireEvent(window, new FocusEvent('focus'));
    fireEvent.focus(button());
    fireEvent.focusIn(button());
    expect(button()).toHaveFocus();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('keyboard focus keeps a pinned note pinned: after Tab in and Shift+Tab back, a click closes it', async () => {
    const user = setup();
    render(<InfoButton info={INFO} />);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(note()).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Rules' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(button()).toHaveFocus();
    expect(note()).toBeInTheDocument();
    await user.click(button());
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('a natively disabled button never hover-opens', async () => {
    const user = setup();
    render(<InfoButton info="Some info" disabled />);
    expect(button()).toBeDisabled();
    await user.hover(button());
    advance(300);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('a press that ends without a click does not make later keyboard focus look like pointer focus', async () => {
    const user = setup();
    render(
      <>
        <button type="button">Before</button>
        <InfoButton info="Some info" />
      </>,
    );
    // Dragged off the button (Safari and Firefox on macOS do not focus a pressed button).
    fireEvent.pointerDown(button());
    fireEvent.mouseDown(button());
    fireEvent.pointerUp(document.body);
    fireEvent.mouseUp(document.body);
    advance(50);
    act(() => screen.getByRole('button', { name: 'Before' }).focus());
    await user.tab();
    expect(button()).toHaveFocus();
    expect(note()).toBeInTheDocument();
  });

  it('a click that closes a pinned note never reopens it, also where a click leaves focus on <body>', async () => {
    render(<InfoButton info="Some info" />);
    // Safari and Firefox on macOS do not focus a clicked button, and the press ends in an earlier
    // task than the click: the focus restore that follows the close is the button's first focus.
    const click = () => {
      fireEvent.pointerDown(button());
      fireEvent.mouseDown(button());
      advance(50);
      fireEvent.pointerUp(button());
      fireEvent.mouseUp(button());
      fireEvent.click(button());
    };
    click();
    expect(note()).toBeInTheDocument();
    expect(document.body).toHaveFocus();
    click();
    expect(screen.queryByRole('note')).toBeNull();
    expect(button()).toHaveFocus();
    advance(1000);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('in a Dialog, Escape from the note closes only the note, and the next Escape reaches the Dialog', async () => {
    const user = setup();
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <Dialog.Content title="Settings">
          <InfoButton info={INFO} />
        </Dialog.Content>
      </Dialog>,
    );
    await act(async () => {});
    const infoButton = screen.getByRole('button', { name: 'Information', hidden: true });
    act(() => infoButton.focus());
    await user.tab();
    expect(screen.getByRole('link', { name: 'Rules', hidden: true })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('note', { hidden: true })).toBeNull();
    expect(infoButton).toHaveFocus();
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('note', { hidden: true })).toBeNull();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' }));
  });

  it('focus in a layer opened from the note keeps a hover-opened note open', async () => {
    const user = setup();
    render(
      <InfoButton
        info={
          <Popover>
            <Popover.Trigger>
              <button type="button">Details</button>
            </Popover.Trigger>
            <Popover.Content title="Details">
              <button type="button">Got it</button>
            </Popover.Content>
          </Popover>
        }
      />,
    );
    await user.hover(button());
    advance(300);
    await user.hover(note());
    await user.click(screen.getByRole('button', { name: 'Details' }));
    act(() => screen.getByRole('button', { name: 'Got it' }).focus());
    await user.unhover(note());
    advance(1000);
    expect(note()).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Details' })).toBeInTheDocument();
  });

  it('hover and keyboard focus each open it once in StrictMode', async () => {
    const user = setup();
    render(
      <React.StrictMode>
        <InfoButton info="Some info" />
      </React.StrictMode>,
    );
    await user.hover(button());
    advance(300);
    expect(screen.getAllByRole('note')).toHaveLength(1);
    await user.unhover(button());
    advance(300);
    expect(screen.queryByRole('note')).toBeNull();
    await user.tab();
    expect(screen.getAllByRole('note')).toHaveLength(1);
  });

  // C-COMPOSE: the consumer's handlers run first; preventDefault() skips the built-in behaviour,
  // except the press and focus bookkeeping, which mirrors the DOM.

  testComposedHandler(InfoButton, {
    handler: 'onFocus',
    defaultProps: { info: 'Some info' },
    act: async ({ user }) => {
      await user.tab();
    },
    assertInternal: () => expect(note()).toBeInTheDocument(),
    assertInternalSuppressed: () => expect(screen.queryByRole('note')).toBeNull(),
  });

  testComposedHandler(InfoButton, {
    handler: 'onKeyDown',
    defaultProps: { info: INFO },
    act: async ({ user }) => {
      await user.tab();
      await user.tab();
    },
    assertInternal: () => expect(screen.getByRole('link', { name: 'Rules' })).toHaveFocus(),
    assertInternalSuppressed: () => expect(button()).toHaveFocus(),
  });

  testComposedHandler(InfoButton, {
    handler: 'onPointerEnter',
    defaultProps: { info: 'Some info' },
    act: async ({ user }) => {
      await user.hover(button());
      act(() => {
        vi.advanceTimersByTime(300);
      });
    },
    assertInternal: () => expect(note()).toBeInTheDocument(),
    assertInternalSuppressed: () => expect(screen.queryByRole('note')).toBeNull(),
  });

  testComposedHandler(InfoButton, {
    handler: 'onPointerLeave',
    defaultProps: { info: 'Some info' },
    act: async ({ user }) => {
      await user.hover(button());
      act(() => {
        vi.advanceTimersByTime(300);
      });
      await user.unhover(button());
      act(() => {
        vi.advanceTimersByTime(300);
      });
    },
    assertInternal: () => expect(screen.queryByRole('note')).toBeNull(),
    assertInternalSuppressed: () => expect(note()).toBeInTheDocument(),
  });

  it('keeps the press and focus bookkeeping when the consumer handlers prevent the default', async () => {
    const user = setup();
    const prevent = (event: React.SyntheticEvent) => event.preventDefault();
    const onPointerDown = vi.fn(prevent);
    const onMouseDown = vi.fn(prevent);
    const onBlur = vi.fn(prevent);
    const onPointerMove = vi.fn();
    render(
      <>
        <InfoButton
          info="Some info"
          onPointerDown={onPointerDown}
          onMouseDown={onMouseDown}
          onBlur={onBlur}
          onPointerMove={onPointerMove}
        />
        <button type="button">After</button>
      </>,
    );
    // The focus of a press still waits for the click.
    fireEvent.pointerDown(button());
    fireEvent.mouseDown(button());
    act(() => button().focus());
    expect(screen.queryByRole('note')).toBeNull();
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onMouseDown).toHaveBeenCalledTimes(1);
    advance(50);
    // Focus leaving the button still ends a dismissal: coming back opens the note again.
    await user.keyboard('{Enter}');
    expect(note()).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('note')).toBeNull();
    await user.tab();
    expect(onBlur).toHaveBeenCalled();
    await user.tab({ shift: true });
    expect(note()).toBeInTheDocument();
    await user.hover(button());
    expect(onPointerMove).toHaveBeenCalled();
  });
});

describe('InfoButton — slotProps', () => {
  type InfoButtonSlotProps = NonNullable<InfoButtonProps['slotProps']>;
  const EVERY_PART: InfoButtonSlotProps = { info: {}, beak: {} };
  const info = () =>
    document.querySelector<HTMLElement>('.' + infoButtonClassNames.info) as HTMLElement;
  const beak = () =>
    document.querySelector<HTMLElement>('.' + infoButtonClassNames.beak) as HTMLElement;

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document.documentElement, 'clientWidth');
    Reflect.deleteProperty(document.documentElement, 'clientHeight');
  });

  /** Opens the note with a click on the (first) button and lets the positioning settle. */
  async function open() {
    fireEvent.click(screen.getAllByRole('button')[0]);
    await act(async () => {});
  }

  /** {@link expectInertSlotProps} for an open note: the same root, opened once. */
  async function expectInertOpen(ui: (slotProps?: InfoButtonSlotProps) => React.ReactElement) {
    const { baseElement, rerender, unmount } = render(ui(undefined));
    await open();
    const markup = baseElement.innerHTML;
    expect(info()).not.toBeNull();
    for (const slotProps of [{}, EVERY_PART, undefined]) {
      rerender(ui(slotProps));
      await act(async () => {});
      expect(baseElement.innerHTML).toBe(markup);
    }
    unmount();
  }

  /** Boxes by `data-testid` and a 1024×768 viewport (jsdom has no layout). */
  function mockLayout(
    boxes: Record<string, { x: number; y: number; width: number; height: number }>,
  ) {
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 768,
    });
    const boxOf = (el: Element) => boxes[el.getAttribute('data-testid') ?? ''];
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const { x, y, width, height } = boxOf(this) ?? { x: 0, y: 0, width: 0, height: 0 };
      const full = { x, y, left: x, top: y, width, height, right: x + width, bottom: y + height };
      return { ...full, toJSON: () => full } as DOMRect;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return boxOf(this)?.width ?? 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return boxOf(this)?.height ?? 0;
    });
  }

  it('renders the open note of a98c113 (attributes sorted)', async () => {
    // Captured from a98c113: the merged props may put the class before the locked attributes.
    render(<InfoButton info="Some info" openOnHover={false} />);
    await open();
    expect(normaliseIds(sortAttributes(document.body))).toBe(
      [
        '<div>',
        '<button aria-controls="info-note-_id0_" aria-describedby="info-_id1_" aria-expanded="true" aria-label="Information" class="wave-info-button wave:inline-flex wave:size-6 wave:shrink-0 wave:items-center wave:justify-center wave:rounded-full wave:border-0 wave:bg-transparent wave:p-0 wave:text-muted-foreground wave:-my-0.5 wave:not-disabled:not-aria-disabled:hover:text-foreground wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring" data-size="medium" id="info-button-_id2_" type="button">',
        '<svg aria-hidden="true" data-wave-icon="info" fill="currentColor" focusable="false" height="16" viewBox="0 0 20 20" width="16" xmlns="http://www.w3.org/2000/svg">',
        '<path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.5 5v1h-1V7h1Zm0 3v4h-1v-4h1Z" fill-rule="evenodd">',
        '</path>',
        '</svg>',
        '</button>',
        '<span hidden="">',
        '</span>',
        '</div>',
        '<div class="wave-portal" data-layer="overlay" data-wave-portal="" dir="ltr" style="position: relative; z-index: calc(var(--wave-z-overlay, 1000) + 0);">',
        '<div aria-labelledby="info-button-_id2_" class="wave-info-button__info wave:w-max wave:max-w-[min(20rem,calc(100vw-1rem))] wave:rounded-md wave:border wave:border-border wave:bg-background wave:px-3 wave:py-2 wave:text-caption-1 wave:text-foreground wave:shadow-16 wave:transition-[opacity,translate] wave:duration-wave-normal wave:ease-wave-decelerate-mid wave:data-[presence=exiting]:duration-wave-faster wave:data-[presence=exiting]:ease-wave-accelerate-min wave:motion-reduce:transition-none wave:data-[presence=entering]:starting:opacity-0 wave:data-[presence=exiting]:opacity-0 wave:data-[side=top]:data-[presence=entering]:starting:translate-y-1 wave:data-[side=top]:data-[presence=exiting]:translate-y-1 wave:data-[side=bottom]:data-[presence=entering]:starting:-translate-y-1 wave:data-[side=bottom]:data-[presence=exiting]:-translate-y-1 wave:data-[side=left]:data-[presence=entering]:starting:translate-x-1 wave:data-[side=left]:data-[presence=exiting]:translate-x-1 wave:data-[side=right]:data-[presence=entering]:starting:-translate-x-1 wave:data-[side=right]:data-[presence=exiting]:-translate-x-1" data-align="center" data-presence="entered" data-side="top" data-state="open" data-wave-infolabel-surface="" id="info-note-_id0_" role="note" style="position: fixed; left: 0px; top: 0px; transform: translate(8px, -8px);">',
        '<div aria-hidden="true" class="wave:size-2 wave:rotate-45 wave:border-inherit wave:bg-inherit wave:border-b wave:border-r wave-info-button__beak" data-wave-popover-arrow="" style="position: absolute; bottom: calc(var(--wave-popup-arrow-size, 8px) / -2); left: -1px;">',
        '</div>',
        '<div id="info-_id1_">Some info',
        '</div>',
        '</div>',
        '</div>',
      ].join(''),
    );
  });

  it('renders the same markup without slotProps, with {} and with every part empty', async () => {
    expectInertSlotProps(
      (slotProps) => <InfoButton info="Some info" slotProps={slotProps} />,
      EVERY_PART,
    );
    await expectInertOpen((slotProps) => <InfoButton info={INFO} slotProps={slotProps} />);
    await expectInertOpen((slotProps) => (
      <>
        <span id="billing">Billing</span>
        <InfoButton
          id="billing-info"
          aria-labelledby="billing billing-info"
          size="small"
          motion={null}
          info="Invoices are sent monthly."
          slotProps={slotProps}
        />
      </>
    ));
  });

  it('puts your className, style and data-* on each part, after its own classes', async () => {
    render(
      <InfoButton
        info="Some info"
        slotProps={{
          info: { className: 'my-note', style: { opacity: 0.5 }, 'data-part': 'info' },
          beak: { className: 'my-beak', style: { opacity: 0.25 }, 'data-part': 'beak' },
        }}
      />,
    );
    await open();
    for (const [element, stable, own, mine, data, opacity] of [
      [info(), infoButtonClassNames.info, 'wave:shadow-16', 'my-note', 'info', '0.5'],
      [beak(), infoButtonClassNames.beak, 'wave:rotate-45', 'my-beak', 'beak', '0.25'],
    ] as const) {
      expect(element).toHaveClass(stable, own, mine);
      expect(element.classList[element.classList.length - 1]).toBe(mine);
      expect(element).toHaveAttribute('data-part', data);
      expect(element).toHaveStyle({ opacity });
    }
    expect(info().classList[0]).toBe(infoButtonClassNames.info);
    // The button takes none of it, and no `slotProps` attribute.
    expect(button()).not.toHaveAttribute('data-part');
    expect(document.querySelector('[slotprops]')).toBeNull();
  });

  it('lets your class replace a conflicting class of a part', async () => {
    render(
      <InfoButton
        info="Some info"
        slotProps={{ info: { className: 'px-4' }, beak: { className: 'size-3' } }}
      />,
    );
    await open();
    expect(info()).toHaveClass('px-4');
    expect(info()).not.toHaveClass('wave:px-3');
    expect(beak()).toHaveClass('size-3');
    expect(beak()).not.toHaveClass('wave:size-2');
  });

  it('locks the note’s id, role, name, marker, phase and placement, and keeps it shown', async () => {
    render(
      <>
        <span id="extra">Extra</span>
        <InfoButton
          info="Some info"
          slotProps={{
            info: {
              id: 'mine',
              role: 'dialog',
              'aria-labelledby': 'extra',
              'data-wave-infolabel-surface': 'mine',
              'data-state': 'closed',
              'data-presence': 'exiting',
              'data-side': 'bottom',
              'data-align': 'start',
              hidden: true,
              inert: true,
              'aria-hidden': true,
              title: 'Note',
            },
          }}
        />
      </>,
    );
    await open();
    const note = screen.getByRole('note');
    expect(note).toBe(info());
    expect(button()).toHaveAttribute('aria-controls', note.id);
    expect(note.id).not.toBe('mine');
    // Your ids come after the note's own: it is labelled like the button, then by yours.
    expect(note).toHaveAttribute('aria-labelledby', `${button().id} extra`);
    expect(note).toHaveAttribute('data-wave-infolabel-surface', '');
    expect(note).toHaveAttribute('data-state', 'open');
    expect(note).toHaveAttribute('data-presence', 'entered');
    expect(note).toHaveAttribute('data-side', 'top');
    expect(note).toHaveAttribute('data-align', 'center');
    // Set by no state of the open note, so locked unset (the presence core adds `inert` and
    // `hidden` only in some phases).
    for (const name of ['hidden', 'inert', 'aria-hidden']) {
      expect(note, name).not.toHaveAttribute(name);
    }
    expect(note).toHaveAttribute('title', 'Note');
  });

  it('keeps the exiting phase over yours: closed and inert while the note fades out', async () => {
    const motion = mockAnimations({
      animated: (el) => el.hasAttribute('data-wave-infolabel-surface'),
    });
    render(
      <InfoButton
        info="Some info"
        openOnHover={false}
        slotProps={{ info: { inert: false, 'data-state': 'open', 'data-presence': 'entered' } }}
      />,
    );
    await open();
    await act(async () => {
      await motion.finishAll();
    });
    fireEvent.click(button());
    expect(info()).toHaveAttribute('data-presence', 'exiting');
    expect(info()).toHaveAttribute('data-state', 'closed');
    expect(info()).toHaveAttribute('inert');
    await act(async () => {
      await motion.finishAll();
    });
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('locks the beak’s hidden state, its marker, its tab stop and the position keys of its style', async () => {
    render(
      <InfoButton
        info="Some info"
        slotProps={{
          beak: {
            'aria-hidden': false,
            'data-wave-popover-arrow': 'mine',
            tabIndex: 0,
            style: { position: 'static', bottom: '1px', left: '2px', opacity: 0.5 },
            title: 'Beak',
          },
        }}
      />,
    );
    await open();
    expect(beak()).toHaveAttribute('aria-hidden', 'true');
    expect(beak()).toHaveAttribute('data-wave-popover-arrow', '');
    expect(beak()).not.toHaveAttribute('tabindex');
    expect(beak()).toHaveAttribute('title', 'Beak');
    expect(beak().style.position).toBe('absolute');
    expect(beak().style.bottom).toBe('calc(var(--wave-popup-arrow-size, 8px) / -2)');
    expect(beak().style.left).toBe('-1px');
    expect(beak()).toHaveStyle({ opacity: '0.5' });
  });

  it('keeps the position the positioning sets over your note style', async () => {
    render(
      <InfoButton
        info="Some info"
        slotProps={{
          info: { style: { position: 'static', top: '5px', transform: 'none', opacity: 0.5 } },
        }}
      />,
    );
    await open();
    expect(info().style.position).toBe('fixed');
    expect(info().style.top).toBe('0px');
    expect(info().style.transform).toBe('translate(8px, -8px)');
    expect(info()).toHaveStyle({ opacity: '0.5' });
  });

  it('attaches your refs to the parts', async () => {
    const infoRef = React.createRef<HTMLDivElement>();
    const beakRef = React.createRef<HTMLDivElement>();
    render(
      <InfoButton
        info="Some info"
        slotProps={{ info: { ref: infoRef }, beak: { ref: beakRef } }}
      />,
    );
    await open();
    expect(infoRef.current).toBe(info());
    expect(beakRef.current).toBe(beak());
  });

  it('keeps placing the note and the beak while you pass new inline refs on every render', async () => {
    mockLayout({
      button: { x: 400, y: 300, width: 24, height: 24 },
      note: { x: 0, y: 0, width: 200, height: 60 },
      beak: { x: 0, y: 0, width: 8, height: 8 },
    });
    const notes: Array<HTMLDivElement | null> = [];
    const beaks: Array<HTMLDivElement | null> = [];
    const ui = () => (
      <InfoButton
        info="Some info"
        data-testid="button"
        slotProps={{
          info: { 'data-testid': 'note', ref: (element) => void notes.push(element) },
          beak: { 'data-testid': 'beak', ref: (element) => void beaks.push(element) },
        }}
      />
    );
    const { rerender } = render(ui());
    await open();
    rerender(ui());
    rerender(ui());
    expect(notes.at(-1)).toBe(info());
    expect(beaks.at(-1)).toBe(beak());
    // Centred above the button: x = 400 + 24 / 2 - 200 / 2 = 312, y = 300 - 60 - 8 = 232; the
    // beak at (400 + 24 / 2) - 312 - 8 / 2 = 96.
    await waitFor(() => expect(info().style.transform).toBe('translate(312px, 232px)'));
    await waitFor(() => expect(beak().style.left).toBe('96px'));
  });

  it('runs your note keydown first: a prevented Tab keeps focus in the note', async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn((event: React.KeyboardEvent) => {
      if (event.key === 'Tab') event.preventDefault();
    });
    render(
      <>
        <InfoButton info={INFO} slotProps={{ info: { onKeyDown } }} />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    await user.tab();
    const link = screen.getByRole('link', { name: 'Rules' });
    expect(link).toHaveFocus();
    await user.tab();
    expect(onKeyDown).toHaveBeenCalled();
    expect(link).toHaveFocus();
    expect(note()).toBeInTheDocument();
  });

  it('follows the pointer on the note also when your pointer handlers prevent the default', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
    const prevent = (event: React.SyntheticEvent) => event.preventDefault();
    const onPointerEnter = vi.fn(prevent);
    const onPointerLeave = vi.fn(prevent);
    render(
      <InfoButton info="Some info" slotProps={{ info: { onPointerEnter, onPointerLeave } }} />,
    );
    await user.hover(button());
    advance(300);
    await user.hover(note());
    advance(1000);
    expect(onPointerEnter).toHaveBeenCalled();
    expect(note()).toBeInTheDocument();
    await user.unhover(note());
    expect(onPointerLeave).toHaveBeenCalled();
    advance(300);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('calls your part handlers once per click in StrictMode', async () => {
    const onInfoClick = vi.fn();
    const onBeakClick = vi.fn();
    render(
      <React.StrictMode>
        <InfoButton
          info="Some info"
          openOnHover={false}
          slotProps={{ info: { onClick: onInfoClick }, beak: { onClick: onBeakClick } }}
        />
      </React.StrictMode>,
    );
    await open();
    fireEvent.click(beak());
    expect(onBeakClick).toHaveBeenCalledTimes(1);
    expect(onInfoClick).toHaveBeenCalledTimes(1);
  });

  it('ignores the parts while the note is closed', () => {
    render(
      <InfoButton
        info="Some info"
        slotProps={{ info: { className: 'my-note' }, beak: { className: 'my-beak' } }}
      />,
    );
    expect(screen.queryByRole('note')).toBeNull();
    expect(document.querySelector('.my-note, .my-beak')).toBeNull();
  });

  it('has no accessibility violations with every part customised', async () => {
    render(
      <InfoButton
        info={INFO}
        slotProps={{ info: { className: 'my-note' }, beak: { className: 'my-beak' } }}
      />,
    );
    await open();
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof InfoButtonSlotProps>().toEqualTypeOf<'info' | 'beak'>();
    expectTypeOf<NonNullable<InfoButtonSlotProps['info']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<InfoButtonSlotProps['beak']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    // @ts-expect-error -- a part takes no children: `info` is the note's content
    void (<InfoButton info="Some info" slotProps={{ info: { children: 'Other' } }} />);
  });
});
