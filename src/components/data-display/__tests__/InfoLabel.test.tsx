import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfoLabel, type InfoLabelProps } from '../InfoLabel';
import { InfoButton, type InfoButtonProps } from '../InfoButton';
import {
  infoButtonClassNames,
  infoLabelClassNames,
  labelClassNames,
} from '../../../lib/classNames';
import {
  expectInertSlotProps,
  expectNoA11yViolations,
  normaliseIds,
  sortAttributes,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

const INFO = 'Use at least 8 characters.';

/** The InfoButton note (portaled, role="note", only mounted while open). */
function getSurface(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-wave-infolabel-surface]');
}

/** Renders `<InfoLabel info={INFO}>Password</InfoLabel>` and returns its info button. */
function renderInfoLabel() {
  const utils = render(<InfoLabel info={INFO}>Password</InfoLabel>);
  return { ...utils, button: screen.getByRole('button', { name: 'Password Information' }) };
}

describe('InfoLabel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  testSystemProps(InfoLabel, {
    expectedTag: 'span',
    displayName: 'InfoLabel',
    defaultProps: { children: 'Name', info: 'Enter your name' },
  });

  it('renders the label text', () => {
    render(<InfoLabel info="Your email address">Email</InfoLabel>);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  describe('trigger (data-display#13)', () => {
    it('is a named button with no title and no role="img"', () => {
      const { container, button } = renderInfoLabel();
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(container.querySelector('[title]')).toBeNull();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('accepts a localised button label, appended after the label text', () => {
      render(
        <InfoLabel info={INFO} infoButtonLabel="Hinweis">
          Passwort
        </InfoLabel>,
      );
      expect(screen.getByRole('button', { name: 'Passwort Hinweis' })).toBeInTheDocument();
    });

    it('describes the button with the info text while closed (SSR-safe inline description)', () => {
      const { button } = renderInfoLabel();
      expect(button).toHaveAccessibleDescription(INFO);
      expect(getSurface()).toBeNull();
    });

    it('renders the description on the server', () => {
      const html = renderToString(<InfoLabel info={INFO}>Password</InfoLabel>);
      expect(html).toContain(INFO);
      expect(html).toMatch(/aria-describedby="([^"]+)"[\s\S]*id="\1" hidden=""/);
    });

    it('uses the shared decorative info icon (input-datetime#22)', () => {
      const { button } = renderInfoLabel();
      const icon = button.querySelector('[data-wave-icon="info"]');
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  testNoImplicitSubmit(InfoLabel, { defaultProps: { children: 'Password', info: INFO } });

  describe('interaction (data-display#13)', () => {
    it('opens on a mouse click and stays open (not open-then-closed)', async () => {
      const user = userEvent.setup();
      const { button } = renderInfoLabel();
      await user.click(button);
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute('aria-expanded', 'true');
      const surface = getSurface();
      expect(surface).toHaveTextContent(INFO);
      expect(surface).toHaveAttribute('role', 'note');
    });

    it('closes on a second click', async () => {
      const user = userEvent.setup();
      const { button } = renderInfoLabel();
      await user.click(button);
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(getSurface()).toBeNull();
    });

    it('opens when keyboard focus reaches the trigger', async () => {
      const user = userEvent.setup();
      const { button } = renderInfoLabel();
      await user.tab();
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(getSurface()).toHaveTextContent(INFO);
    });

    it('does not open on focus that follows a pointer press', () => {
      const { button } = renderInfoLabel();
      fireEvent.pointerDown(button);
      act(() => button.focus());
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(getSurface()).toBeNull();
    });

    // Safari and Firefox on macOS, and iOS, do not focus a button on a press. A press that ends
    // without a click (dragged off and released elsewhere, or a touch that turns into a scroll)
    // must not make the next keyboard focus look like pointer focus.
    it.each([
      [
        'a mouse press dragged off the button',
        (button: HTMLElement) => {
          fireEvent.pointerDown(button, { pointerType: 'mouse' });
          fireEvent.mouseDown(button);
          fireEvent.pointerUp(document.body, { pointerType: 'mouse' });
          fireEvent.mouseUp(document.body);
        },
      ],
      [
        'a touch that turns into a scroll',
        (button: HTMLElement) => {
          fireEvent.pointerDown(button, { pointerType: 'touch' });
          fireEvent.pointerCancel(button, { pointerType: 'touch' });
        },
      ],
    ])('opens on later keyboard focus after %s', async (_, press) => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">Previous</button>
          <InfoLabel info={INFO}>Password</InfoLabel>
        </>,
      );
      const button = screen.getByRole('button', { name: 'Password Information' });
      const previous = screen.getByRole('button', { name: 'Previous' });

      press(button);
      // The user does something else before tabbing to the info button.
      await act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));
      act(() => previous.focus());
      await user.tab();

      expect(button).toHaveFocus();
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(getSurface()).toHaveTextContent(INFO);
    });

    it('does not open on the focus of a touch tap, whose mouse events follow the touch later', async () => {
      const { button } = renderInfoLabel();
      fireEvent.pointerDown(button, { pointerType: 'touch' });
      fireEvent.pointerUp(button, { pointerType: 'touch' });
      // Browsers dispatch the compatibility mouse events (and the focus) after the touch ends.
      await act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));
      fireEvent.mouseDown(button);
      act(() => button.focus());
      expect(button).toHaveAttribute('aria-expanded', 'false');
      fireEvent.mouseUp(button);
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('pins a popup opened by focus when the trigger is clicked', async () => {
      const user = userEvent.setup();
      const { button } = renderInfoLabel();
      await user.tab();
      await user.keyboard('{Enter}');
      expect(button).toHaveAttribute('aria-expanded', 'true');
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('pins a popup opened by keyboard focus on a mouse click', async () => {
      const user = userEvent.setup();
      const { button } = renderInfoLabel();
      await user.tab();
      expect(button).toHaveAttribute('aria-expanded', 'true');
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(getSurface()).not.toBeNull();
    });

    it('pins a popup opened by hover on a click, so leaving the pointer keeps it open', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { button } = renderInfoLabel();
      await user.hover(button);
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(button).toHaveAttribute('aria-expanded', 'true');
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      await user.unhover(button);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(getSurface()).not.toBeNull();
    });

    it('keeps a hover-opened popup open once keyboard focus reaches the trigger (WCAG 1.4.13)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { button } = renderInfoLabel();
      await user.hover(button);
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(button).toHaveAttribute('aria-expanded', 'true');
      await user.tab();
      expect(button).toHaveFocus();
      await user.unhover(button);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(getSurface()).not.toBeNull();

      await user.keyboard('{Escape}');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes on Escape and keeps focus on the trigger', async () => {
      const user = userEvent.setup();
      const { button } = renderInfoLabel();
      await user.tab();
      expect(getSurface()).not.toBeNull();
      await user.keyboard('{Escape}');
      expect(getSurface()).toBeNull();
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveFocus();
    });

    it('closes a focus-opened popup when focus moves on', async () => {
      const user = userEvent.setup();
      render(
        <>
          <InfoLabel info={INFO}>Password</InfoLabel>
          <button type="button">Next</button>
        </>,
      );
      await user.tab();
      expect(getSurface()).not.toBeNull();
      await user.tab();
      // The focus-outside dismissal decides in a microtask (the dismiss layer).
      await act(async () => {});
      expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
      expect(getSurface()).toBeNull();
    });

    it('closes a pinned (clicked) popup when focus moves on', async () => {
      const user = userEvent.setup();
      render(
        <>
          <InfoLabel info={INFO}>Password</InfoLabel>
          <button type="button">Next</button>
        </>,
      );
      const button = screen.getByRole('button', { name: 'Password Information' });
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      await user.tab();
      // The focus-outside dismissal decides in a microtask (the dismiss layer).
      await act(async () => {});
      expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(getSurface()).toBeNull();
    });

    it('closes a pinned popup on an outside press', async () => {
      const user = userEvent.setup();
      render(
        <>
          <InfoLabel info={INFO}>Password</InfoLabel>
          <p>Elsewhere</p>
        </>,
      );
      await user.click(screen.getByRole('button', { name: 'Password Information' }));
      expect(getSurface()).not.toBeNull();
      await user.click(screen.getByText('Elsewhere'));
      expect(getSurface()).toBeNull();
    });

    it('toggles on touch taps', async () => {
      const user = userEvent.setup();
      const { button } = renderInfoLabel();
      await user.pointer({ keys: '[TouchA]', target: button });
      expect(button).toHaveAttribute('aria-expanded', 'true');
      await user.pointer({ keys: '[TouchA]', target: button });
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens on hover after a delay and stays open while the popup is hovered', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { button } = renderInfoLabel();
      await user.hover(button);
      expect(getSurface()).toBeNull();
      act(() => {
        vi.advanceTimersByTime(400);
      });
      const surface = getSurface();
      expect(surface).not.toBeNull();

      await user.unhover(button);
      await user.hover(surface as HTMLElement);
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(getSurface()).not.toBeNull();

      await user.unhover(surface as HTMLElement);
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(getSurface()).toBeNull();
    });

    it('never opens on a brief hover that leaves before the show delay', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { button } = renderInfoLabel();
      await user.hover(button);
      act(() => {
        vi.advanceTimersByTime(100);
      });
      await user.unhover(button);
      // Past the show delay (250 ms) and the hide delay: the popup must never have appeared.
      for (let elapsed = 0; elapsed < 1000; elapsed += 50) {
        act(() => {
          vi.advanceTimersByTime(50);
        });
        expect(getSurface()).toBeNull();
        expect(button).toHaveAttribute('aria-expanded', 'false');
      }
    });

    it('keeps a clicked popup open when the pointer leaves', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { button } = renderInfoLabel();
      await user.click(button);
      await user.unhover(button);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(getSurface()).not.toBeNull();
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('has no accessibility violations while open', async () => {
      const user = userEvent.setup();
      renderInfoLabel();
      await user.tab();
      expect(getSurface()).not.toBeNull();
      await expectNoA11yViolations();
    });
  });

  describe('InfoLabel as a label (Phase 4 D31)', () => {
    it('renders the label content in a <label>, with the label props routed to it', () => {
      render(
        <InfoLabel
          info="Use 12 characters."
          htmlFor="pw"
          required
          size="large"
          weight="semibold"
          id="pw-label"
        >
          Password
        </InfoLabel>,
      );
      const label = screen.getByText('Password').closest('label') as HTMLLabelElement;
      expect(label).toHaveAttribute('for', 'pw');
      expect(label).toHaveAttribute('id', 'pw-label');
      expect(label).toHaveClass('wave:text-body-2', 'wave:font-semibold');
      expect(label).toHaveTextContent('Password*');
    });

    it('an empty id counts as unset: the label gets the generated id the button names itself by', () => {
      render(
        <InfoLabel info="x" id="">
          Password
        </InfoLabel>,
      );
      const label = screen.getByText('Password').closest('label') as HTMLLabelElement;
      expect(label.id).not.toBe('');
      const button = screen.getByRole('button', { name: 'Password Information' });
      expect(button.getAttribute('aria-labelledby')?.split(' ')[0]).toBe(label.id);
    });

    it('keeps className, style, ref and a data-* attribute on the root <span>', () => {
      let rootFromRef: HTMLSpanElement | null = null;
      render(
        <InfoLabel
          info="x"
          className="custom-class"
          style={{ width: '42px' }}
          data-testid="info-label-root"
          ref={(node) => {
            rootFromRef = node;
          }}
        >
          Password
        </InfoLabel>,
      );
      const root = screen.getByTestId('info-label-root');
      expect(root.tagName).toBe('SPAN');
      expect(root).toBe(rootFromRef);
      expect(root).toHaveClass('custom-class');
      expect(root).toHaveStyle({ width: '42px' });
    });

    it('names the button "<label> Information" and localizes the second part', () => {
      const { rerender } = render(<InfoLabel info="x">Password</InfoLabel>);
      expect(screen.getByRole('button', { name: 'Password Information' })).toBeInTheDocument();
      rerender(
        <InfoLabel info="x" infoButtonLabel="Info">
          Password
        </InfoLabel>,
      );
      expect(screen.getByRole('button', { name: 'Password Info' })).toBeInTheDocument();
    });

    it('has no label alias of children (removed in 1.0): the label stays empty', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { container } = render(
        // @ts-expect-error -- `label` is removed in 1.0: pass the label content as `children`
        <InfoLabel label="Old" info="x" />,
      );
      expect(screen.queryByText('Old')).not.toBeInTheDocument();
      // An unknown prop of the root `<span>`: rendered as a plain attribute, read by nothing.
      expect(container.firstElementChild).toHaveAttribute('label', 'Old');
      expect(container.querySelector('label')).toBeEmptyDOMElement();
      expect(screen.getByRole('button', { name: 'Information' })).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    it('types: no label prop (removed in 1.0)', () => {
      expectTypeOf<InfoLabelProps>().not.toHaveProperty('label');
    });

    it('rich info: a link in the note is reachable by Tab', async () => {
      const user = userEvent.setup();
      render(<InfoLabel info={<a href="#rules">Rules</a>}>Password</InfoLabel>);
      await user.tab();
      await user.tab();
      expect(screen.getByRole('link', { name: 'Rules' })).toHaveFocus();
    });

    it('disabled dims only the label; the button stays usable', async () => {
      const user = userEvent.setup();
      render(
        <InfoLabel info="x" disabled openOnHover={false}>
          Password
        </InfoLabel>,
      );
      expect(screen.getByText('Password').closest('label')).toHaveClass(
        'wave:text-muted-foreground',
      );
      await user.click(screen.getByRole('button', { name: 'Password Information' }));
      expect(screen.getByRole('note')).toBeInTheDocument();
    });

    it('server HTML hydrates without warnings', async () => {
      const ui = <InfoLabel info="Use 12 characters.">Password</InfoLabel>;
      const container = document.createElement('div');
      container.innerHTML = renderToString(ui);
      document.body.appendChild(container);
      const error = vi.spyOn(console, 'error');
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, ui);
        });
        expect(error).not.toHaveBeenCalled();
      } finally {
        act(() => root?.unmount());
        container.remove();
        error.mockRestore();
      }
    });
  });
});

describe('InfoLabel — slotProps', () => {
  type InfoLabelSlotProps = NonNullable<InfoLabelProps['slotProps']>;
  const EVERY_PART: InfoLabelSlotProps = { label: {}, infoButton: {}, info: {} };
  const label = () => screen.getByText('Password').closest('label') as HTMLLabelElement;
  /** The InfoLabel's info button: the first button (a note's own come after it, in a portal). */
  const button = () => screen.getAllByRole('button')[0];
  const note = () =>
    document.querySelector<HTMLElement>('.' + infoLabelClassNames.info) as HTMLElement;

  /** Opens the note with a click on the info button. */
  async function open() {
    fireEvent.click(button());
    await act(async () => {});
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the open label of a98c113 (attributes sorted)', async () => {
    // Captured from a98c113: the merged props may put the class before the locked attributes.
    render(<InfoLabel info="Use at least 8 characters.">Password</InfoLabel>);
    await open();
    expect(normaliseIds(sortAttributes(document.body))).toBe(
      [
        '<div>',
        '<span class="wave-info-label wave:inline-flex wave:items-center wave:gap-0">',
        '<label class="wave-label wave:text-foreground wave:text-body-1 wave-info-label__label" id="info-label-_id0_">Password',
        '</label>',
        '<button aria-controls="info-note-_id1_" aria-describedby="info-_id2_" aria-expanded="true" aria-label="Information" aria-labelledby="info-label-_id0_ info-label-button-_id3_" class="wave-info-button wave:inline-flex wave:size-6 wave:shrink-0 wave:items-center wave:justify-center wave:rounded-full wave:border-0 wave:bg-transparent wave:p-0 wave:text-muted-foreground wave:-my-0.5 wave:not-disabled:not-aria-disabled:hover:text-foreground wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave-info-label__info-button" data-size="medium" id="info-label-button-_id3_" type="button">',
        '<svg aria-hidden="true" data-wave-icon="info" fill="currentColor" focusable="false" height="16" viewBox="0 0 20 20" width="16" xmlns="http://www.w3.org/2000/svg">',
        '<path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.5 5v1h-1V7h1Zm0 3v4h-1v-4h1Z" fill-rule="evenodd">',
        '</path>',
        '</svg>',
        '</button>',
        '<span hidden="">',
        '</span>',
        '</span>',
        '</div>',
        '<div class="wave-portal" data-layer="overlay" data-wave-portal="" dir="ltr" style="position: relative; z-index: calc(var(--wave-z-overlay, 1000) + 0);">',
        '<div aria-labelledby="info-label-_id0_ info-label-button-_id3_" class="wave-info-button__info wave-info-label__info wave:w-max wave:max-w-[min(20rem,calc(100vw-1rem))] wave:rounded-md wave:border wave:border-border wave:bg-background wave:px-3 wave:py-2 wave:text-caption-1 wave:text-foreground wave:shadow-16 wave:transition-[opacity,translate] wave:duration-wave-normal wave:ease-wave-decelerate-mid wave:data-[presence=exiting]:duration-wave-faster wave:data-[presence=exiting]:ease-wave-accelerate-min wave:motion-reduce:transition-none wave:data-[presence=entering]:starting:opacity-0 wave:data-[presence=exiting]:opacity-0 wave:data-[side=top]:data-[presence=entering]:starting:translate-y-1 wave:data-[side=top]:data-[presence=exiting]:translate-y-1 wave:data-[side=bottom]:data-[presence=entering]:starting:-translate-y-1 wave:data-[side=bottom]:data-[presence=exiting]:-translate-y-1 wave:data-[side=left]:data-[presence=entering]:starting:translate-x-1 wave:data-[side=left]:data-[presence=exiting]:translate-x-1 wave:data-[side=right]:data-[presence=entering]:starting:-translate-x-1 wave:data-[side=right]:data-[presence=exiting]:-translate-x-1" data-align="center" data-presence="entered" data-side="top" data-state="open" data-wave-infolabel-surface="" id="info-note-_id1_" role="note" style="position: fixed; left: 0px; top: 0px; transform: translate(8px, -8px);">',
        '<div aria-hidden="true" class="wave:size-2 wave:rotate-45 wave:border-inherit wave:bg-inherit wave:border-b wave:border-r wave-info-button__beak" data-wave-popover-arrow="" style="position: absolute; bottom: calc(var(--wave-popup-arrow-size, 8px) / -2); left: -1px;">',
        '</div>',
        '<div id="info-_id2_">Use at least 8 characters.',
        '</div>',
        '</div>',
        '</div>',
      ].join(''),
    );
  });

  it('renders the same markup without slotProps, with {} and with every part empty', async () => {
    const cases: Array<Partial<InfoLabelProps>> = [
      {},
      {
        required: true,
        disabled: true,
        size: 'large',
        weight: 'semibold',
        htmlFor: 'pw',
        id: 'own',
        infoButtonLabel: 'Hint',
        openOnHover: false,
        motion: null,
      },
    ];
    for (const props of cases) {
      const ui = (slotProps?: InfoLabelSlotProps) => (
        <InfoLabel info="Use 8." {...props} slotProps={slotProps}>
          Password
        </InfoLabel>
      );
      expectInertSlotProps(ui, EVERY_PART);
      // And open: the note, with the same root (one set of ids).
      const { baseElement, rerender, unmount } = render(ui());
      await open();
      const markup = baseElement.innerHTML;
      expect(note()).not.toBeNull();
      for (const slotProps of [{}, EVERY_PART, undefined]) {
        rerender(ui(slotProps));
        await act(async () => {});
        expect(baseElement.innerHTML).toBe(markup);
      }
      unmount();
    }
  });

  it('puts your className, style and data-* on each part, after its own classes', async () => {
    render(
      <InfoLabel
        info={INFO}
        slotProps={{
          label: { className: 'my-label', style: { opacity: 0.5 }, 'data-part': 'label' },
          infoButton: { className: 'my-button', style: { opacity: 0.25 }, 'data-part': 'button' },
          info: { className: 'my-note', style: { opacity: 0.75 }, 'data-part': 'info' },
        }}
      >
        Password
      </InfoLabel>,
    );
    await open();
    for (const [element, stables, mine, data, opacity] of [
      [label(), [labelClassNames.root, infoLabelClassNames.label], 'my-label', 'label', '0.5'],
      [
        button(),
        [infoButtonClassNames.root, infoLabelClassNames.infoButton],
        'my-button',
        'button',
        '0.25',
      ],
      [note(), [infoButtonClassNames.info, infoLabelClassNames.info], 'my-note', 'info', '0.75'],
    ] as const) {
      expect(element).toHaveClass(...stables, mine);
      expect(element.classList[element.classList.length - 1]).toBe(mine);
      expect(element).toHaveAttribute('data-part', data);
      expect(element).toHaveStyle({ opacity });
    }
    // The root takes none of it, and no `slotProps` attribute.
    expect(label().parentElement).not.toHaveAttribute('data-part');
    expect(document.querySelector('[slotprops]')).toBeNull();
  });

  it('lets your class replace a conflicting class of a part', async () => {
    render(
      <InfoLabel
        info={INFO}
        slotProps={{
          label: { className: 'text-body-2' },
          infoButton: { className: 'size-8' },
          info: { className: 'px-4' },
        }}
      >
        Password
      </InfoLabel>,
    );
    await open();
    expect(label()).toHaveClass('text-body-2');
    expect(label()).not.toHaveClass('wave:text-body-1');
    expect(button()).toHaveClass('size-8');
    expect(button()).not.toHaveClass('wave:size-6');
    expect(note()).toHaveClass('px-4');
    expect(note()).not.toHaveClass('wave:px-3');
  });

  it('locks the label’s id and htmlFor: the button keeps its name', () => {
    render(
      <InfoLabel info={INFO} htmlFor="pw" slotProps={{ label: { id: 'mine', htmlFor: 'other' } }}>
        Password
      </InfoLabel>,
    );
    expect(label().id).not.toBe('mine');
    expect(label()).toHaveAttribute('for', 'pw');
    expect(button()).toHaveAccessibleName('Password Information');
  });

  it('locks the info button’s id, type, name, disabled and hidden state and tab stop', () => {
    render(
      <>
        <span id="extra">More</span>
        <InfoLabel
          info={INFO}
          slotProps={{
            infoButton: {
              id: 'mine',
              type: 'submit',
              'aria-label': 'Other',
              'aria-labelledby': 'extra',
              'aria-haspopup': 'dialog',
              disabled: true,
              tabIndex: -1,
              hidden: true,
              'aria-hidden': true,
              title: 'More information',
            },
          }}
        >
          Password
        </InfoLabel>
      </>,
    );
    const el = button();
    expect(el.id).not.toBe('mine');
    expect(el).toHaveAttribute('type', 'button');
    expect(el).toHaveAttribute('aria-label', 'Information');
    // Your ids come after the label's and the button's own.
    expect(el).toHaveAttribute('aria-labelledby', `${label().id} ${el.id} extra`);
    expect(el).toHaveAccessibleName('Password Information More');
    for (const name of ['aria-haspopup', 'disabled', 'tabindex', 'hidden', 'aria-hidden']) {
      expect(el, name).not.toHaveAttribute(name);
    }
    expect(el).toHaveAttribute('title', 'More information');
  });

  it('keeps the info button reachable: a part sets no inert on it', () => {
    render(
      <InfoLabel info={INFO} slotProps={{ infoButton: { inert: true } }}>
        Password
      </InfoLabel>,
    );
    expect(button()).not.toHaveAttribute('inert');
  });

  it('keeps the props it passes on to its InfoButton over yours from untyped code', async () => {
    render(
      <InfoLabel
        info={INFO}
        size="medium"
        slotProps={{
          infoButton: {
            info: 'Other',
            size: 'large',
            openOnHover: false,
            motion: null,
          } as never,
        }}
      >
        Password
      </InfoLabel>,
    );
    expect(button()).toHaveAccessibleDescription(INFO);
    expect(button().querySelector('svg')).toHaveAttribute('width', '16');
    await open();
    expect(note()).toHaveTextContent(INFO);
  });

  it('lets your data-* replace the InfoButton’s own of that name, its look unchanged', () => {
    render(
      <InfoLabel info={INFO} slotProps={{ infoButton: { 'data-size': 'large' } }}>
        Password
      </InfoLabel>,
    );
    expect(button()).toHaveAttribute('data-size', 'large');
    expect(button().querySelector('svg')).toHaveAttribute('width', '16');
  });

  it('takes the info part as its InfoButton’s, over one passed on through infoButton', async () => {
    render(
      <InfoLabel
        info={INFO}
        slotProps={{
          infoButton: { slotProps: { info: { 'data-nested': '' } } } as never,
          info: { 'data-label': '' },
        }}
      >
        Password
      </InfoLabel>,
    );
    await open();
    expect(note()).toHaveAttribute('data-label');
    expect(note()).not.toHaveAttribute('data-nested');
  });

  it('ignores a slotProps passed on through infoButton without an info part', async () => {
    render(
      <InfoLabel
        info={INFO}
        slotProps={{ infoButton: { slotProps: { info: { 'data-nested': '' } } } as never }}
      >
        Password
      </InfoLabel>,
    );
    await open();
    expect(note()).not.toHaveAttribute('data-nested');
  });

  it('reaches only its own note: an InfoButton inside info keeps its own', async () => {
    render(
      <InfoLabel
        info={<InfoButton info="Inner note" aria-label="Inner" openOnHover={false} />}
        openOnHover={false}
        slotProps={{ info: { 'data-label': '' } }}
      >
        Password
      </InfoLabel>,
    );
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Inner' }));
    await act(async () => {});
    const notes = screen.getAllByRole('note');
    expect(notes).toHaveLength(2);
    const inner = notes.find((el) => el.textContent === 'Inner note');
    expect(inner).not.toHaveAttribute('data-label');
    expect(inner).not.toHaveClass(infoLabelClassNames.info);
    expect(note()).toHaveAttribute('data-label');
  });

  it('locks the note as the InfoButton does', async () => {
    render(
      <InfoLabel
        info={INFO}
        slotProps={{ info: { id: 'mine', role: 'dialog', hidden: true, 'aria-hidden': true } }}
      >
        Password
      </InfoLabel>,
    );
    await open();
    const el = screen.getByRole('note');
    expect(el).toBe(note());
    expect(el.id).not.toBe('mine');
    expect(button()).toHaveAttribute('aria-controls', el.id);
    expect(el).not.toHaveAttribute('hidden');
    expect(el).not.toHaveAttribute('aria-hidden');
    expect(el).toHaveAccessibleName('Password Information');
  });

  it('attaches your refs to the parts', async () => {
    const labelRef = React.createRef<HTMLLabelElement>();
    const buttonRef = React.createRef<HTMLButtonElement>();
    const infoRef = React.createRef<HTMLDivElement>();
    render(
      <InfoLabel
        info={INFO}
        slotProps={{
          label: { ref: labelRef },
          infoButton: { ref: buttonRef },
          info: { ref: infoRef },
        }}
      >
        Password
      </InfoLabel>,
    );
    expect(labelRef.current).toBe(label());
    expect(buttonRef.current).toBe(button());
    await open();
    expect(infoRef.current).toBe(note());
  });

  it('runs your button handlers first: preventDefault() in your onClick keeps the note closed', async () => {
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    const { rerender } = render(
      <InfoLabel info={INFO} openOnHover={false} slotProps={{ infoButton: { onClick } }}>
        Password
      </InfoLabel>,
    );
    await open();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('note')).toBeNull();
    rerender(
      <InfoLabel info={INFO} openOnHover={false} slotProps={{ infoButton: { onClick: () => {} } }}>
        Password
      </InfoLabel>,
    );
    await open();
    expect(screen.getByRole('note')).toBeInTheDocument();
  });

  it('calls your part handlers once per click in StrictMode', async () => {
    const onLabelClick = vi.fn();
    const onButtonClick = vi.fn();
    const onInfoClick = vi.fn();
    render(
      <React.StrictMode>
        <InfoLabel
          info={INFO}
          openOnHover={false}
          slotProps={{
            label: { onClick: onLabelClick },
            infoButton: { onClick: onButtonClick },
            info: { onClick: onInfoClick },
          }}
        >
          Password
        </InfoLabel>
      </React.StrictMode>,
    );
    fireEvent.click(label());
    await open();
    fireEvent.click(note());
    expect(onLabelClick).toHaveBeenCalledTimes(1);
    expect(onButtonClick).toHaveBeenCalledTimes(1);
    expect(onInfoClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('note')).toBeInTheDocument();
  });

  it('has no accessibility violations with every part customised', async () => {
    render(
      <InfoLabel
        info={INFO}
        slotProps={{
          label: { className: 'my-label' },
          infoButton: { className: 'my-button' },
          info: { className: 'my-note' },
        }}
      >
        Password
      </InfoLabel>,
    );
    await open();
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof InfoLabelSlotProps>().toEqualTypeOf<'label' | 'infoButton' | 'info'>();
    expectTypeOf<NonNullable<InfoLabelSlotProps['label']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLLabelElement> | undefined
    >();
    expectTypeOf<NonNullable<InfoLabelSlotProps['infoButton']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLButtonElement> | undefined
    >();
    expectTypeOf<NonNullable<InfoLabelSlotProps['info']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    // The `info` part is the InfoButton's: the same type.
    expectTypeOf<InfoLabelSlotProps['info']>().toEqualTypeOf<
      NonNullable<InfoButtonProps['slotProps']>['info']
    >();
    void (
      (
        // @ts-expect-error -- a part takes no children: the label text is the InfoLabel's
        <InfoLabel info="x" slotProps={{ label: { children: 'Other' } }}>
          Password
        </InfoLabel>
      )
    );
  });
});
