import * as React from 'react';
import { afterEach, describe, it, expect, expectTypeOf } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeachingPopover, type TeachingPopoverProps } from '../TeachingPopover';
import { teachingPopoverClassNames } from '../../../lib/classNames';
import { getTopmostLayer } from '../../../lib/layers';
import { expectNoA11yViolations, renderWithProviders } from '../../../test-utils';

/*
 * Backlog 1.1, TeachingPopover: `appearance` (teaching-2) and `trapFocus` (teaching-4); the
 * positioning options (teaching-3) are `positioning`, `target`, `side` and `align` since 0.12.
 */

afterEach(() => {
  cleanup();
  expect(getTopmostLayer()).toBeNull();
});

const steps = [
  { title: 'Welcome', body: 'This is step one.' },
  { title: 'Features', body: 'Here are the features.' },
  { title: 'Done', body: 'You are all set!' },
];

const surface = () => document.querySelector<HTMLElement>('.' + teachingPopoverClassNames.root)!;

describe('appearance (teaching-2)', () => {
  it('renders the neutral appearance by default, as a data attribute', () => {
    render(<TeachingPopover steps={steps} />);
    expect(surface()).toHaveAttribute('data-appearance', 'neutral');
    expect(surface()).toHaveClass(
      'wave:bg-background',
      'wave:border-border',
      'wave:text-foreground',
    );
  });

  it.each([
    ['brand', ['wave:bg-primary', 'wave:text-primary-foreground', 'wave:border-primary']],
    [
      'inverted',
      ['wave:bg-inverted', 'wave:text-inverted-foreground', 'wave:border-inverted-border'],
    ],
  ] as const)('draws the %s surface', (appearance, classes) => {
    render(<TeachingPopover steps={steps} appearance={appearance} />);
    expect(surface()).toHaveAttribute('data-appearance', appearance);
    expect(surface()).toHaveClass(...classes);
    expect(surface()).not.toHaveClass('wave:bg-background');
  });

  it.each(['brand', 'inverted'] as const)(
    'turns the title, body, Close button and dots of a %s surface to its text color',
    (appearance) => {
      render(<TeachingPopover steps={steps} appearance={appearance} />);
      expect(screen.getByRole('heading', { level: 3 })).toHaveClass('wave:text-inherit');
      expect(screen.getByText('This is step one.')).toHaveClass('wave:text-inherit');
      expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('wave:text-inherit');
      const dots = Array.from(document.querySelectorAll('[data-wave-teaching-popover-dot]'));
      expect(dots[0]).toHaveClass('wave:bg-current');
      expect(dots[1]).toHaveClass('wave:bg-current/40');
    },
  );

  it('draws Next as a neutral button and Back as a transparent one in the surface color', () => {
    render(<TeachingPopover steps={steps} appearance="brand" activeStep={1} />);
    const next = screen.getByRole('button', { name: 'Next' });
    const back = screen.getByRole('button', { name: 'Back' });
    // Not the primary look that would vanish into the brand fill.
    expect(next).not.toHaveClass('wave:bg-primary');
    expect(back).toHaveClass('wave:bg-transparent', 'wave:text-inherit');
  });

  it('keeps the primary Next button on the neutral surface', () => {
    render(<TeachingPopover steps={steps} activeStep={1} />);
    expect(screen.getByRole('button', { name: 'Next' })).toHaveClass('wave:bg-primary');
    expect(screen.getByRole('button', { name: 'Back' })).not.toHaveClass('wave:text-inherit');
  });

  it('lets a consumer className win and leaves the actions you give as you gave them', () => {
    render(
      <TeachingPopover
        steps={steps}
        appearance="inverted"
        className="bg-red-500"
        primaryAction={{ children: 'Learn more', className: 'my-primary' }}
      />,
    );
    expect(surface()).toHaveClass('bg-red-500');
    expect(surface()).not.toHaveClass('wave:bg-inverted');
    expect(screen.getByRole('button', { name: 'Learn more' })).toHaveClass('my-primary');
  });

  it('draws the parts form and the carousel parts too', () => {
    render(
      <TeachingPopover steps={steps} appearance="brand">
        <TeachingPopover.Surface>
          <TeachingPopover.Header>Tour</TeachingPopover.Header>
          <TeachingPopover.Carousel />
        </TeachingPopover.Surface>
      </TeachingPopover>,
    );
    expect(surface()).toHaveAttribute('data-appearance', 'brand');
    expect(screen.getByText('Tour')).toHaveClass('wave:text-inherit');
    const dot = document.querySelector('[data-wave-teaching-popover-dot]');
    expect(dot).toHaveClass('wave:bg-current');
  });

  it('draws the interactive step buttons and the page count in the surface color', () => {
    render(
      <TeachingPopover steps={steps} appearance="brand">
        <TeachingPopover.Surface>
          <TeachingPopover.Title />
          <TeachingPopover.CarouselFooter>
            <TeachingPopover.CarouselNav />
            <TeachingPopover.CarouselPageCount />
          </TeachingPopover.CarouselFooter>
        </TeachingPopover.Surface>
      </TeachingPopover>,
    );
    const indicators = document.querySelectorAll('.wave-teaching-popover-carousel-nav__indicator');
    expect(indicators[0]).toHaveClass('wave:bg-current');
    expect(indicators[1]).toHaveClass('wave:bg-current/40');
    expect(screen.getByText('1 of 3')).toHaveClass('wave:text-inherit');
  });

  it('keeps its appearance in a dark theme tree', () => {
    renderWithProviders(<TeachingPopover steps={steps} appearance="inverted" />, { theme: 'dark' });
    expect(surface()).toHaveAttribute('data-appearance', 'inverted');
  });

  it('has no axe violations in every appearance', async () => {
    for (const appearance of ['neutral', 'brand', 'inverted'] as const) {
      const { unmount } = render(<TeachingPopover steps={steps} appearance={appearance} />);
      await expectNoA11yViolations(document.body);
      unmount();
    }
  });

  it('is typed with the three appearances', () => {
    expectTypeOf<TeachingPopoverProps['appearance']>().toEqualTypeOf<
      'neutral' | 'brand' | 'inverted' | undefined
    >();
  });
});

describe('trapFocus (teaching-4)', () => {
  function Page(props: Partial<TeachingPopoverProps>) {
    return (
      <>
        <button type="button">Before</button>
        <TeachingPopover steps={steps} {...props}>
          <TeachingPopover.Trigger>
            <button type="button">Take the tour</button>
          </TeachingPopover.Trigger>
        </TeachingPopover>
        <button type="button">After</button>
      </>
    );
  }

  it('moves focus to the surface and cycles Tab between its controls', async () => {
    const user = userEvent.setup();
    render(<Page trapFocus />);
    await user.click(screen.getByRole('button', { name: 'Take the tour' }));
    await act(async () => {});
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveFocus();
    const inside = ['Close', 'Back', 'Next'].map((name) => screen.getByRole('button', { name }));
    await user.tab();
    expect(inside).toContain(document.activeElement);
    // Tab around the whole cycle: it never reaches the page.
    const seen = new Set<Element | null>();
    for (let i = 0; i < 8; i += 1) {
      await user.tab();
      seen.add(document.activeElement);
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: 'Before' })).not.toHaveFocus();
    expect(screen.getByRole('button', { name: 'After' })).not.toHaveFocus();
  });

  it('cycles backwards with Shift+Tab too', async () => {
    const user = userEvent.setup();
    render(<Page trapFocus />);
    await user.click(screen.getByRole('button', { name: 'Take the tour' }));
    await act(async () => {});
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 6; i += 1) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('dismisses on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Page trapFocus />);
    await user.click(screen.getByRole('button', { name: 'Take the tour' }));
    await act(async () => {});
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take the tour' })).toHaveFocus();
  });

  it('does not make the page inert', async () => {
    const user = userEvent.setup();
    render(<Page trapFocus />);
    await user.click(screen.getByRole('button', { name: 'Take the tour' }));
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    await user.keyboard('{Escape}');
  });

  it('is released when the popover closes: Tab reaches the page again', async () => {
    const user = userEvent.setup();
    render(<Page trapFocus />);
    await user.click(screen.getByRole('button', { name: 'Take the tour' }));
    await user.keyboard('{Escape}');
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('traps a popover rendered in place, without a target', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <TeachingPopover steps={steps} trapFocus />
      </>,
    );
    await act(async () => {});
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveFocus();
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.keyboard('{Escape}');
  });

  it('leaves the default non-modal Tab order alone: Tab leaves the popover', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Take the tour' }));
    await act(async () => {});
    const dialog = screen.getByRole('dialog');
    let left = false;
    for (let i = 0; i < 8 && !left; i += 1) {
      await user.tab();
      left = !dialog.contains(document.activeElement);
    }
    expect(left).toBe(true);
    await user.keyboard('{Escape}');
  });

  it('is typed as a boolean', () => {
    expectTypeOf<TeachingPopoverProps['trapFocus']>().toEqualTypeOf<boolean | undefined>();
  });
});
