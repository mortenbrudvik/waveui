import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { InfoButton } from '../InfoButton';
import {
  expectNoA11yViolations,
  findDanglingIdRefs,
  mockAnimations,
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
    expect(button()).toHaveClass('size-6', '-my-px');
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
    expect(note()).toHaveClass('w-max', 'max-w-[min(20rem,calc(100vw-1rem))]');
    expect(note()).not.toHaveClass('max-w-xs');
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
    ['small', '-my-1', '12'],
    ['medium', '-my-0.5', '16'],
  ] as const)('size %s: the glyph in the 24px box', (size, margin, glyph) => {
    render(<InfoButton info="x" size={size} />);
    expect(button()).toHaveClass('size-6', margin);
    expect(button()).toHaveAttribute('data-size', size);
    expect(button().querySelector('svg')).toHaveAttribute('width', glyph);
  });

  it('renders and reports medium without a size, and for a size from untyped code', () => {
    const { rerender } = render(<InfoButton info="x" />);
    expect(button()).toHaveAttribute('data-size', 'medium');
    expect(button()).toHaveClass('-my-0.5');
    // @ts-expect-error InfoButton has no extra-large size
    rerender(<InfoButton info="x" size="extra-large" />);
    expect(button()).toHaveAttribute('data-size', 'medium');
    expect(button()).toHaveClass('size-6', '-my-0.5');
    expect(button().querySelector('svg')).toHaveAttribute('width', '16');
  });
});
