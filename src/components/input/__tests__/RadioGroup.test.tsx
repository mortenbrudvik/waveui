import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup, RadioGroupItem, RadioItem } from '../RadioGroup';
import type { RadioGroupItemProps, RadioGroupProps, RadioItemProps } from '../RadioGroup';
import type { Orientation } from '../../../lib/types';
import {
  renderWithProviders,
  testComposedHandler,
  testCompoundExposure,
  testDisplayName,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_IDS, FIELD_TEST_TEXT } from '../../../test-utils-field';

const twoItems = [
  <RadioItem key="a" value="a" label="Alpha" />,
  <RadioItem key="b" value="b" label="Beta" />,
];

function radio(name: string): HTMLElement {
  return screen.getByRole('radio', { name });
}

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
      const deprecations = warn.mock.calls.filter(([msg]) =>
        String(msg).includes('RadioGroup: `onChange` is deprecated'),
      );
      expect(deprecations).toHaveLength(1);
      expect(String(deprecations[0][0])).toContain('Use `onValueChange` instead.');
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
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => render(<RadioItem value="a" label="Orphan" />)).toThrow(
        '[WaveUI] RadioItem must be used within a RadioGroup',
      );
    } finally {
      error.mockRestore();
    }
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

  it('RadioItem accepts native button attributes', () => {
    expectTypeOf<RadioItemProps>().toHaveProperty('aria-describedby');
    expectTypeOf<RadioItemProps>().toHaveProperty('onFocus');
    // @ts-expect-error -- `value` is the item's string value, not a native button value
    const props: RadioItemProps = { value: 1 };
    expect(props).toBeDefined();
  });
});
