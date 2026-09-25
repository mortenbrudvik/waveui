import * as React from 'react';
import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup, RadioGroupItem, RadioItem } from '../RadioGroup';
import type { RadioGroupItemProps, RadioGroupProps, RadioItemProps } from '../RadioGroup';
import type { Orientation } from '../../../lib/types';
import {
  expectNoA11yViolations,
  renderWithProviders,
  testComposedHandler,
  testCompoundExposure,
  testDisplayName,
  testNoImplicitSubmit,
  testSystemProps,
  expectThrows,
} from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_IDS, FIELD_TEST_TEXT } from '../../../test-utils-field';

const twoItems = [
  <RadioItem key="a" value="a" label="Alpha" />,
  <RadioItem key="b" value="b" label="Beta" />,
];

function radio(name: string): HTMLElement {
  return screen.getByRole('radio', { name });
}

/** The development warning of a radio item with children. */
const CHILDREN_WARNING =
  '[WaveUI] RadioItem: children are not rendered. Pass the label in `label`.';

const ONCHANGE_DEPRECATION =
  '[WaveUI] RadioGroup: `onChange` is deprecated and will be removed in 1.0. Use `onValueChange` instead.';

describe('RadioGroup', () => {
  testSystemProps(RadioGroup, {
    expectedTag: 'div',
    displayName: 'RadioGroup',
    defaultProps: { 'aria-label': 'Test group', children: twoItems },
    a11yVariants: [
      { name: 'selected value', props: { defaultValue: 'b' } },
      {
        name: 'disabled item',
        props: {
          defaultValue: 'b',
          children: [
            <RadioItem key="a" value="a" label="Alpha" disabled />,
            <RadioItem key="b" value="b" label="Beta" />,
          ],
        },
      },
      { name: 'disabled group', props: { disabled: true, defaultValue: 'a' } },
      { name: 'horizontal', props: { orientation: 'horizontal' } },
      { name: 'required with a name', props: { name: 'fruit', required: true } },
    ],
  });

  testCompoundExposure(RadioGroup, ['Item']);

  testNoImplicitSubmit(RadioGroup, {
    defaultProps: { 'aria-label': 'Options', children: twoItems },
  });

  testComposedHandler(RadioGroup, {
    handler: 'onKeyDown',
    defaultProps: { 'aria-label': 'Options', defaultValue: 'a', children: twoItems },
    act: async ({ user }) => {
      act(() => radio('Alpha').focus());
      await user.keyboard('{ArrowDown}');
    },
    assertInternal: () => {
      expect(radio('Beta')).toHaveFocus();
      expect(radio('Beta')).toHaveAttribute('aria-checked', 'true');
    },
    assertInternalSuppressed: () => {
      expect(radio('Alpha')).toHaveFocus();
      expect(radio('Alpha')).toHaveAttribute('aria-checked', 'true');
    },
  });

  it('exports the item under the flat names RadioGroupItem and RadioItem (C-COMPOUND)', () => {
    expect(RadioGroupItem).toBe(RadioGroup.Item);
    expect(RadioItem).toBe(RadioGroup.Item);
  });

  it('renders named radios inside a named radiogroup', () => {
    render(<RadioGroup aria-label="Options">{twoItems}</RadioGroup>);
    const group = screen.getByRole('radiogroup', { name: 'Options' });
    expect(group).toContainElement(radio('Alpha'));
    expect(group).toContainElement(radio('Beta'));
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('works with the dotted RadioGroup.Item form', async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup aria-label="Options">
        <RadioGroup.Item value="a" label="Alpha" />
        <RadioGroup.Item value="b" label="Beta" />
      </RadioGroup>,
    );
    await user.click(radio('Beta'));
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'true');
  });

  it('selects defaultValue', () => {
    render(
      <RadioGroup defaultValue="b" aria-label="Options">
        {twoItems}
      </RadioGroup>,
    );
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'false');
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'true');
  });

  it('selects item in uncontrolled mode', async () => {
    const user = userEvent.setup();
    render(<RadioGroup aria-label="Options">{twoItems}</RadioGroup>);
    await user.click(radio('Beta'));
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onValueChange when the selection changes, not when re-selecting', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup onValueChange={onValueChange} aria-label="Options">
        {twoItems}
      </RadioGroup>,
    );
    await user.click(radio('Beta'));
    await user.click(radio('Beta'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('fires onValueChange exactly once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <RadioGroup onValueChange={onValueChange} aria-label="Options">
          {twoItems}
        </RadioGroup>
      </React.StrictMode>,
    );
    await user.click(radio('Beta'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('keeps the deprecated onChange alias working and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onValueChange = vi.fn();
      const { rerender } = render(
        <RadioGroup onChange={onChange} onValueChange={onValueChange} aria-label="Options">
          {twoItems}
        </RadioGroup>,
      );
      rerender(
        <RadioGroup onChange={onChange} onValueChange={onValueChange} aria-label="Options">
          {twoItems}
        </RadioGroup>,
      );
      await user.click(radio('Beta'));
      expect(onChange).toHaveBeenCalledWith('b');
      expect(onValueChange).toHaveBeenCalledWith('b');
      expect(warn.mock.calls).toEqual([[ONCHANGE_DEPRECATION]]);
    } finally {
      warn.mockRestore();
    }
  });

  it('the deprecated onChange alias is change-only like onValueChange: re-selecting calls neither', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onValueChange = vi.fn();
      render(
        <RadioGroup
          defaultValue="a"
          onChange={onChange}
          onValueChange={onValueChange}
          aria-label="Options"
        >
          {twoItems}
        </RadioGroup>,
      );
      await user.click(radio('Alpha'));
      expect(onChange).not.toHaveBeenCalled();
      expect(onValueChange).not.toHaveBeenCalled();
      await user.click(radio('Beta'));
      expect(onChange.mock.calls).toEqual([['b']]);
      expect(onValueChange.mock.calls).toEqual([['b']]);
      // A keyboard selection that changes the value fires both.
      await user.keyboard('{ArrowUp}');
      expect(onChange.mock.calls).toEqual([['b'], ['a']]);
      expect(onValueChange.mock.calls).toEqual([['b'], ['a']]);
      expect(warn.mock.calls).toEqual([[ONCHANGE_DEPRECATION]]);
    } finally {
      warn.mockRestore();
    }
  });

  it('the deprecated onChange alias matches onValueChange in a controlled group (rejected values retry)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onValueChange = vi.fn();
      // The parent never accepts a change, so the value stays "a".
      render(
        <RadioGroup
          value="a"
          onChange={onChange}
          onValueChange={onValueChange}
          aria-label="Options"
        >
          {twoItems}
        </RadioGroup>,
      );
      // Re-selecting the controlled value is a no-op for both callbacks.
      await user.click(radio('Alpha'));
      expect(onChange).not.toHaveBeenCalled();
      expect(onValueChange).not.toHaveBeenCalled();
      // ArrowDown moves focus to Beta and requests "b"; ArrowUp returns to the selected Alpha
      // (no change); ArrowDown requests the rejected "b" again, which fires again.
      await user.keyboard('{ArrowDown}');
      expect(radio('Beta')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(radio('Alpha')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(onChange.mock.calls).toEqual([['b'], ['b']]);
      expect(onValueChange.mock.calls).toEqual([['b'], ['b']]);
      expect(warn.mock.calls).toEqual([[ONCHANGE_DEPRECATION]]);
    } finally {
      warn.mockRestore();
    }
  });

  it('respects controlled value prop', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup value="a" onValueChange={onValueChange} aria-label="Options">
        {twoItems}
      </RadioGroup>,
    );
    await user.click(radio('Beta'));
    // Controlled: value stays as "a"
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'false');
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('renders vertical orientation by default', () => {
    render(
      <RadioGroup aria-label="Options">
        <RadioItem value="a" label="Alpha" />
      </RadioGroup>,
    );
    const group = screen.getByRole('radiogroup', { name: 'Options' });
    expect(group).toHaveClass('flex-col');
    expect(group).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('renders horizontal orientation', () => {
    render(
      <RadioGroup orientation="horizontal" aria-label="Options">
        <RadioItem value="a" label="Alpha" />
      </RadioGroup>,
    );
    const group = screen.getByRole('radiogroup', { name: 'Options' });
    expect(group).toHaveClass('flex-row');
    expect(group).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('disables individual RadioItem', () => {
    render(
      <RadioGroup aria-label="Options">
        <RadioItem value="a" label="Alpha" disabled />
        <RadioItem value="b" label="Beta" />
      </RadioGroup>,
    );
    expect(radio('Alpha')).toBeDisabled();
    expect(radio('Beta')).not.toBeDisabled();
  });

  it('disables every item with the group-level disabled prop', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup aria-label="Options" disabled onValueChange={onValueChange}>
        {twoItems}
      </RadioGroup>,
    );
    expect(screen.getByRole('radiogroup', { name: 'Options' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(radio('Alpha')).toBeDisabled();
    expect(radio('Beta')).toBeDisabled();
    await user.click(radio('Beta'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('throws when RadioItem is used outside RadioGroup', () => {
    expectThrows(
      <RadioItem value="a" label="Orphan" />,
      '[WaveUI] RadioItem must be used within a RadioGroup',
    );
  });

  describe('in production (C-CONTEXT)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('logs a RadioItem outside a RadioGroup once and renders it inert', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const { rerender } = render(
          <>
            <RadioItem value="a" label="Orphan" />
            <RadioItem value="b" label="Stray" />
          </>,
        );
        rerender(
          <>
            <RadioItem value="a" label="Orphan" />
            <RadioItem value="b" label="Stray" />
          </>,
        );
        expect(error.mock.calls).toEqual([['[WaveUI] RadioItem must be used within a RadioGroup']]);
        expect(radio('Orphan')).toHaveAttribute('aria-checked', 'false');
        expect(radio('Orphan')).toHaveAttribute('tabindex', '-1');
      } finally {
        error.mockRestore();
      }
    });
  });

  describe('duplicate item values (C-DEV)', () => {
    it('warns once per value that several items share', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const ui = (
          <RadioGroup aria-label="Options">
            <RadioItem value="a" label="Alpha" />
            <div>
              <RadioItem value="a" label="Alpha again" />
            </div>
            <RadioItem value="b" label="Beta" />
            <RadioItem value="b" label="Beta again" />
            <RadioItem value="b" label="Beta once more" />
            <RadioItem value="c" label="Charlie" />
          </RadioGroup>
        );
        const { rerender } = render(ui);
        rerender(ui);
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] RadioGroup: several items share the value "a". Item values must be unique ' +
              'within a RadioGroup; items that share a value are checked together.',
          ],
          [
            '[WaveUI] RadioGroup: several items share the value "b". Item values must be unique ' +
              'within a RadioGroup; items that share a value are checked together.',
          ],
        ]);
      } finally {
        warn.mockRestore();
      }
    });

    it('still finds its own items when the consumer overrides the role', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(
          <RadioGroup aria-label="Options" role="group">
            <RadioItem value="a" label="Alpha" />
            <RadioItem value="a" label="Alpha again" />
          </RadioGroup>,
        );
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] RadioGroup: several items share the value "a". Item values must be unique ' +
              'within a RadioGroup; items that share a value are checked together.',
          ],
        ]);
      } finally {
        warn.mockRestore();
      }
    });

    it('does not count the items of a nested group as its own', async () => {
      const warn = vi.spyOn(console, 'warn');
      try {
        render(
          <RadioGroup aria-label="Outer">
            <RadioItem value="a" label="Alpha" />
            <RadioGroup aria-label="Inner">
              <RadioItem value="a" label="Inner alpha" />
            </RadioGroup>
          </RadioGroup>,
        );
        // The roving tab stops settle after the nested group registers its items.
        await act(async () => {});
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it('does not warn for unique values, including the same value in two separate groups', () => {
      const warn = vi.spyOn(console, 'warn');
      try {
        render(
          <>
            <RadioGroup aria-label="Size">{twoItems}</RadioGroup>
            <RadioGroup aria-label="Colour">{twoItems}</RadioGroup>
          </>,
        );
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });
  });

  it('keeps the same context value across unrelated re-renders (memoized provider)', () => {
    const onRender = vi.fn();
    const MemoItem = React.memo(function MemoItem() {
      return (
        <React.Profiler id="item" onRender={onRender}>
          <RadioItem value="a" label="Alpha" />
        </React.Profiler>
      );
    });
    function Parent({ tick }: { tick: number }) {
      return (
        <RadioGroup aria-label="Options" data-tick={tick}>
          <MemoItem />
        </RadioGroup>
      );
    }
    const { rerender } = render(<Parent tick={0} />);
    const before = onRender.mock.calls.length;
    rerender(<Parent tick={1} />);
    rerender(<Parent tick={2} />);
    expect(onRender.mock.calls.length).toBe(before);
  });

  // Guard test (overlays#35): the merged ref must stay stable across re-renders. It already passed
  // before RadioGroup moved to useMergedRefs and protects against reintroducing an inline merge.
  it('attaches a stable ref once, not on every render (useMergedRefs)', () => {
    const ref = vi.fn();
    const { rerender } = render(
      <RadioGroup ref={ref} aria-label="Options">
        {twoItems}
      </RadioGroup>,
    );
    rerender(
      <RadioGroup ref={ref} aria-label="Options" defaultValue="b">
        {twoItems}
      </RadioGroup>,
    );
    rerender(
      <RadioGroup ref={ref} aria-label="Renamed">
        {twoItems}
      </RadioGroup>,
    );
    expect(ref).toHaveBeenCalledTimes(1);
    expect(ref).toHaveBeenCalledWith(screen.getByRole('radiogroup'));
  });
});

describe('RadioItem', () => {
  testDisplayName(RadioItem, 'RadioItem');

  it('forwards ref to the role="radio" button', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(
      <RadioGroup aria-label="Options">
        <RadioItem ref={ref} value="a" label="Alpha" />
      </RadioGroup>,
    );
    expect(ref.current).toBe(radio('Alpha'));
  });

  it('spreads native button props onto the radio; className stays on the label', () => {
    render(
      <RadioGroup aria-label="Options">
        <p id="alpha-desc">The first letter</p>
        <RadioItem
          value="a"
          label="Alpha"
          id="alpha"
          aria-describedby="alpha-desc"
          data-testid="alpha-radio"
          className="custom-label"
          labelClassName="custom-text"
        />
      </RadioGroup>,
    );
    const button = radio('Alpha');
    expect(screen.getByTestId('alpha-radio')).toBe(button);
    expect(button).toHaveAttribute('id', 'alpha');
    expect(button).toHaveAccessibleDescription('The first letter');
    expect(button.closest('label')).toHaveClass('custom-label');
    expect(screen.getByText('Alpha')).toHaveClass('custom-text');
  });

  it('can be named with aria-label when it has no visible label', () => {
    render(
      <RadioGroup aria-label="Options">
        <RadioItem value="a" aria-label="Alpha" />
      </RadioGroup>,
    );
    const button = screen.getByRole('radio');
    expect(button).toHaveAccessibleName('Alpha');
    // No visible label text is rendered: the name comes from aria-label alone.
    expect(button.closest('label')).toHaveTextContent('');
    expect(screen.queryByText('Alpha')).toBeNull();
  });

  it('composes a consumer onClick with selection; preventDefault() suppresses it', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const blocked = vi.fn((e: React.MouseEvent) => e.preventDefault());
    render(
      <RadioGroup aria-label="Options">
        <RadioItem value="a" label="Alpha" onClick={onClick} />
        <RadioItem value="b" label="Beta" onClick={blocked} />
      </RadioGroup>,
    );
    await user.click(radio('Alpha'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'true');
    await user.click(radio('Beta'));
    expect(blocked).toHaveBeenCalledTimes(1);
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'false');
  });

  it('selects the item when its label text is clicked; a consumer onClick runs once', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onValueChange = vi.fn();
    render(
      <RadioGroup aria-label="Options" onValueChange={onValueChange}>
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" onClick={onClick} />
      </RadioGroup>,
    );
    await user.click(screen.getByText('Beta'));
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'true');
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls).toEqual([['b']]);
  });

  it('draws the unchecked circle with the accessible stroke and the checked dot as a forced-colors leaf', () => {
    render(
      <RadioGroup aria-label="Options" defaultValue="b">
        {twoItems}
      </RadioGroup>,
    );
    expect(radio('Alpha')).toHaveClass(
      'border-stroke-accessible',
      'forced-colors:border-[ButtonText]',
    );
    expect(radio('Alpha')).not.toHaveClass('border-input');
    expect(radio('Beta')).toHaveClass('border-primary', 'forced-colors:border-[Highlight]');
    const dot = radio('Beta').querySelector('span');
    expect(dot).toHaveClass(
      'bg-primary',
      'forced-colors:bg-[Highlight]',
      'forced-colors:forced-color-adjust-none',
    );
    expect(radio('Alpha')).toHaveClass('motion-reduce:transition-none');
  });

  it('sets its own zero padding and transparent circle, so app button styles cannot shift or fill it (C-NATIVE)', () => {
    render(
      <RadioGroup aria-label="Options" defaultValue="b">
        {twoItems}
      </RadioGroup>,
    );
    for (const name of ['Alpha', 'Beta']) {
      expect(radio(name)).toHaveClass('p-0', 'bg-transparent');
    }
  });

  it('draws the label text on the px type ramp like Field and Label (text-body-1)', () => {
    render(
      <RadioGroup aria-label="Options">
        <RadioItem value="a" label="Alpha" labelClassName="italic" />
      </RadioGroup>,
    );
    expect(screen.getByText('Alpha')).toHaveClass('text-body-1', 'italic');
    expect(screen.getByText('Alpha')).not.toHaveClass('text-sm');
  });

  it('forced colors: the radio circle keeps system colors; only the dot opts out (leaf)', () => {
    render(
      <RadioGroup aria-label="Options" defaultValue="b">
        {twoItems}
      </RadioGroup>,
    );
    expect(radio('Beta')).not.toHaveClass('forced-colors:forced-color-adjust-none');
  });

  it('forced colors: a disabled selected radio draws a GrayText dot and circle, no Highlight', () => {
    render(
      <RadioGroup aria-label="Options" defaultValue="b" disabled>
        {twoItems}
      </RadioGroup>,
    );
    expect(radio('Beta')).toHaveClass('forced-colors:border-[GrayText]');
    expect(radio('Beta')).not.toHaveClass('forced-colors:border-[Highlight]');
    const dot = radio('Beta').querySelector('span');
    expect(dot).toHaveClass(
      'forced-colors:bg-[GrayText]',
      'forced-colors:forced-color-adjust-none',
    );
    expect(dot).not.toHaveClass('forced-colors:bg-[Highlight]');
    // An unselected disabled radio draws a GrayText circle (not ButtonText).
    expect(radio('Alpha')).toHaveClass('forced-colors:border-[GrayText]');
    expect(radio('Alpha')).not.toHaveClass('forced-colors:border-[ButtonText]');
  });
});

// axe exempts the dimmed label text of a disabled radio only when that radio references the text
// through aria-labelledby: its <label> exemption covers native inputs, not a role="radio" button.
// The reference does not depend on the disabled state, and the name stays the same.
describe('RadioItem — the label text names the radio through aria-labelledby', () => {
  function expectNamedByLabelText(name: string) {
    const button = radio(name);
    const text = screen.getByText(name);
    expect(text.id).not.toBe('');
    expect(button).toHaveAttribute('aria-labelledby', text.id);
    expect(button).toHaveAccessibleName(name);
  }

  it('references the label text of enabled and disabled items', () => {
    render(
      <RadioGroup aria-label="Plan">
        <RadioItem value="free" label="Free" disabled />
        <RadioItem value="pro" label="Pro" />
      </RadioGroup>,
    );
    expectNamedByLabelText('Free');
    expectNamedByLabelText('Pro');
    expect(screen.getByText('Free').id).not.toBe(screen.getByText('Pro').id);
  });

  it('references the label text of every item of a disabled group', () => {
    render(
      <RadioGroup aria-label="Options" defaultValue="a" disabled>
        {twoItems}
      </RadioGroup>,
    );
    expect(screen.getByRole('radiogroup', { name: 'Options' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expectNamedByLabelText('Alpha');
    expectNamedByLabelText('Beta');
  });

  it('adds no aria-labelledby without label text (aria-label names it)', () => {
    render(
      <RadioGroup aria-label="Options">
        <RadioItem value="a" aria-label="Alpha" disabled />
      </RadioGroup>,
    );
    const button = screen.getByRole('radio');
    expect(button).not.toHaveAttribute('aria-labelledby');
    expect(button).toHaveAccessibleName('Alpha');
  });

  it('a consumer aria-label keeps naming the radio; no aria-labelledby is added', () => {
    render(
      <RadioGroup aria-label="Options">
        <RadioItem value="a" label="Alpha" aria-label="First letter" />
      </RadioGroup>,
    );
    const button = screen.getByRole('radio');
    expect(button).not.toHaveAttribute('aria-labelledby');
    expect(button).toHaveAccessibleName('First letter');
  });

  it('joins a consumer aria-labelledby with the label text (consumer ids first)', () => {
    render(
      <RadioGroup aria-label="Options">
        <span id="greek">Greek</span>
        <RadioItem value="a" label="Alpha" aria-labelledby="greek" disabled />
      </RadioGroup>,
    );
    const button = screen.getByRole('radio');
    expect(button).toHaveAttribute('aria-labelledby', `greek ${screen.getByText('Alpha').id}`);
    expect(button).toHaveAccessibleName('Greek Alpha');
  });

  it('passes a consumer aria-labelledby through unchanged next to a consumer aria-label', () => {
    render(
      <RadioGroup aria-label="Options">
        <span id="greek">Greek</span>
        <RadioItem value="a" label="Alpha" aria-label="First letter" aria-labelledby="greek" />
      </RadioGroup>,
    );
    const button = screen.getByRole('radio');
    expect(button).toHaveAttribute('aria-labelledby', 'greek');
    expect(button).toHaveAccessibleName('Greek');
  });
});

describe('RadioItem — rich label', () => {
  it('a label with a line of subtext names the radio with its whole text', async () => {
    render(
      <RadioGroup aria-label="Plan">
        <RadioItem
          value="pro"
          label={
            <span className="flex flex-col">
              <span>Pro</span>{' '}
              <span className="text-caption-1 text-muted-foreground">For growing teams</span>
            </span>
          }
        />
      </RadioGroup>,
    );
    expect(screen.getByRole('radio', { name: 'Pro For growing teams' })).toBeInTheDocument();
    await expectNoA11yViolations();
  });

  it('clicking the label text selects; clicking a link inside it does not', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <RadioGroup aria-label="Plan" onValueChange={onValueChange}>
          <RadioItem value="free" label="Free" />
          <RadioItem
            value="pro"
            label={
              <>
                Pro (<a href="#pricing">see pricing</a>)
              </>
            }
          />
        </RadioGroup>
      </React.StrictMode>,
    );
    const pro = screen.getByRole('radio', { name: 'Pro (see pricing)' });
    // fireEvent, not userEvent: user-event forwards every click inside a <label> to its control,
    // while browsers (and jsdom) skip the forwarding for a click on interactive content.
    fireEvent.click(screen.getByRole('link', { name: 'see pricing' }));
    expect(pro).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByText(/^Pro \(/));
    expect(pro).toHaveAttribute('aria-checked', 'true');
    expect(onValueChange.mock.calls).toEqual([['pro']]);
  });

  it('renders label={0} as content', () => {
    render(
      <RadioGroup aria-label="Count">
        <RadioItem value="0" label={0} />
      </RadioGroup>,
    );
    expect(screen.getByRole('radio', { name: '0' })).toHaveAttribute(
      'aria-labelledby',
      screen.getByText('0').id,
    );
  });

  it('does not render children and warns once that the label goes in `label`', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const ui = (
        <React.StrictMode>
          <RadioGroup aria-label="Plan">
            <RadioItem value="a" label="Alpha">
              Ignored text
            </RadioItem>
            <RadioItem value="b" label="Beta">
              Also ignored
            </RadioItem>
          </RadioGroup>
        </React.StrictMode>
      );
      const { rerender } = render(ui);
      rerender(ui);
      expect(screen.queryByText('Ignored text')).not.toBeInTheDocument();
      expect(screen.queryByText('Also ignored')).not.toBeInTheDocument();
      expect(radio('Alpha')).toBeInTheDocument();
      expect(warn.mock.calls).toEqual([[CHILDREN_WARNING]]);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('RadioGroup - roving tabindex', () => {
  it('only the selected radio has tabIndex 0', () => {
    render(
      <RadioGroup defaultValue="b" aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
    );
    expect(radio('Alpha')).toHaveAttribute('tabindex', '-1');
    expect(radio('Beta')).toHaveAttribute('tabindex', '0');
    expect(radio('Charlie')).toHaveAttribute('tabindex', '-1');
  });

  it('with no value, Tab reaches the first radio and ArrowDown moves to the second', async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
      </RadioGroup>,
    );
    await user.tab();
    expect(radio('Alpha')).toHaveFocus();
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'false');
    await user.keyboard('{ArrowDown}');
    expect(radio('Beta')).toHaveFocus();
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Beta')).toHaveAttribute('tabindex', '0');
  });

  it('with no value, Tab reaches the first radio and Space checks it (APG)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup aria-label="Options" onValueChange={onValueChange}>
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
      </RadioGroup>,
    );
    await user.tab();
    expect(radio('Alpha')).toHaveFocus();
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'false');
    await user.keyboard(' ');
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'true');
    expect(onValueChange.mock.calls).toEqual([['a']]);
  });

  it('finds items inside Fragments and wrapper elements', async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup aria-label="Options">
        <>
          <RadioItem value="a" label="Alpha" />
        </>
        <div>
          <RadioItem value="b" label="Beta" />
        </div>
      </RadioGroup>,
    );
    expect(radio('Alpha')).toHaveAttribute('tabindex', '0');
    await user.tab();
    expect(radio('Alpha')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(radio('Beta')).toHaveFocus();
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'true');
  });

  it('ArrowDown moves focus and selects next item (vertical)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup defaultValue="a" onValueChange={onValueChange} aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
    );
    act(() => radio('Alpha').focus());
    await user.keyboard('{ArrowDown}');
    expect(onValueChange).toHaveBeenCalledWith('b');
    expect(radio('Beta')).toHaveFocus();
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Beta')).toHaveAttribute('tabindex', '0');
    expect(radio('Alpha')).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowUp moves focus and selects previous item (vertical)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup defaultValue="b" onValueChange={onValueChange} aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
    );
    act(() => radio('Beta').focus());
    await user.keyboard('{ArrowUp}');
    expect(onValueChange).toHaveBeenCalledWith('a');
    expect(radio('Alpha')).toHaveFocus();
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Alpha')).toHaveAttribute('tabindex', '0');
  });

  it('ArrowRight/Left moves in horizontal orientation', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup
        orientation="horizontal"
        defaultValue="a"
        onValueChange={onValueChange}
        aria-label="Options"
      >
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
      </RadioGroup>,
    );
    act(() => radio('Alpha').focus());
    await user.keyboard('{ArrowRight}');
    expect(onValueChange).toHaveBeenLastCalledWith('b');
    expect(radio('Beta')).toHaveFocus();
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(onValueChange).toHaveBeenLastCalledWith('a');
    expect(radio('Alpha')).toHaveFocus();
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'true');
  });

  it('Left/Right also move in a vertical group (APG: all four arrows)', async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup defaultValue="a" aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
      </RadioGroup>,
    );
    act(() => radio('Alpha').focus());
    await user.keyboard('{ArrowRight}');
    expect(radio('Beta')).toHaveFocus();
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(radio('Alpha')).toHaveFocus();
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'true');
  });

  it('Up/Down also move in a horizontal group (APG: all four arrows)', async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup orientation="horizontal" defaultValue="a" aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
      </RadioGroup>,
    );
    act(() => radio('Alpha').focus());
    await user.keyboard('{ArrowDown}');
    expect(radio('Beta')).toHaveFocus();
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowUp}');
    expect(radio('Alpha')).toHaveFocus();
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'true');
  });

  it('mirrors Left/Right under dir="rtl"', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <RadioGroup orientation="horizontal" defaultValue="a" aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
      { dir: 'rtl' },
    );
    act(() => radio('Alpha').focus());
    await user.keyboard('{ArrowLeft}');
    expect(radio('Beta')).toHaveFocus();
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowRight}');
    expect(radio('Alpha')).toHaveFocus();
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'true');
  });

  it('wraps from last to first item', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup defaultValue="c" onValueChange={onValueChange} aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
    );
    act(() => radio('Charlie').focus());
    await user.keyboard('{ArrowDown}');
    expect(onValueChange).toHaveBeenCalledWith('a');
    expect(radio('Alpha')).toHaveFocus();
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'true');
  });

  it('with no value and a disabled first item, the second item is the tab stop', async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup aria-label="Options">
        <RadioItem value="a" label="Alpha" disabled />
        <RadioItem value="b" label="Beta" />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
    );
    expect(radio('Alpha')).toHaveAttribute('tabindex', '-1');
    expect(radio('Beta')).toHaveAttribute('tabindex', '0');
    expect(radio('Charlie')).toHaveAttribute('tabindex', '-1');
    await user.tab();
    expect(radio('Beta')).toHaveFocus();
  });

  it('ArrowDown skips disabled items during navigation', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup defaultValue="a" onValueChange={onValueChange} aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" disabled />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
    );
    act(() => radio('Alpha').focus());
    await user.keyboard('{ArrowDown}');
    // Should skip disabled "b" and go straight to "c"
    expect(onValueChange).toHaveBeenCalledWith('c');
    expect(radio('Charlie')).toHaveFocus();
    expect(radio('Charlie')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'false');
  });

  it('Home moves to first item', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup defaultValue="c" onValueChange={onValueChange} aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
    );
    act(() => radio('Charlie').focus());
    await user.keyboard('{Home}');
    expect(onValueChange).toHaveBeenCalledWith('a');
    expect(radio('Alpha')).toHaveFocus();
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'true');
  });

  it('End moves to last item', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup defaultValue="a" onValueChange={onValueChange} aria-label="Options">
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" />
        <RadioItem value="c" label="Charlie" />
      </RadioGroup>,
    );
    act(() => radio('Alpha').focus());
    await user.keyboard('{End}');
    expect(onValueChange).toHaveBeenCalledWith('c');
    expect(radio('Charlie')).toHaveFocus();
    expect(radio('Charlie')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('RadioGroup — Field integration (FieldContext)', () => {
  it('is named by the Field label through aria-labelledby and described by hint and error', () => {
    renderWithFieldContext(<RadioGroup>{twoItems}</RadioGroup>, {
      hintId: FIELD_TEST_IDS.hintId,
      errorId: FIELD_TEST_IDS.errorId,
      required: true,
    });
    const group = screen.getByRole('radiogroup', { name: FIELD_TEST_TEXT.label });
    expect(group).toHaveAttribute('aria-labelledby', FIELD_TEST_IDS.labelId);
    expect(group).toHaveAccessibleDescription(`${FIELD_TEST_TEXT.error} ${FIELD_TEST_TEXT.hint}`);
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAttribute('aria-required', 'true');
  });

  it('a consumer aria-label wins over the Field label', () => {
    renderWithFieldContext(<RadioGroup aria-label="Own name">{twoItems}</RadioGroup>);
    expect(screen.getByRole('radiogroup', { name: 'Own name' })).not.toHaveAttribute(
      'aria-labelledby',
    );
  });

  it('the items stay named by their own label text only (the Field names the group)', () => {
    renderWithFieldContext(
      <RadioGroup disabled>
        <RadioItem value="a" label="Alpha" />
        <RadioItem value="b" label="Beta" disabled />
      </RadioGroup>,
    );
    for (const name of ['Alpha', 'Beta']) {
      expect(radio(name)).toHaveAttribute('aria-labelledby', screen.getByText(name).id);
      expect(radio(name)).toHaveAccessibleName(name);
    }
  });

  it('a required Field blocks the form until a value is selected (no name needed)', async () => {
    const user = userEvent.setup();
    renderWithFieldContext(
      <form aria-label="Form">
        <RadioGroup>{twoItems}</RadioGroup>
      </form>,
      { required: true },
    );
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    // A failed check fires `invalid`, which focuses the tab stop and updates state: run it in act.
    let valid = true;
    act(() => {
      valid = form.checkValidity();
    });
    expect(valid).toBe(false);
    await user.click(radio('Alpha'));
    expect(form.checkValidity()).toBe(true);
  });

  it('an explicit required={false} wins over a required Field (aria-required matches validation)', () => {
    renderWithFieldContext(
      <form aria-label="Form">
        <RadioGroup required={false}>{twoItems}</RadioGroup>
      </form>,
      { required: true },
    );
    const group = screen.getByRole('radiogroup', { name: FIELD_TEST_TEXT.label });
    expect(group).not.toHaveAttribute('aria-required', 'true');
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect(form.checkValidity()).toBe(true);
  });
});

describe('RadioGroup — native forms (C-FORMS)', () => {
  function getForm() {
    return screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
  }

  /** A failed check fires `invalid`, which focuses the tab stop and updates state: run it in act. */
  function checkValidity(): boolean {
    let valid = false;
    act(() => {
      valid = getForm().checkValidity();
    });
    return valid;
  }

  it('adds nothing to FormData without a name (no generated default name)', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <RadioGroup aria-label="Options" defaultValue="a">
          {twoItems}
        </RadioGroup>
      </form>,
    );
    await user.click(radio('Beta'));
    expect(Array.from(new FormData(getForm()).keys())).toEqual([]);
  });

  it('submits the selected value under the consumer name', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <RadioGroup aria-label="Options" name="letter">
          {twoItems}
        </RadioGroup>
      </form>,
    );
    expect(new FormData(getForm()).getAll('letter')).toEqual([]);
    await user.click(radio('Beta'));
    expect(new FormData(getForm()).getAll('letter')).toEqual(['b']);
  });

  it('required blocks validation until a value is selected', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <RadioGroup aria-label="Options" name="letter" required>
          {twoItems}
        </RadioGroup>
      </form>,
    );
    expect(checkValidity()).toBe(false);
    expect(screen.getByRole('radiogroup', { name: 'Options' })).toHaveAttribute(
      'aria-required',
      'true',
    );
    await user.click(radio('Alpha'));
    expect(checkValidity()).toBe(true);
    expect(new FormData(getForm()).get('letter')).toBe('a');
  });

  it('a failed validation focuses the tab-stop radio', () => {
    render(
      <form aria-label="Form">
        <RadioGroup aria-label="Options" required>
          {twoItems}
        </RadioGroup>
      </form>,
    );
    act(() => {
      getForm().reportValidity();
    });
    expect(radio('Alpha')).toHaveFocus();
  });

  it('a disabled group is neither submitted nor validated, like native radios', () => {
    render(
      <form aria-label="Form">
        <RadioGroup aria-label="Size" name="size" defaultValue="a" disabled>
          {twoItems}
        </RadioGroup>
        <RadioGroup aria-label="Plan" name="plan" required disabled>
          <RadioItem value="free" label="Free" />
          <RadioItem value="pro" label="Pro" />
        </RadioGroup>
      </form>,
    );
    // The user cannot choose in a disabled group, so its requirement must not block the form.
    expect(checkValidity()).toBe(true);
    expect(Array.from(new FormData(getForm()).keys())).toEqual([]);
  });

  it('controlled: a form reset reports defaultValue once through onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    function Controlled() {
      const [value, setValue] = React.useState('a');
      return (
        <form aria-label="Form">
          <RadioGroup
            aria-label="Options"
            defaultValue="a"
            value={value}
            onValueChange={(next) => {
              onValueChange(next);
              setValue(next);
            }}
          >
            {twoItems}
          </RadioGroup>
        </form>
      );
    }
    render(<Controlled />);
    await user.click(radio('Beta'));
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'true');
    onValueChange.mockClear();
    act(() => getForm().reset());
    expect(onValueChange.mock.calls).toEqual([['a']]);
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'false');
  });

  it('form reset restores defaultValue (with and without a name)', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <RadioGroup aria-label="Named" name="letter" defaultValue="a">
          <RadioItem value="a" label="Alpha" />
          <RadioItem value="b" label="Beta" />
        </RadioGroup>
        <RadioGroup aria-label="Unnamed">
          <RadioItem value="x" label="X-ray" />
          <RadioItem value="y" label="Yankee" />
        </RadioGroup>
      </form>,
    );
    await user.click(radio('Beta'));
    await user.click(radio('Yankee'));
    act(() => getForm().reset());
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Beta')).toHaveAttribute('aria-checked', 'false');
    expect(radio('Yankee')).toHaveAttribute('aria-checked', 'false');
  });
});

describe('RadioGroup — types', () => {
  it('declares ref in the props interfaces (C-REF) and uses the shared Orientation type', () => {
    expectTypeOf<RadioGroupProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<RadioItemProps['ref']>().toEqualTypeOf<React.Ref<HTMLButtonElement> | undefined>();
    expectTypeOf<RadioGroupItemProps>().toEqualTypeOf<RadioItemProps>();
    expectTypeOf<RadioGroupProps['orientation']>().toEqualTypeOf<Orientation | undefined>();
    expectTypeOf<RadioGroupProps['onValueChange']>().toEqualTypeOf<
      ((value: string) => void) | undefined
    >();
  });

  it('types the RadioItem label as ReactNode', () => {
    expectTypeOf<RadioItemProps['label']>().toEqualTypeOf<React.ReactNode>();
  });

  it('RadioItem accepts native button attributes', () => {
    expectTypeOf<RadioItemProps>().toHaveProperty('aria-describedby');
    expectTypeOf<RadioItemProps>().toHaveProperty('onFocus');
    // @ts-expect-error -- `value` is the item's string value, not a native button value
    const props: RadioItemProps = { value: 1 };
    expect(props).toBeDefined();
  });
});
