import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react';
import * as stories from '../../../../stories/Stepper.stories';
import { Stepper, StepperStep } from '../Stepper';
import type { StepProps, StepperProps } from '../Stepper';
import type { Orientation, Slot } from '../../../lib/types';
import {
  asClientReference,
  renderWithProviders,
  testClassName,
  testCompoundExposure,
  testDisplayName,
  testForwardRef,
  testRestSpread,
  testSystemProps,
} from '../../../test-utils';

// Direct children (an array), not a Fragment: the root audits and ref tests run on real steps.
const defaultChildren = [
  <Stepper.Step key="account" label="Account" description="Create your account" />,
  <Stepper.Step key="profile" label="Profile" />,
  <Stepper.Step key="review" label="Review" />,
];

function StepperWrapper({ children }: { children: React.ReactNode }) {
  return <Stepper>{children}</Stepper>;
}

/** The step buttons in order. */
const stepButtons = () => screen.getAllByRole('button');
/** The step button whose accessible name contains `label`. */
const stepButton = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`\\b${label}$`) });

const orientations: Orientation[] = ['horizontal', 'vertical'];

describe('Stepper', () => {
  testSystemProps(Stepper, {
    expectedTag: 'div',
    displayName: 'Stepper',
    defaultProps: { children: defaultChildren, defaultActiveStep: 1 },
    a11yVariants: [
      { name: 'vertical', props: { orientation: 'vertical' } },
      { name: 'linear', props: { linear: true, defaultActiveStep: 0 } },
      {
        name: 'error and disabled steps',
        props: {
          children: [
            <Stepper.Step key="a" label="Details" />,
            <Stepper.Step key="b" label="Verification" error />,
            <Stepper.Step key="c" label="Complete" disabled />,
          ],
        },
      },
    ],
  });

  testCompoundExposure(Stepper, ['Step']);

  it('exports the flat StepperStep name (C-COMPOUND)', () => {
    expect(StepperStep).toBe(Stepper.Step);
  });

  it('keeps ref in the props interfaces (C-REF)', () => {
    expectTypeOf<StepperProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<StepProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
  });

  describe('Stepper.Step system props (feedback-navigation#41)', () => {
    const stepProps = { label: 'Account' };
    testForwardRef(Stepper.Step, 'div', stepProps, { wrapper: StepperWrapper });
    testRestSpread(Stepper.Step, stepProps, { wrapper: StepperWrapper });
    testClassName(Stepper.Step, stepProps, { wrapper: StepperWrapper });
    testDisplayName(Stepper.Step, 'Step');
  });

  it('throws when a Step is rendered outside a Stepper (C-CONTEXT)', () => {
    // The development throw is the whole report: nothing is logged besides it (R14).
    const error = vi.spyOn(console, 'error');
    expect(() => render(<Stepper.Step label="Orphan" />)).toThrow(
      new Error('[WaveUI] Stepper.Step must be used within Stepper'),
    );
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  describe('context guard in production (R3)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('logs the missing-context error once and renders an inert step instead of throwing', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      const onClick = vi.fn();
      const orphans = (
        <>
          <Stepper.Step label="Orphan" onClick={onClick} />
          <Stepper.Step label="Second orphan" />
        </>
      );
      const { rerender } = render(orphans);
      rerender(orphans);
      await user.click(stepButton('Orphan'));
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(error.mock.calls.map(([message]) => String(message))).toEqual([
        '[WaveUI] Stepper.Step must be used within Stepper',
      ]);
    });
  });

  describe('structure (feedback-navigation#38)', () => {
    it('keeps the root group and renders an ordered list with one item per step', () => {
      render(
        <Stepper data-testid="stepper">
          <Stepper.Step label="Account" />
          <Stepper.Step label="Profile" />
        </Stepper>,
      );
      const root = screen.getByTestId('stepper');
      expect(root.tagName).toBe('DIV');
      expect(root).toHaveAttribute('role', 'group');
      expect(root).toHaveAccessibleName('Progress');
      const list = within(root).getByRole('list');
      expect(list.tagName).toBe('OL');
      // Explicit role: WebKit/VoiceOver drops list semantics from a `list-style: none` list
      // outside a <nav> unless role="list" is set.
      expect(list).toHaveClass('list-none');
      expect(list).toHaveAttribute('role', 'list');
      expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    });

    it("keeps each Step's own root element (ref, className, rest) inside its list item", () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <Stepper>
          <Stepper.Step ref={ref} label="Account" className="custom-step" data-testid="step" />
        </Stepper>,
      );
      const step = screen.getByTestId('step');
      expect(ref.current).toBe(step);
      expect(step).toHaveClass('custom-step');
      expect(step.parentElement?.tagName).toBe('LI');
      expect(within(step).getByRole('button', { name: /Account/ })).toBeInTheDocument();
    });

    it('marks the active step with aria-current="step" and keeps the number in every name', () => {
      render(
        <Stepper defaultActiveStep={1}>
          <Stepper.Step label="Account" />
          <Stepper.Step label="Profile" />
          <Stepper.Step label="Review" />
        </Stepper>,
      );
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('2. Profile');
      const items = screen.getAllByRole('listitem');
      expect(within(items[0]).getByRole('button')).toHaveAccessibleName('Completed: 1. Account');
      expect(within(items[0]).getByRole('button')).not.toHaveAttribute('aria-current');
      expect(within(items[2]).getByRole('button')).toHaveAccessibleName('3. Review');
      expect(within(items[2]).getByRole('button')).not.toHaveAttribute('aria-current');
    });

    it('announces error and the completed/error overrides as status text', () => {
      render(
        <Stepper defaultActiveStep={1}>
          <Stepper.Step label="Details" completed={false} />
          <Stepper.Step label="Verification" error />
          <Stepper.Step label="Shipping" completed />
          <Stepper.Step label="Complete" />
        </Stepper>,
      );
      const items = screen.getAllByRole('listitem');
      expect(within(items[0]).getByRole('button')).toHaveAccessibleName('1. Details');
      expect(within(items[1]).getByRole('button')).toHaveAccessibleName('Error: 2. Verification');
      expect(within(items[1]).getByRole('button')).toHaveAttribute('aria-current', 'step');
      expect(within(items[2]).getByRole('button')).toHaveAccessibleName('Completed: 3. Shipping');
      expect(within(items[3]).getByRole('button')).toHaveAccessibleName('4. Complete');
      // The status text is visually hidden; the visible label is unchanged.
      expect(within(items[1]).getByText('Error:', { exact: false })).toHaveClass('sr-only');
    });

    describe('statusLabels (nav-other-code-3, R7)', () => {
      const renderSteps = (statusLabels: StepperProps['statusLabels']) =>
        render(
          <Stepper defaultActiveStep={2} aria-label="Fremdrift" statusLabels={statusLabels}>
            <Stepper.Step label="Konto" />
            <Stepper.Step label="Betaling" error />
            <Stepper.Step label="Bekreft" />
          </Stepper>,
        );

      it('replaces the status text of completed and error steps', () => {
        renderSteps({ completed: 'Fullført:', error: 'Feil:' });
        expect(screen.getByRole('group')).toHaveAccessibleName('Fremdrift');
        const [konto, betaling, bekreft] = stepButtons();
        expect(konto).toHaveAccessibleName('Fullført: 1. Konto');
        expect(betaling).toHaveAccessibleName('Feil: 2. Betaling');
        expect(bekreft).toHaveAccessibleName('3. Bekreft');
      });

      it('keeps the English default of a label that is not given', () => {
        renderSteps({ error: 'Feil:' });
        const [konto, betaling] = stepButtons();
        expect(konto).toHaveAccessibleName('Completed: 1. Konto');
        expect(betaling).toHaveAccessibleName('Feil: 2. Betaling');
      });

      it("leaves the status out with ''", () => {
        renderSteps({ completed: '', error: '' });
        const [konto, betaling] = stepButtons();
        expect(konto).toHaveAccessibleName('1. Konto');
        expect(betaling).toHaveAccessibleName('2. Betaling');
      });
    });

    it('describes a step by its description instead of adding it to the name', () => {
      render(
        <Stepper>
          <Stepper.Step label="Account" description="Create your account" />
        </Stepper>,
      );
      const button = screen.getByRole('button', { current: 'step' });
      expect(button).toHaveAccessibleName('1. Account');
      expect(button).toHaveAccessibleDescription('Create your account');
    });

    it('marks the step indicator decorative', () => {
      render(
        <Stepper defaultActiveStep={2}>
          <Stepper.Step label="Account" />
          <Stepper.Step label="Profile" error />
          <Stepper.Step label="Review" />
        </Stepper>,
      );
      const items = screen.getAllByRole('listitem');
      const check = items[0].querySelector('svg[data-wave-icon="check"]');
      expect(check).not.toBeNull();
      expect(check?.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(items[1].querySelector('svg[data-wave-icon="dismiss"]')).not.toBeNull();
      expect(items[1].querySelector('svg[data-wave-icon="check"]')).toBeNull();
      expect(items[2].querySelector('svg')).toBeNull();
    });

    it('exposes step state as data attributes (C-CLASS)', () => {
      render(
        <Stepper defaultActiveStep={1}>
          <Stepper.Step label="Account" data-testid="s1" />
          <Stepper.Step label="Profile" data-testid="s2" />
          <Stepper.Step label="Review" data-testid="s3" error disabled />
        </Stepper>,
      );
      expect(screen.getByTestId('s1')).toHaveAttribute('data-completed');
      expect(screen.getByTestId('s1')).not.toHaveAttribute('data-active');
      expect(screen.getByTestId('s2')).toHaveAttribute('data-active');
      expect(screen.getByTestId('s3')).toHaveAttribute('data-error');
      expect(screen.getByTestId('s3')).toHaveAttribute('data-disabled');
    });
  });

  describe('registration (feedback-navigation#36)', () => {
    it('numbers Fragment-wrapped steps 1..n and reports their indexes', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      render(
        <Stepper onStepChange={onStepChange}>
          <>
            <Stepper.Step label="Account" />
            <>
              <Stepper.Step label="Profile" />
            </>
          </>
          <Stepper.Step label="Review" />
        </Stepper>,
      );
      const [account, profile, review] = stepButtons();
      expect(account).toHaveAccessibleName('1. Account');
      expect(account).toHaveAttribute('aria-current', 'step');
      expect(profile).toHaveAccessibleName('2. Profile');
      expect(review).toHaveAccessibleName('3. Review');
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
      await user.click(stepButton('Profile'));
      expect(onStepChange).toHaveBeenLastCalledWith(1);
      await user.click(stepButton('Review'));
      expect(onStepChange).toHaveBeenLastCalledWith(2);
    });

    it('renumbers conditional steps', () => {
      function Steps({ showProfile }: { showProfile: boolean }) {
        return (
          <Stepper>
            <Stepper.Step label="Account" />
            {showProfile && <Stepper.Step label="Profile" />}
            <Stepper.Step label="Review" />
          </Stepper>
        );
      }
      const { rerender } = render(<Steps showProfile={false} />);
      expect(stepButtons()).toHaveLength(2);
      expect(stepButton('Review')).toHaveAccessibleName('2. Review');

      rerender(<Steps showProfile />);
      expect(stepButtons()).toHaveLength(3);
      expect(stepButton('Profile')).toHaveAccessibleName('2. Profile');
      expect(stepButton('Review')).toHaveAccessibleName('3. Review');
    });

    it('renumbers a conditional Fragment of steps toggled on and off at runtime', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      function Checkout({ billing }: { billing: boolean }) {
        return (
          <Stepper onStepChange={onStepChange}>
            <Stepper.Step label="Cart" />
            {billing && (
              <>
                <Stepper.Step label="Billing" />
                <Stepper.Step label="Payment" />
              </>
            )}
            <Stepper.Step label="Review" />
          </Stepper>
        );
      }
      const connectors = () => document.querySelectorAll('[data-wave-stepper-connector]');
      const expectSteps = (names: string[]) => {
        const buttons = stepButtons();
        expect(buttons).toHaveLength(names.length);
        buttons.forEach((button, i) => expect(button).toHaveAccessibleName(names[i]));
        expect(screen.getAllByRole('listitem')).toHaveLength(names.length);
        expect(connectors()).toHaveLength(names.length - 1);
      };

      const { rerender } = render(<Checkout billing={false} />);
      expectSteps(['1. Cart', '2. Review']);

      rerender(<Checkout billing />);
      expectSteps(['1. Cart', '2. Billing', '3. Payment', '4. Review']);
      await user.click(stepButton('Payment'));
      expect(onStepChange).toHaveBeenLastCalledWith(2);
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('3. Payment');
      await user.click(stepButton('Review'));
      expect(onStepChange).toHaveBeenLastCalledWith(3);
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('4. Review');

      rerender(<Checkout billing={false} />);
      await user.click(stepButton('Review'));
      expect(onStepChange).toHaveBeenLastCalledWith(1);
      expectSteps(['Completed: 1. Cart', '2. Review']);
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('2. Review');

      rerender(<Checkout billing />);
      expectSteps(['Completed: 1. Cart', '2. Billing', '3. Payment', '4. Review']);
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('2. Billing');
    });

    it('numbers steps rendered by wrapper components, including a wrapper with two steps', () => {
      const MyStep = (props: StepProps) => <Stepper.Step {...props} />;
      const TwoSteps = () => (
        <>
          <Stepper.Step label="Shipping" />
          <Stepper.Step label="Payment" />
        </>
      );
      const Nothing = () => null;
      render(
        <Stepper>
          <MyStep label="Cart" />
          <Nothing />
          <TwoSteps />
          <MyStep label="Confirm" data-testid="last" />
        </Stepper>,
      );
      expect(stepButton('Cart')).toHaveAccessibleName('1. Cart');
      expect(stepButton('Shipping')).toHaveAccessibleName('2. Shipping');
      expect(stepButton('Payment')).toHaveAccessibleName('3. Payment');
      expect(stepButton('Confirm')).toHaveAccessibleName('4. Confirm');
      // The last step draws no connector.
      expect(screen.getByTestId('last').querySelector('[data-wave-stepper-connector]')).toBeNull();
      expect(document.querySelectorAll('[data-wave-stepper-connector]')).toHaveLength(3);
    });

    it('follows a keyed reorder', () => {
      const labels = ['Account', 'Profile', 'Review'];
      const { rerender } = render(
        <Stepper>
          {labels.map((label) => (
            <Stepper.Step key={label} label={label} />
          ))}
        </Stepper>,
      );
      rerender(
        <Stepper>
          {[...labels].reverse().map((label) => (
            <Stepper.Step key={label} label={label} />
          ))}
        </Stepper>,
      );
      expect(stepButton('Review')).toHaveAccessibleName('1. Review');
      expect(stepButton('Account')).toHaveAccessibleName('3. Account');
    });

    describe('a wrapper component that reorders its own keyed steps (the root does not re-render)', () => {
      interface Flipper {
        flip: () => void;
      }

      const alphaBeta = () => [
        <Stepper.Step key="alpha" label="Alpha" />,
        <Stepper.Step key="beta" label="Beta" />,
      ];

      /**
       * Alpha and Beta in a wrapper with its own order state. `memoized` reuses the same elements,
       * so React moves the list items without re-rendering either step.
       */
      function ReorderingSteps({ ref, memoized }: { ref: React.Ref<Flipper>; memoized: boolean }) {
        const [reversed, setReversed] = React.useState(false);
        React.useImperativeHandle(ref, () => ({ flip: () => setReversed((r) => !r) }), []);
        const [stableSteps] = React.useState(alphaBeta);
        const [alpha, beta] = memoized ? stableSteps : alphaBeta();
        return reversed ? [beta, alpha] : [alpha, beta];
      }

      // Re-rendered steps re-sync in their own layout effects, within the same act(); reused
      // elements re-render no step, so the root's MutationObserver catches the move (a microtask).
      it.each([
        { name: 'steps re-render (synchronous)', memoized: false },
        { name: 'reused step elements, no step re-renders (observer)', memoized: true },
      ])('renumbers the steps and reports their new indexes: $name', async ({ memoized }) => {
        const user = userEvent.setup();
        const onStepChange = vi.fn();
        const flipper = React.createRef<Flipper>();
        render(
          <Stepper onStepChange={onStepChange}>
            <ReorderingSteps ref={flipper} memoized={memoized} />
            <Stepper.Step label="Gamma" />
          </Stepper>,
        );
        expect(stepButton('Alpha')).toHaveAccessibleName('1. Alpha');
        expect(stepButton('Beta')).toHaveAccessibleName('2. Beta');

        if (memoized) {
          await act(async () => flipper.current?.flip());
        } else {
          act(() => flipper.current?.flip());
        }
        const [beta, alpha, gamma] = stepButtons();
        expect(beta).toHaveAccessibleName('1. Beta');
        expect(alpha).toHaveAccessibleName('2. Alpha');
        expect(gamma).toHaveAccessibleName('3. Gamma');

        await user.click(stepButton('Alpha'));
        expect(onStepChange).toHaveBeenLastCalledWith(1);
        expect(stepButton('Alpha')).toHaveAttribute('aria-current', 'step');
        await user.click(stepButton('Beta'));
        expect(onStepChange).toHaveBeenLastCalledWith(0);
      });
    });

    it('numbers Fragment-wrapped steps in the server render (before registration)', () => {
      const warn = vi.spyOn(console, 'warn');
      const error = vi.spyOn(console, 'error');
      const html = renderToString(
        <Stepper defaultActiveStep={1}>
          <>
            <Stepper.Step label="Account" />
            <Stepper.Step label="Profile" />
          </>
          <Stepper.Step label="Review" />
        </Stepper>,
      );
      const container = document.createElement('div');
      container.innerHTML = html;
      // Attached so aria-labelledby resolves; removed before the body-is-empty check.
      document.body.append(container);
      try {
        const buttons = within(container).getAllByRole('button');
        expect(buttons).toHaveLength(3);
        expect(buttons[0]).toHaveAccessibleName('Completed: 1. Account');
        expect(buttons[1]).toHaveAccessibleName('2. Profile');
        expect(buttons[1]).toHaveAttribute('aria-current', 'step');
        expect(buttons[2]).toHaveAccessibleName('3. Review');
        expect(container.querySelectorAll('[data-wave-stepper-connector]')).toHaveLength(2);
        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
      } finally {
        container.remove();
        warn.mockRestore();
        error.mockRestore();
      }
    });

    it('numbers steps written in a Server Component (lazy client references) the same way (R1)', () => {
      const Step = asClientReference(Stepper.Step);
      const plain = renderToString(
        <Stepper defaultActiveStep={1}>
          <>
            <Stepper.Step label="Account" />
            <Stepper.Step label="Profile" />
          </>
          <Stepper.Step label="Review" />
        </Stepper>,
      );
      const lazy = renderToString(
        <Stepper defaultActiveStep={1}>
          <>
            <Step label="Account" />
            <Step label="Profile" />
          </>
          <Step label="Review" />
        </Stepper>,
      );
      expect(lazy).toBe(plain);
    });

    it('lets the index prop override the position', () => {
      render(
        <Stepper defaultActiveStep={3}>
          <Stepper.Step label="Later" index={3} />
        </Stepper>,
      );
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('4. Later');
    });
  });

  describe.each(orientations)('%s orientation', (orientation) => {
    const renderSteps = (props: Partial<StepperProps> = {}, stepProps: Partial<StepProps> = {}) =>
      render(
        <Stepper orientation={orientation} {...props}>
          <Stepper.Step label="Account" />
          <Stepper.Step label="Profile" {...stepProps} />
          <Stepper.Step label="Review" />
        </Stepper>,
      );

    it('activates a step on click and updates the uncontrolled state (feedback-navigation#42)', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      renderSteps({ onStepChange });
      await user.click(stepButton('Profile'));
      expect(onStepChange).toHaveBeenCalledTimes(1);
      expect(onStepChange).toHaveBeenCalledWith(1);
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('2. Profile');
      expect(stepButton('Account')).toHaveAccessibleName('Completed: 1. Account');
    });

    it('activates with Enter and Space and calls the consumer onClick for both (feedback-navigation#37)', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      const onClick = vi.fn();
      renderSteps({ onStepChange }, { onClick });
      stepButton('Profile').focus();
      await user.keyboard('{Enter}');
      expect(onStepChange).toHaveBeenLastCalledWith(1);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('2. Profile');

      stepButton('Review').focus();
      await user.keyboard(' ');
      expect(onStepChange).toHaveBeenLastCalledWith(2);
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('3. Review');

      stepButton('Profile').focus();
      await user.keyboard(' ');
      expect(onClick).toHaveBeenCalledTimes(2);
      expect(onStepChange).toHaveBeenCalledTimes(3);
    });

    it('stops the page from scrolling on Space keydown and activates only on keyup (nav-other-tests-2)', () => {
      const onStepChange = vi.fn();
      renderSteps({ onStepChange });
      const profile = stepButton('Profile');
      // fireEvent returns false when the default action (page scroll) was prevented.
      expect(fireEvent.keyDown(profile, { key: ' ' })).toBe(false);
      expect(onStepChange).not.toHaveBeenCalled();
      expect(fireEvent.keyUp(profile, { key: ' ' })).toBe(false);
      expect(onStepChange).toHaveBeenCalledTimes(1);
      expect(onStepChange).toHaveBeenCalledWith(1);
    });

    it('does nothing for a disabled step: no onClick, no onStepChange (click and keyboard)', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      const onClick = vi.fn();
      renderSteps({ onStepChange }, { onClick, disabled: true });
      const disabled = stepButton('Profile');
      expect(disabled).toHaveAttribute('aria-disabled', 'true');
      expect(disabled).toHaveAttribute('tabindex', '-1');
      await user.click(disabled);
      disabled.focus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      expect(onClick).not.toHaveBeenCalled();
      expect(onStepChange).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('1. Account');
    });

    it('blocks unreachable steps in linear mode (feedback-navigation#39)', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      const onClick = vi.fn();
      render(
        <Stepper orientation={orientation} linear onStepChange={onStepChange}>
          <Stepper.Step label="Account" />
          <Stepper.Step label="Profile" />
          <Stepper.Step label="Review" onClick={onClick} />
        </Stepper>,
      );
      const review = stepButton('Review');
      expect(review).toHaveAttribute('aria-disabled', 'true');
      expect(review).toHaveAttribute('tabindex', '-1');
      expect(stepButton('Profile')).toHaveAttribute('tabindex', '0');
      expect(stepButton('Profile')).not.toHaveAttribute('aria-disabled');
      expect(stepButton('Account')).toHaveAttribute('tabindex', '0');

      await user.click(review);
      review.focus();
      await user.keyboard('{Enter}');
      expect(onClick).not.toHaveBeenCalled();
      expect(onStepChange).not.toHaveBeenCalled();

      await user.click(stepButton('Profile'));
      expect(onStepChange).toHaveBeenCalledWith(1);
      expect(stepButton('Review')).toHaveAttribute('tabindex', '0');
      expect(stepButton('Review')).not.toHaveAttribute('aria-disabled');
    });

    it('lets a consumer onClick that calls preventDefault() suppress activation (C-COMPOSE)', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      renderSteps({ onStepChange }, { onClick: (event) => event.preventDefault() });
      await user.click(stepButton('Profile'));
      expect(onStepChange).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('1. Account');
    });

    it('gives the step buttons the shared focus ring (feedback-navigation#24)', () => {
      renderSteps();
      for (const button of stepButtons()) {
        expect(button).toHaveClass(
          'focus-visible:outline-2',
          'focus-visible:outline-offset-2',
          'focus-visible:outline-ring',
        );
      }
    });
  });

  describe('controlled (feedback-navigation#42)', () => {
    it('fires the callback but keeps the active step until the prop changes', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      const steps = [
        <Stepper.Step key="a" label="Account" />,
        <Stepper.Step key="b" label="Profile" />,
        <Stepper.Step key="c" label="Review" />,
      ];
      const { rerender } = render(
        <Stepper activeStep={0} onStepChange={onStepChange}>
          {steps}
        </Stepper>,
      );
      await user.click(stepButton('Review'));
      expect(onStepChange).toHaveBeenCalledWith(2);
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('1. Account');

      rerender(
        <Stepper activeStep={2} onStepChange={onStepChange}>
          {steps}
        </Stepper>,
      );
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('3. Review');
      expect(stepButton('Profile')).toHaveAccessibleName('Completed: 2. Profile');
    });

    it('derives linear reachability from the activeStep prop', () => {
      const steps = [
        <Stepper.Step key="a" label="Account" />,
        <Stepper.Step key="b" label="Profile" />,
        <Stepper.Step key="c" label="Review" />,
      ];
      const { rerender } = render(
        <Stepper activeStep={0} linear>
          {steps}
        </Stepper>,
      );
      expect(stepButton('Review')).toHaveAttribute('aria-disabled', 'true');
      rerender(
        <Stepper activeStep={1} linear>
          {steps}
        </Stepper>,
      );
      expect(stepButton('Review')).not.toHaveAttribute('aria-disabled');
      expect(stepButton('Review')).toHaveAttribute('tabindex', '0');
    });
  });

  describe('onStepChange semantics (table-core#3)', () => {
    it('fires when the active step is activated again', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      render(
        <Stepper defaultActiveStep={1} onStepChange={onStepChange}>
          <Stepper.Step label="Account" />
          <Stepper.Step label="Profile" />
        </Stepper>,
      );
      await user.click(stepButton('Profile'));
      expect(onStepChange).toHaveBeenCalledTimes(1);
      expect(onStepChange).toHaveBeenCalledWith(1);
    });

    it('fires exactly once per activation under StrictMode', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      render(
        <React.StrictMode>
          <Stepper onStepChange={onStepChange}>
            <Stepper.Step label="Account" />
            <Stepper.Step label="Profile" />
          </Stepper>
        </React.StrictMode>,
      );
      await user.click(stepButton('Profile'));
      expect(onStepChange).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('2. Profile');
    });
  });

  describe('styling', () => {
    it('renders the vertical orientation as a column', () => {
      render(
        <Stepper orientation="vertical" data-testid="stepper">
          <Stepper.Step label="Account" />
          <Stepper.Step label="Profile" />
        </Stepper>,
      );
      expect(screen.getByTestId('stepper')).toHaveClass('flex-col');
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-orientation', 'vertical');
      expect(screen.getByRole('list')).toHaveClass('flex-col');
    });

    it('draws the active circle and label with theme tokens (input-basic#8)', () => {
      render(
        <Stepper defaultActiveStep={1}>
          <Stepper.Step label="Account" data-testid="done" />
          <Stepper.Step label="Profile" data-testid="active" />
        </Stepper>,
      );
      const active = screen.getByTestId('active');
      const indicator = active.querySelector('[aria-hidden="true"]');
      expect(indicator).toHaveClass('bg-primary', 'text-primary-foreground');
      expect(indicator?.className).not.toMatch(/text-white/);
      expect(within(active).getByText('Profile')).toHaveClass('text-primary');
      expect(within(screen.getByTestId('done')).getByText('Account')).toHaveClass('text-success');
    });

    it('marks an error step with error tokens', () => {
      render(
        <Stepper defaultActiveStep={1}>
          <Stepper.Step label="Account" />
          <Stepper.Step label="Profile" error data-testid="error" />
        </Stepper>,
      );
      expect(within(screen.getByTestId('error')).getByText('Profile')).toHaveClass('text-error');
    });

    it('turns off color transitions for reduced motion', () => {
      render(
        <Stepper>
          <Stepper.Step label="Account" data-testid="step" />
          <Stepper.Step label="Profile" />
        </Stepper>,
      );
      const step = screen.getByTestId('step');
      const indicator = step.querySelector('[aria-hidden="true"]');
      expect(indicator).toHaveClass('transition-colors', 'motion-reduce:transition-none');
      expect(step.querySelector('[data-wave-stepper-connector]')).toHaveClass(
        'motion-reduce:transition-none',
      );
    });

    it('offsets the vertical connector with a logical margin in RTL (feedback-navigation#34)', () => {
      renderWithProviders(
        <Stepper orientation="vertical">
          <Stepper.Step label="Account" data-testid="step" />
          <Stepper.Step label="Profile" />
        </Stepper>,
        { dir: 'rtl' },
      );
      const connector = screen.getByTestId('step').querySelector('[data-wave-stepper-connector]');
      expect(connector).toHaveClass('ms-3.75');
      expect(connector?.className).not.toMatch(/\bml-/);
    });

    it('centres the vertical connector under the circle in the same unit as the circle (x-styling-3)', () => {
      render(
        <Stepper orientation="vertical">
          <Stepper.Step label="Account" data-testid="step" />
          <Stepper.Step label="Profile" />
        </Stepper>,
      );
      const step = screen.getByTestId('step');
      const circle = step.querySelector('[role="button"] > [aria-hidden="true"]');
      const connector = step.querySelector('[data-wave-stepper-connector]');
      // Circle size-8 and connector w-0.5 are spacing units (rem), so the offset (8 - 0.5) / 2 =
      // 3.75 units follows them at any root font size; a px offset only fits a 16px root.
      expect(circle).toHaveClass('size-8');
      expect(connector).toHaveClass('w-0.5', 'ms-3.75');
      expect(connector?.className).not.toMatch(/\d+px/);
    });

    it('keeps the connectors visible in forced-colors mode (x-styling-4)', () => {
      render(
        <Stepper defaultActiveStep={1}>
          <Stepper.Step label="Account" data-testid="done" />
          <Stepper.Step label="Profile" data-testid="active" />
          <Stepper.Step label="Review" />
        </Stepper>,
      );
      const connectorOf = (testId: string) =>
        screen.getByTestId(testId).querySelector('[data-wave-stepper-connector]');
      // Author backgrounds become Canvas in forced colors: the completed part is painted in
      // Highlight (forcedColors.fill), the rest in CanvasText, like a Slider rail.
      expect(connectorOf('done')).toHaveClass(
        'bg-success',
        'forced-colors:bg-[Highlight]',
        'forced-colors:forced-color-adjust-none',
      );
      expect(connectorOf('active')).toHaveClass(
        'bg-border',
        'forced-colors:bg-[CanvasText]',
        'forced-colors:forced-color-adjust-none',
      );
      expect(connectorOf('active')).not.toHaveClass('forced-colors:bg-[Highlight]');
    });
  });

  describe('icon slot (data-display#31)', () => {
    it('renders a custom icon element inside an aria-hidden span', () => {
      render(
        <Stepper>
          <Stepper.Step label="Account" icon={<span data-testid="custom-icon">*</span>} />
        </Stepper>,
      );
      const icon = screen.getByTestId('custom-icon');
      expect(icon.parentElement).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('1. Account');
    });

    it('accepts a slot object', () => {
      render(
        <Stepper>
          <Stepper.Step label="Account" icon={{ className: 'custom-slot', children: '★' }} />
        </Stepper>,
      );
      const icon = screen.getByText('★');
      expect(icon).toHaveClass('custom-slot');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('keeps the check mark for completed steps with no icon and the icon otherwise', () => {
      render(
        <Stepper defaultActiveStep={2}>
          <Stepper.Step label="Account" data-testid="plain" />
          <Stepper.Step label="Profile" data-testid="custom" icon={<span>*</span>} />
          <Stepper.Step label="Review" />
        </Stepper>,
      );
      expect(
        screen.getByTestId('plain').querySelector('svg[data-wave-icon="check"]'),
      ).not.toBeNull();
      expect(screen.getByTestId('custom').querySelector('svg[data-wave-icon="check"]')).toBeNull();
      expect(within(screen.getByTestId('custom')).getByText('*')).toBeInTheDocument();
    });

    // `icon={name && <Icon />}` with `name` '' or a count of 0, or a list mapped to nothing: no
    // icon, as in Menu, Nav, Tree and Avatar. A factory each, since a generator is one-shot.
    it.each([
      ["''", () => ''],
      ['0', () => 0],
      ['an empty array', () => []],
      ['an array of empty items', () => [null, false, '', [undefined]]],
      [
        'a generator of empty items',
        function* emptyItems() {
          yield null;
          yield '';
        },
      ],
    ] as Array<[string, () => Slot<'span'>]>)(
      'an icon that renders nothing (%s) keeps the check mark and the step number',
      (_name, makeIcon) => {
        render(
          <Stepper defaultActiveStep={1}>
            <Stepper.Step label="Account" data-testid="done" icon={makeIcon()} />
            <Stepper.Step label="Pay" data-testid="current" icon={makeIcon()} />
          </Stepper>,
        );
        expect(
          screen.getByTestId('done').querySelector('svg[data-wave-icon="check"]'),
        ).not.toBeNull();
        const current = screen.getByTestId('current');
        // The visible number (the name's "2." stays too), and no empty indicator box.
        expect(within(current).getByText('2')).toBeInTheDocument();
        expect(current.querySelector('span[aria-hidden="true"]:empty')).toBeNull();
      },
    );
  });

  it('the Localized story marks the language of its Norwegian labels (WCAG 3.1.2)', () => {
    const { Localized } = composeStories(stories);
    render(<Localized />);
    const group = screen.getByRole('group', { name: 'Fremdrift' });
    expect(group).toHaveAttribute('lang', 'nb');
    expect(within(group).getByRole('button', { name: 'Fullført: 1. Konto' })).toBeInTheDocument();
  });

  describe('Linear story (nav-other-code-4)', () => {
    const { Linear } = composeStories(stories);

    it('keeps focus on Back and Next at the boundaries they reach (C-DISABLED)', async () => {
      const user = userEvent.setup();
      render(<Linear />);
      const next = screen.getByRole('button', { name: 'Next' });
      const back = screen.getByRole('button', { name: 'Back' });
      expect(back).toHaveAttribute('aria-disabled', 'true');
      expect(back).not.toBeDisabled();

      next.focus();
      await user.keyboard('{Enter}{Enter}{Enter}');
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('4. Confirm');
      expect(next).toHaveFocus();
      expect(next).toHaveAttribute('aria-disabled', 'true');
      expect(next).not.toBeDisabled();
      // Activating the unavailable Next does nothing.
      await user.keyboard('{Enter}');
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('4. Confirm');

      back.focus();
      await user.keyboard('{Enter}{Enter}{Enter}{Enter}');
      expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName(
        '1. Personal Info',
      );
      expect(back).toHaveFocus();
      expect(back).toHaveAttribute('aria-disabled', 'true');
    });
  });

  it('renders all step labels and descriptions', () => {
    render(
      <Stepper>
        <Stepper.Step label="Account" description="Create your account" />
        <Stepper.Step label="Profile" />
      </Stepper>,
    );
    expect(screen.getByText('Account')).toBeVisible();
    expect(screen.getByText('Create your account')).toBeVisible();
    expect(screen.getByText('Profile')).toBeVisible();
  });
});
