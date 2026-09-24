import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfoLabel } from '../InfoLabel';
import { expectNoA11yViolations, testNoImplicitSubmit, testSystemProps } from '../../../test-utils';

const INFO = 'Use at least 8 characters.';

/** The visual popup (portaled, aria-hidden, only while open). */
function getSurface(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-wave-infolabel-surface]');
}

function renderInfoLabel(props: Partial<React.ComponentProps<typeof InfoLabel>> = {}) {
  const utils = render(<InfoLabel label="Password" info={INFO} {...props} />);
  return { ...utils, button: screen.getByRole('button', { name: 'Information' }) };
}

describe('InfoLabel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  testSystemProps(InfoLabel, {
    expectedTag: 'span',
    displayName: 'InfoLabel',
    defaultProps: { label: 'Name', info: 'Enter your name' },
  });

  it('renders the label text', () => {
    render(<InfoLabel label="Email" info="Your email address" />);
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

    it('accepts a localised button label', () => {
      render(<InfoLabel label="Passwort" info={INFO} infoButtonLabel="Hinweis" />);
      expect(screen.getByRole('button', { name: 'Hinweis' })).toBeInTheDocument();
    });

    it('describes the button with the info text while closed (SSR-safe inline description)', () => {
      const { button } = renderInfoLabel();
      expect(button).toHaveAccessibleDescription(INFO);
      expect(getSurface()).toBeNull();
    });

    it('renders the description on the server', () => {
      const html = renderToString(<InfoLabel label="Password" info={INFO} />);
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

  testNoImplicitSubmit(InfoLabel, { defaultProps: { label: 'Password', info: INFO } });

  describe('interaction (data-display#13)', () => {
    it('opens on a mouse click and stays open (not open-then-closed)', async () => {
      const user = userEvent.setup();
      const { button } = renderInfoLabel();
      await user.click(button);
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute('aria-expanded', 'true');
      const surface = getSurface();
      expect(surface).toHaveTextContent(INFO);
      expect(surface).toHaveAttribute('aria-hidden', 'true');
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
          <InfoLabel label="Password" info={INFO} />
          <button type="button">Next</button>
        </>,
      );
      await user.tab();
      expect(getSurface()).not.toBeNull();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
      expect(getSurface()).toBeNull();
    });

    it('closes a pinned popup on an outside press', async () => {
      const user = userEvent.setup();
      render(
        <>
          <InfoLabel label="Password" info={INFO} />
          <p>Elsewhere</p>
        </>,
      );
      await user.click(screen.getByRole('button', { name: 'Information' }));
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
});
