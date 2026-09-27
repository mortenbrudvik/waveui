import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfoLabel } from '../InfoLabel';
import { expectNoA11yViolations, testNoImplicitSubmit, testSystemProps } from '../../../test-utils';

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
      expect(label).toHaveClass('text-body-2', 'font-semibold');
      expect(label).toHaveTextContent('Password*');
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

    it('the deprecated label prop still works and warns once; children win', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { rerender } = render(<InfoLabel label="Old" info="x" />);
      expect(screen.getByText('Old')).toBeInTheDocument();
      rerender(
        <InfoLabel label="Old" info="x">
          New
        </InfoLabel>,
      );
      expect(screen.getByText('New')).toBeInTheDocument();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        '[WaveUI] InfoLabel: `label` is deprecated and will be removed in 1.0. Use `children` instead.',
      );
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
      expect(screen.getByText('Password').closest('label')).toHaveClass('text-muted-foreground');
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
