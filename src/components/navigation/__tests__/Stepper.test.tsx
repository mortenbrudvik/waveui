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
import { stepperClassNames, stepperStepClassNames } from '../../../lib/classNames';
import {
  asClientReference,
  expectInertSlotProps,
  expectNoA11yViolations,
  openingTags,
  renderWithProviders,
  testClassName,
  testCompoundExposure,
  testDisplayName,
  testForwardRef,
  testRestSpread,
  testSystemProps,
  expectThrows,
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
    expectThrows(
      <Stepper.Step label="Orphan" />,
      '[WaveUI] Stepper.Step must be used within Stepper',
    );
  });

  describe('context guard in production (C-CONTEXT)', () => {
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

    describe('statusLabels (C-NAMING)', () => {
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

    it('numbers steps written in a Server Component (lazy client references) the same way (C-COMPOUND)', () => {
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

    it('stops the page from scrolling on Space keydown and activates only on keyup', () => {
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

    it('centres the vertical connector under the circle in the same unit as the circle', () => {
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

    it('keeps the connectors visible in forced-colors mode', () => {
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

  describe('Linear story', () => {
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

describe('Stepper and Stepper.Step — slotProps', () => {
  type StepperSlotProps = NonNullable<StepperProps['slotProps']>;
  type StepSlotProps = NonNullable<StepProps['slotProps']>;
  /** The parts of the stepper and of every step of {@link Steps}. */
  interface PartsSlotProps {
    root?: StepperSlotProps;
    step?: StepSlotProps;
  }
  const STEP_PARTS = [
    'listItem',
    'button',
    'indicator',
    'label',
    'description',
    'connector',
  ] as const;
  const EVERY_PART: PartsSlotProps = {
    root: { list: {} },
    step: { listItem: {}, button: {}, indicator: {}, label: {}, description: {}, connector: {} },
  };

  /**
   * Four steps: a completed one with a description, the active one, an error step that is the next
   * one (reachable in a linear stepper), and a disabled last step with an icon.
   */
  function Steps({ parts, ...props }: Partial<StepperProps> & { parts?: PartsSlotProps }) {
    return (
      <Stepper activeStep={1} linear slotProps={parts?.root} {...props}>
        <Stepper.Step label="Account" description="Your details" slotProps={parts?.step} />
        <Stepper.Step label="Profile" slotProps={parts?.step} />
        <Stepper.Step label="Review" error slotProps={parts?.step} />
        <Stepper.Step label="Done" disabled icon={<span>D</span>} slotProps={parts?.step} />
      </Stepper>
    );
  }
  const all = (root: ParentNode, cls: string) =>
    Array.from(root.querySelectorAll<HTMLElement>(`.${cls}`));
  /** Every part, in the order of the pins. */
  const partsOf = (root: ParentNode = document) => [
    ...all(root, stepperClassNames.list),
    ...STEP_PARTS.flatMap((name) => all(root, stepperStepClassNames[name])),
  ];

  // Captured from 414fe7d's dist (client and server agree).
  const ITEM = 'wave-stepper-step__list-item flex min-w-0';
  const BUTTON =
    'wave-stepper-step__button relative flex rounded flex-col items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
  const INDICATOR =
    'wave-stepper-step__indicator flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors motion-reduce:transition-none';
  const LABEL = 'wave-stepper-step__label font-semibold text-caption-1 whitespace-nowrap';
  const CONNECTOR =
    'wave-stepper-step__connector transition-colors motion-reduce:transition-none mx-2 h-0.5 flex-1';
  const BASE_PINS = [
    '<ol class="wave-stepper__list m-0 flex list-none p-0 flex-1 flex-row items-start" role="list">',
    `<li class="${ITEM} flex-1">`,
    `<li class="${ITEM} flex-1">`,
    `<li class="${ITEM} flex-1">`,
    `<li class="${ITEM}">`,
    `<div aria-describedby="wave-step-_id0_-description" aria-labelledby="wave-step-_id0_-label" class="${BUTTON} cursor-pointer" role="button" tabindex="0">`,
    `<div aria-current="step" aria-labelledby="wave-step-_id1_-label" class="${BUTTON} cursor-pointer" role="button" tabindex="0">`,
    `<div aria-labelledby="wave-step-_id2_-label" class="${BUTTON} cursor-pointer" role="button" tabindex="0">`,
    `<div aria-disabled="true" aria-labelledby="wave-step-_id3_-label" class="${BUTTON} cursor-default opacity-50" role="button" tabindex="-1">`,
    `<span aria-hidden="true" class="${INDICATOR} border-success bg-success-tint text-success-tint-foreground">`,
    `<span aria-hidden="true" class="${INDICATOR} border-primary bg-primary text-primary-foreground forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:forced-color-adjust-none">`,
    `<span aria-hidden="true" class="${INDICATOR} border-error bg-error-tint text-error-tint-foreground">`,
    `<span aria-hidden="true" class="${INDICATOR} border-border bg-background text-muted-foreground">`,
    `<span class="${LABEL} text-success" id="wave-step-_id0_-label">`,
    `<span class="${LABEL} text-primary" id="wave-step-_id1_-label">`,
    `<span class="${LABEL} text-error" id="wave-step-_id2_-label">`,
    `<span class="${LABEL} text-foreground" id="wave-step-_id3_-label">`,
    '<span class="wave-stepper-step__description text-muted-foreground text-caption-2 whitespace-nowrap" id="wave-step-_id0_-description">',
    `<div aria-hidden="true" class="${CONNECTOR} bg-success forced-colors:bg-[Highlight] forced-colors:forced-color-adjust-none" data-wave-stepper-connector="">`,
    `<div aria-hidden="true" class="${CONNECTOR} bg-border forced-colors:bg-[CanvasText] forced-colors:forced-color-adjust-none" data-wave-stepper-connector="">`,
    `<div aria-hidden="true" class="${CONNECTOR} bg-border forced-colors:bg-[CanvasText] forced-colors:forced-color-adjust-none" data-wave-stepper-connector="">`,
  ].join('\n');

  it('renders the parts of 414fe7d (attributes sorted), on the client and the server', () => {
    for (const parts of [undefined, EVERY_PART]) {
      const view = render(<Steps parts={parts} />);
      expect(openingTags(...partsOf())).toBe(BASE_PINS);
      view.unmount();
      const template = document.createElement('template');
      template.innerHTML = renderToString(<Steps parts={parts} />);
      expect(openingTags(...partsOf(template.content))).toBe(BASE_PINS);
    }
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    for (const props of [
      {},
      { orientation: 'vertical' as const, activeStep: 0 },
      { linear: false, activeStep: 3 },
    ]) {
      expectInertSlotProps(
        (parts: PartsSlotProps | undefined) => <Steps {...props} parts={parts} />,
        EVERY_PART,
      );
    }
  });

  it('puts your className, style and data-* on every part, after its stable class and own classes', () => {
    const mine = (name: string) => ({
      className: `my-${name}`,
      style: { opacity: 0.5 },
      'data-part': name,
    });
    render(
      <Steps
        parts={{
          root: { list: mine('list') },
          step: Object.fromEntries(STEP_PARTS.map((name) => [name, mine(name)])),
        }}
      />,
    );
    const elements: Array<[HTMLElement, string, string]> = [
      ...all(document, stepperClassNames.list).map((el): [HTMLElement, string, string] => [
        el,
        stepperClassNames.list,
        'list',
      ]),
      ...STEP_PARTS.flatMap((name) =>
        all(document, stepperStepClassNames[name]).map((el): [HTMLElement, string, string] => [
          el,
          stepperStepClassNames[name],
          name,
        ]),
      ),
    ];
    // The list, four list items, buttons, indicators and labels, one description, three connectors.
    expect(elements).toHaveLength(1 + 4 * 4 + 1 + 3);
    for (const [element, stable, name] of elements) {
      expect(element.classList[0]).toBe(stable);
      expect(element.classList[element.classList.length - 1]).toBe(`my-${name}`);
      expect(element).toHaveAttribute('data-part', name);
      expect(element).toHaveStyle({ opacity: '0.5' });
    }
    // The roots take none of it.
    expect(screen.getByRole('group', { name: 'Progress' })).not.toHaveClass('my-list');
    for (const root of all(document, stepperStepClassNames.root)) {
      expect(root).not.toHaveClass('my-listItem');
    }
  });

  it('lets your class replace a conflicting class of a part', () => {
    render(
      <Steps
        parts={{
          root: { list: { className: 'p-2' } },
          step: {
            listItem: { className: 'min-w-8' },
            button: { className: 'rounded-md' },
            indicator: { className: 'size-6' },
            label: { className: 'font-bold' },
            description: { className: 'text-foreground' },
            connector: { className: 'h-1' },
          },
        }}
      />,
    );
    const first = (name: (typeof STEP_PARTS)[number]) =>
      all(document, stepperStepClassNames[name])[0];
    expect(all(document, stepperClassNames.list)[0]).not.toHaveClass('p-0');
    expect(first('listItem')).not.toHaveClass('min-w-0');
    expect(first('button')).not.toHaveClass('rounded');
    expect(first('indicator')).not.toHaveClass('size-8');
    expect(first('label')).not.toHaveClass('font-semibold');
    expect(first('description')).not.toHaveClass('text-muted-foreground');
    expect(first('connector')).not.toHaveClass('h-0.5');
  });

  it('attaches your refs to the parts', () => {
    const list = React.createRef<HTMLOListElement>();
    const step = {
      listItem: React.createRef<HTMLLIElement>(),
      button: React.createRef<HTMLDivElement>(),
      indicator: React.createRef<HTMLSpanElement>(),
      label: React.createRef<HTMLSpanElement>(),
      description: React.createRef<HTMLSpanElement>(),
      connector: React.createRef<HTMLDivElement>(),
    };
    render(
      <Stepper slotProps={{ list: { ref: list } }}>
        <Stepper.Step
          label="Account"
          description="Your details"
          slotProps={Object.fromEntries(Object.entries(step).map(([name, ref]) => [name, { ref }]))}
        />
        <Stepper.Step label="Profile" />
      </Stepper>,
    );
    expect(list.current).toBe(all(document, stepperClassNames.list)[0]);
    for (const [name, ref] of Object.entries(step)) {
      expect(ref.current).toBe(all(document, stepperStepClassNames[name as keyof typeof step])[0]);
    }
  });

  it('keeps the stepper watching its list with your ref on it: a reorder of reused steps renumbers them', async () => {
    const alphaBeta = () => [
      <Stepper.Step key="alpha" label="Alpha" />,
      <Stepper.Step key="beta" label="Beta" />,
    ];
    function ReorderingSteps({ ref }: { ref: React.Ref<() => void> }) {
      const [reversed, setReversed] = React.useState(false);
      React.useImperativeHandle(ref, () => () => setReversed((r) => !r), []);
      // The same elements: React moves the list items without re-rendering either step.
      const [[alpha, beta]] = React.useState(alphaBeta);
      return reversed ? [beta, alpha] : [alpha, beta];
    }
    const flip = React.createRef<() => void>();
    const seen: Array<HTMLOListElement | null> = [];
    function Inline({ tick }: { tick: number }) {
      return (
        <Stepper
          data-tick={tick}
          slotProps={{ list: { ref: (node: HTMLOListElement | null) => void seen.push(node) } }}
        >
          <ReorderingSteps ref={flip} />
          <Stepper.Step label="Gamma" />
        </Stepper>
      );
    }
    const { rerender } = render(<Inline tick={0} />);
    rerender(<Inline tick={1} />);
    expect(seen.at(-1)).toBe(all(document, stepperClassNames.list)[0]);
    await act(async () => flip.current?.());
    const [beta, alpha, gamma] = stepButtons();
    expect(beta).toHaveAccessibleName('1. Beta');
    expect(alpha).toHaveAccessibleName('2. Alpha');
    expect(gamma).toHaveAccessibleName('3. Gamma');
  });

  it('keeps each step registered with your list item ref on it: a wrapper’s steps are numbered', () => {
    const seen: Array<HTMLLIElement | null> = [];
    const parts = {
      listItem: { ref: (node: HTMLLIElement | null) => void seen.push(node) },
    };
    function TwoSteps({ tick }: { tick: number }) {
      return (
        <>
          <Stepper.Step label="Shipping" data-tick={tick} slotProps={parts} />
          <Stepper.Step label="Payment" slotProps={parts} />
        </>
      );
    }
    function Checkout({ tick }: { tick: number }) {
      return (
        <Stepper>
          <TwoSteps tick={tick} />
          <Stepper.Step label="Confirm" slotProps={{ listItem: { ref: () => {} } }} />
        </Stepper>
      );
    }
    const { rerender } = render(<Checkout tick={0} />);
    rerender(<Checkout tick={1} />);
    expect(stepButton('Shipping')).toHaveAccessibleName('1. Shipping');
    expect(stepButton('Payment')).toHaveAccessibleName('2. Payment');
    expect(stepButton('Confirm')).toHaveAccessibleName('3. Confirm');
    expect(seen).toContain(all(document, stepperStepClassNames.listItem)[0]);
  });

  it('locks the list’s and the list items’ role and hidden state', () => {
    const attempt = { role: 'menu', hidden: true, inert: true, 'aria-hidden': true };
    render(<Steps parts={{ root: { list: attempt }, step: { listItem: attempt } }} />);
    expect(screen.getByRole('list')).toBe(all(document, stepperClassNames.list)[0]);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    for (const element of [
      ...all(document, stepperClassNames.list),
      ...all(document, stepperStepClassNames.listItem),
    ]) {
      for (const name of ['hidden', 'inert', 'aria-hidden']) {
        expect(element).not.toHaveAttribute(name);
      }
    }
    expect(all(document, stepperStepClassNames.listItem)[0]).not.toHaveAttribute('role');
  });

  it('locks the button’s role, tab stop, state, name and description, and its hidden state', () => {
    const attempt = {
      role: 'link',
      tabIndex: 0,
      'aria-current': 'step',
      'aria-disabled': true,
      'aria-labelledby': 'mine',
      'aria-describedby': 'mine',
      hidden: true,
      inert: true,
      'aria-hidden': true,
    } as unknown as StepSlotProps['button'];
    render(
      <>
        <span id="mine">Mine</span>
        <Steps parts={{ step: { button: attempt } }} />
      </>,
    );
    const [account, profile, review, done] = stepButtons();
    // Yours is joined after the step's name and description.
    expect(account).toHaveAccessibleName('Completed: 1. Account Mine');
    expect(account).toHaveAccessibleDescription('Your details Mine');
    expect(review).toHaveAccessibleDescription('Mine');
    // Only the active step is current, and only the unreachable step unavailable (state-off).
    expect(profile).toHaveAttribute('aria-current', 'step');
    for (const button of [account, review, done])
      expect(button).not.toHaveAttribute('aria-current');
    expect(done).toHaveAttribute('aria-disabled', 'true');
    expect(done).toHaveAttribute('tabindex', '-1');
    for (const button of [account, profile, review]) {
      expect(button).not.toHaveAttribute('aria-disabled');
      expect(button).toHaveAttribute('tabindex', '0');
    }
    for (const button of [account, profile, review, done]) {
      expect(button).toHaveAttribute('role', 'button');
      for (const name of ['hidden', 'inert', 'aria-hidden']) {
        expect(button).not.toHaveAttribute(name);
      }
    }
  });

  it('locks the label’s and the description’s ids, names and hidden state', () => {
    const attempt = {
      id: 'mine',
      'aria-label': 'Mine',
      hidden: true,
      inert: true,
      'aria-hidden': true,
    } as unknown as StepSlotProps['label'];
    render(<Steps parts={{ step: { label: attempt, description: attempt } }} />);
    const [account] = stepButtons();
    expect(account).toHaveAccessibleName('Completed: 1. Account');
    expect(account).toHaveAccessibleDescription('Your details');
    expect(document.getElementById('mine')).toBeNull();
    for (const element of [
      ...all(document, stepperStepClassNames.label),
      ...all(document, stepperStepClassNames.description),
    ]) {
      for (const name of ['aria-label', 'hidden', 'inert', 'aria-hidden']) {
        expect(element).not.toHaveAttribute(name);
      }
    }
  });

  it('keeps the indicators and connectors decorative', () => {
    const attempt = { 'aria-hidden': false, tabIndex: 0, 'data-wave-stepper-connector': 'mine' };
    render(<Steps parts={{ step: { indicator: attempt, connector: attempt } }} />);
    for (const element of [
      ...all(document, stepperStepClassNames.indicator),
      ...all(document, stepperStepClassNames.connector),
    ]) {
      expect(element).toHaveAttribute('aria-hidden', 'true');
      expect(element).not.toHaveAttribute('tabindex');
    }
    expect(document.querySelectorAll('[data-wave-stepper-connector=""]')).toHaveLength(3);
  });

  it('runs your button handlers first: preventDefault() skips the step’s own onClick and the step change', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    const onClick = vi.fn();
    const prevent = (event: React.SyntheticEvent) => event.preventDefault();
    render(
      <Stepper onStepChange={onStepChange}>
        <Stepper.Step label="Account" />
        <Stepper.Step
          label="Profile"
          onClick={onClick}
          slotProps={{ button: { onClick: prevent, onKeyDown: prevent, onKeyUp: prevent } }}
        />
      </Stepper>,
    );
    const profile = stepButton('Profile');
    await user.click(profile);
    act(() => profile.focus());
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).not.toHaveBeenCalled();
    expect(onStepChange).not.toHaveBeenCalled();
    expect(stepButton('Account')).toHaveAttribute('aria-current', 'step');
  });

  it('runs a button handler that prevents nothing before the step’s own onClick', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    render(
      <Stepper onStepChange={(step) => void order.push(`change:${step}`)}>
        <Stepper.Step label="Account" />
        <Stepper.Step
          label="Profile"
          onClick={() => void order.push('step')}
          slotProps={{ button: { onClick: () => void order.push('part') } }}
        />
      </Stepper>,
    );
    await user.click(stepButton('Profile'));
    expect(order).toEqual(['part', 'step', 'change:1']);
  });

  it('keeps the active step on a click prevented in a part inside the button, its own onClick still called', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    const onClick = vi.fn();
    render(
      <Stepper onStepChange={onStepChange}>
        <Stepper.Step label="Account" />
        <Stepper.Step
          label="Profile"
          onClick={onClick}
          slotProps={{ label: { onClick: (event) => event.preventDefault() } }}
        />
      </Stepper>,
    );
    await user.click(screen.getByText('Profile'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onStepChange).not.toHaveBeenCalled();
    expect(stepButton('Account')).toHaveAttribute('aria-current', 'step');
  });

  it('calls no click handler of the button or the parts inside it while the step cannot be activated', async () => {
    const user = userEvent.setup();
    const handlers = {
      button: vi.fn(),
      indicator: vi.fn(),
      label: vi.fn(),
      description: vi.fn(),
      connector: vi.fn(),
      listItem: vi.fn(),
    };
    const parts = Object.fromEntries(
      Object.entries(handlers).map(([name, onClick]) => [name, { onClick }]),
    );
    const { rerender } = render(
      <Stepper linear>
        <Stepper.Step label="Account" />
        <Stepper.Step label="Profile" />
        <Stepper.Step label="Review" description="Check it" slotProps={parts} />
        <Stepper.Step label="Done" />
      </Stepper>,
    );
    // Two past the active step of a linear stepper: unreachable.
    const review = stepButton('Review');
    for (const target of [
      review,
      ...['indicator', 'label', 'description'].map(
        (name) => review.querySelector(`.${stepperStepClassNames[name as 'label']}`) as HTMLElement,
      ),
    ]) {
      await user.click(target);
    }
    for (const name of ['button', 'indicator', 'label', 'description'] as const) {
      expect(handlers[name]).not.toHaveBeenCalled();
    }
    // The connector and the list item are outside the button: not blocked.
    fireEvent.click(all(document, stepperStepClassNames.connector)[2]);
    expect(handlers.connector).toHaveBeenCalledTimes(1);
    expect(handlers.listItem).toHaveBeenCalled();
    // Reachable again: each is called.
    rerender(
      <Stepper>
        <Stepper.Step label="Account" />
        <Stepper.Step label="Profile" />
        <Stepper.Step label="Review" description="Check it" slotProps={parts} />
        <Stepper.Step label="Done" />
      </Stepper>,
    );
    await user.click(screen.getByText('Check it'));
    expect(handlers.description).toHaveBeenCalledTimes(1);
    expect(handlers.button).toHaveBeenCalledTimes(1);
  });

  it('calls no click handler of the button of a disabled step', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Stepper>
        <Stepper.Step label="Account" />
        <Stepper.Step label="Profile" disabled slotProps={{ button: { onClick } }} />
      </Stepper>,
    );
    await user.click(stepButton('Profile'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('calls each part handler once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    const handlers = { list: vi.fn(), listItem: vi.fn(), button: vi.fn(), label: vi.fn() };
    render(
      <React.StrictMode>
        <Stepper onStepChange={onStepChange} slotProps={{ list: { onClick: handlers.list } }}>
          <Stepper.Step label="Account" />
          <Stepper.Step
            label="Profile"
            slotProps={{
              listItem: { onClick: handlers.listItem },
              button: { onClick: handlers.button },
              label: { onClick: handlers.label },
            }}
          />
        </Stepper>
      </React.StrictMode>,
    );
    await user.click(screen.getByText('Profile'));
    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalledTimes(1);
    expect(onStepChange).toHaveBeenCalledTimes(1);
  });

  it('ignores the parts a step does not render', () => {
    render(
      <Stepper>
        <Stepper.Step
          label="Only"
          slotProps={{
            description: { className: 'my-description' },
            connector: { className: 'my-connector' },
          }}
        />
      </Stepper>,
    );
    expect(document.querySelector('.my-description')).toBeNull();
    expect(document.querySelector('.my-connector')).toBeNull();
    expect(stepButton('Only')).toHaveAccessibleName('1. Only');
  });

  it('applies the parts in RTL', () => {
    renderWithProviders(
      <Steps
        orientation="vertical"
        activeStep={0}
        parts={{ step: { connector: { className: 'my-connector' }, label: { dir: 'ltr' } } }}
      />,
      { dir: 'rtl' },
    );
    const [connector] = all(document, stepperStepClassNames.connector);
    expect(connector).toHaveClass('my-connector', 'ms-3.75');
    expect(all(document, stepperStepClassNames.label)[0]).toHaveAttribute('dir', 'ltr');
  });

  it('has no accessibility violations with every part customised', async () => {
    const mine = (name: string) => ({ className: `my-${name}`, title: name });
    render(
      <Steps
        parts={{
          root: { list: mine('list') },
          step: Object.fromEntries(STEP_PARTS.map((name) => [name, mine(name)])),
        }}
      />,
    );
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof StepperSlotProps>().toEqualTypeOf<'list'>();
    expectTypeOf<keyof StepSlotProps>().toEqualTypeOf<(typeof STEP_PARTS)[number]>();
    expectTypeOf<NonNullable<StepperSlotProps['list']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLOListElement> | undefined
    >();
    expectTypeOf<NonNullable<StepSlotProps['listItem']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLLIElement> | undefined
    >();
    expectTypeOf<NonNullable<StepSlotProps['button']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<StepSlotProps['label']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    void (
      (
        // @ts-expect-error -- a part takes no children: the steps are yours
        <Stepper slotProps={{ list: { children: 'x' } }}>{null}</Stepper>
      )
    );
    void (
      (
        // @ts-expect-error -- a part takes no children: the step renders them
        <Stepper.Step label="A" slotProps={{ label: { children: 'x' } }} />
      )
    );
  });
});
