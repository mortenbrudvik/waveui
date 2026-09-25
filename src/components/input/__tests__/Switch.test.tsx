import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '../Switch';
import type { SwitchLabelPosition, SwitchProps } from '../Switch';
import {
  expectNoA11yViolations,
  renderWithProviders,
  testComposedHandler,
  testFocusEvents,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_IDS, FIELD_TEST_TEXT } from '../../../test-utils-field';

/** The development warning of a Switch with children. */
const CHILDREN_WARNING = '[WaveUI] Switch: children are not rendered. Pass the label in `label`.';

function getThumb(control: HTMLElement): HTMLElement {
  const thumb = control.querySelector('span');
  if (!thumb) throw new Error('Switch thumb not found');
  return thumb;
}

describe('Switch', () => {
  testSystemProps(Switch, {
    expectedTag: 'label',
    displayName: 'Switch',
    control: { role: 'switch' },
    defaultProps: { label: 'Dark mode' },
    a11yVariants: [
      { name: 'checked', props: { defaultChecked: true } },
      { name: 'disabled', props: { disabled: true } },
      { name: 'required with a name', props: { name: 'dark', required: true } },
      { name: 'label before', props: { labelPosition: 'before' } },
      { name: 'label above', props: { labelPosition: 'above' } },
    ],
  });

  testFocusEvents(Switch, { label: 'Dark mode' }, 'button');

  testNoImplicitSubmit(Switch, { defaultProps: { label: 'Dark mode' } });

  testComposedHandler(Switch, {
    handler: 'onClick',
    defaultProps: { label: 'Dark mode' },
    act: async ({ user }) => {
      await user.click(screen.getByRole('switch', { name: 'Dark mode' }));
    },
    assertInternal: () => {
      expect(screen.getByRole('switch', { name: 'Dark mode' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    },
    assertInternalSuppressed: () => {
      expect(screen.getByRole('switch', { name: 'Dark mode' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    },
  });

  it('exposes a switch named by its label', () => {
    render(<Switch label="Dark mode" />);
    expect(screen.getByRole('switch')).toHaveAccessibleName('Dark mode');
  });

  it('starts unchecked by default', () => {
    render(<Switch />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('starts checked when defaultChecked is true', () => {
    render(<Switch defaultChecked />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles in uncontrolled mode', async () => {
    const user = userEvent.setup();
    render(<Switch />);
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onCheckedChange in uncontrolled mode', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch label="Dark mode" onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole('switch', { name: 'Dark mode' }));
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('respects controlled checked prop', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch label="Dark mode" checked={false} onCheckedChange={onCheckedChange} />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('fires onCheckedChange exactly once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <React.StrictMode>
        <Switch label="Dark mode" onCheckedChange={onCheckedChange} />
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('switch', { name: 'Dark mode' }));
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
  });

  it('keeps the deprecated onChange alias working and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { rerender } = render(<Switch label="Dark mode" onChange={onChange} />);
      rerender(<Switch label="Dark mode" onChange={onChange} />);
      await user.click(screen.getByRole('switch', { name: 'Dark mode' }));
      expect(onChange).toHaveBeenCalledWith(true);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Switch: `onChange` is deprecated and will be removed in 1.0. Use ' +
            '`onCheckedChange` instead.',
        ],
      ]);
    } finally {
      warn.mockRestore();
    }
  });

  it('toggles with Space from the keyboard', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch label="Dark mode" onCheckedChange={onCheckedChange} />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    await user.tab();
    expect(sw).toHaveFocus();
    await user.keyboard(' ');
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await user.keyboard(' ');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(onCheckedChange.mock.calls).toEqual([[true], [false]]);
  });

  it('applies disabled state', () => {
    render(<Switch disabled />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});

describe('Switch — props reach the switch control (C-ROUTING)', () => {
  it('routes id, aria-*, tabIndex and autoFocus to the role="switch" button', () => {
    render(
      <>
        <p id="sw-desc">Applies to every page</p>
        <Switch
          data-testid="root"
          id="my-switch"
          aria-describedby="sw-desc"
          aria-invalid
          tabIndex={2}
          autoFocus
          label="Dark mode"
        />
      </>,
    );
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    const root = screen.getByTestId('root');
    expect(root.tagName).toBe('LABEL');
    expect(sw).toHaveAttribute('id', 'my-switch');
    expect(sw).toHaveAccessibleDescription('Applies to every page');
    expect(sw).toHaveAttribute('aria-invalid', 'true');
    expect(sw).toHaveAttribute('tabindex', '2');
    expect(sw).toHaveFocus();
    for (const attr of ['id', 'aria-describedby', 'aria-invalid', 'tabindex']) {
      expect(root).not.toHaveAttribute(attr);
    }
  });

  it('keeps ref on the label and exposes the button through controlRef', () => {
    const ref = React.createRef<HTMLLabelElement>();
    const controlRef = React.createRef<HTMLButtonElement>();
    render(<Switch ref={ref} controlRef={controlRef} label="Dark mode" />);
    expect(ref.current?.tagName).toBe('LABEL');
    expect(controlRef.current).toBe(screen.getByRole('switch', { name: 'Dark mode' }));
  });

  it('fires a consumer onClick once when the label text is clicked, and toggles once', async () => {
    const user = userEvent.setup();
    const currentTargets: EventTarget[] = [];
    const onClick = vi.fn((e: React.MouseEvent<HTMLButtonElement>) => {
      currentTargets.push(e.currentTarget);
    });
    render(<Switch label="Dark mode" onClick={onClick} />);
    await user.click(screen.getByText('Dark mode'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(currentTargets).toEqual([screen.getByRole('switch')]);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });
});

// axe exempts the dimmed label text of a disabled control only when that control references the
// text through aria-labelledby: its <label> exemption covers native inputs, not a role="switch"
// button. The reference does not depend on the disabled state, and the name stays the same.
describe('Switch — the label text names the control through aria-labelledby', () => {
  it.each([
    { state: 'enabled', disabled: false },
    { state: 'disabled', disabled: true },
  ])('references the label text and keeps its name ($state)', ({ disabled }) => {
    render(<Switch label="Dark mode" disabled={disabled} />);
    const sw = screen.getByRole('switch');
    const text = screen.getByText('Dark mode');
    expect(text.id).not.toBe('');
    expect(sw).toHaveAttribute('aria-labelledby', text.id);
    expect(sw).toHaveAccessibleName('Dark mode');
  });

  it('gives every switch its own label text id', () => {
    render(
      <>
        <Switch label="Wi-Fi" />
        <Switch label="Bluetooth" />
      </>,
    );
    const wifi = screen.getByText('Wi-Fi');
    const bluetooth = screen.getByText('Bluetooth');
    expect(wifi.id).not.toBe(bluetooth.id);
    expect(screen.getByRole('switch', { name: 'Wi-Fi' })).toHaveAttribute(
      'aria-labelledby',
      wifi.id,
    );
    expect(screen.getByRole('switch', { name: 'Bluetooth' })).toHaveAttribute(
      'aria-labelledby',
      bluetooth.id,
    );
  });

  it('adds no aria-labelledby without label text (aria-label names it)', () => {
    render(<Switch aria-label="Airplane mode" disabled />);
    const sw = screen.getByRole('switch');
    expect(sw).not.toHaveAttribute('aria-labelledby');
    expect(sw).toHaveAccessibleName('Airplane mode');
  });

  it('a consumer aria-label keeps naming the control; no aria-labelledby is added', () => {
    render(<Switch label="Dark mode" aria-label="Use the dark theme" />);
    const sw = screen.getByRole('switch');
    expect(sw).not.toHaveAttribute('aria-labelledby');
    expect(sw).toHaveAccessibleName('Use the dark theme');
  });

  it('joins a consumer aria-labelledby with the label text (consumer ids first)', () => {
    render(
      <>
        <span id="display-heading">Display</span>
        <Switch label="Dark mode" aria-labelledby="display-heading" disabled />
      </>,
    );
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute(
      'aria-labelledby',
      `display-heading ${screen.getByText('Dark mode').id}`,
    );
    expect(sw).toHaveAccessibleName('Display Dark mode');
  });

  it('passes a consumer aria-labelledby through unchanged next to a consumer aria-label', () => {
    render(
      <>
        <span id="display-heading">Display</span>
        <Switch
          label="Dark mode"
          aria-label="Use the dark theme"
          aria-labelledby="display-heading"
        />
      </>,
    );
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-labelledby', 'display-heading');
    expect(sw).toHaveAccessibleName('Display');
  });
});

describe('Switch — Field integration (FieldContext)', () => {
  it('is named by the Field label and described by its hint and error', () => {
    renderWithFieldContext(<Switch />, {
      hintId: FIELD_TEST_IDS.hintId,
      errorId: FIELD_TEST_IDS.errorId,
      required: true,
    });
    const sw = screen.getByRole('switch', { name: FIELD_TEST_TEXT.label });
    expect(sw).toHaveAttribute('id', FIELD_TEST_IDS.controlId);
    // Without label text the Field's <label htmlFor> alone names it.
    expect(sw).not.toHaveAttribute('aria-labelledby');
    expect(sw).toHaveAccessibleDescription(`${FIELD_TEST_TEXT.error} ${FIELD_TEST_TEXT.hint}`);
    expect(sw).toHaveAttribute('aria-invalid', 'true');
    expect(sw).toHaveAttribute('aria-required', 'true');
  });

  it('is labelled through aria-labelledby when it carries its own id', () => {
    renderWithFieldContext(<Switch id="own-id" />);
    const sw = screen.getByRole('switch', { name: FIELD_TEST_TEXT.label });
    expect(sw).toHaveAttribute('aria-labelledby', FIELD_TEST_IDS.labelId);
  });

  it.each([
    { state: 'enabled', disabled: false },
    { state: 'disabled', disabled: true },
  ])(
    'with label text, keeps the Field label and the label text in its name ($state)',
    ({ disabled }) => {
      renderWithFieldContext(<Switch label="Dark mode" disabled={disabled} />);
      const sw = screen.getByRole('switch');
      expect(sw).toHaveAttribute('id', FIELD_TEST_IDS.controlId);
      // Both <label>s named it; aria-labelledby lists them in the same (document) order.
      expect(sw).toHaveAttribute(
        'aria-labelledby',
        `${FIELD_TEST_IDS.labelId} ${screen.getByText('Dark mode').id}`,
      );
      expect(sw).toHaveAccessibleName(`${FIELD_TEST_TEXT.label} Dark mode`);
    },
  );

  it('with label text and its own id, joins the Field label and the label text', () => {
    renderWithFieldContext(<Switch id="own-id" label="Dark mode" />);
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute(
      'aria-labelledby',
      `${FIELD_TEST_IDS.labelId} ${screen.getByText('Dark mode').id}`,
    );
    expect(sw).toHaveAccessibleName(`${FIELD_TEST_TEXT.label} Dark mode`);
  });

  it('a consumer aria-label wins over the Field label and the label text', () => {
    renderWithFieldContext(<Switch label="Dark mode" aria-label="Use the dark theme" />);
    const sw = screen.getByRole('switch');
    expect(sw).not.toHaveAttribute('aria-labelledby');
    expect(sw).toHaveAccessibleName('Use the dark theme');
  });

  it('a consumer aria-labelledby comes first, then the Field label and the label text', () => {
    renderWithFieldContext(
      <>
        <span id="display-heading">Display</span>
        <Switch label="Dark mode" aria-labelledby="display-heading" />
      </>,
    );
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute(
      'aria-labelledby',
      `display-heading ${FIELD_TEST_IDS.labelId} ${screen.getByText('Dark mode').id}`,
    );
    expect(sw).toHaveAccessibleName(`Display ${FIELD_TEST_TEXT.label} Dark mode`);
  });

  it('a required Field blocks the form until the switch is on (no name needed)', async () => {
    const user = userEvent.setup();
    renderWithFieldContext(
      <form aria-label="Form">
        <Switch />
      </form>,
      { required: true },
    );
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect(form.checkValidity()).toBe(false);
    await user.click(screen.getByRole('switch', { name: FIELD_TEST_TEXT.label }));
    expect(form.checkValidity()).toBe(true);
  });

  it('an explicit required={false} wins over a required Field (aria-required matches validation)', () => {
    renderWithFieldContext(
      <form aria-label="Form">
        <Switch required={false} />
      </form>,
      { required: true },
    );
    const sw = screen.getByRole('switch', { name: FIELD_TEST_TEXT.label });
    expect(sw).not.toHaveAttribute('aria-required', 'true');
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect(form.checkValidity()).toBe(true);
  });
});

describe('Switch — native forms (C-FORMS)', () => {
  function getForm() {
    return screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
  }

  it('submits name=value while on, nothing while off', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <Switch name="dark" value="1" label="Dark mode" />
      </form>,
    );
    expect(new FormData(getForm()).getAll('dark')).toEqual([]);
    await user.click(screen.getByRole('switch', { name: 'Dark mode' }));
    expect(new FormData(getForm()).getAll('dark')).toEqual(['1']);
  });

  it('adds nothing to FormData without a name', () => {
    render(
      <form aria-label="Form">
        <Switch defaultChecked label="Dark mode" />
      </form>,
    );
    expect(Array.from(new FormData(getForm()).keys())).toEqual([]);
  });

  it('required blocks validation until switched on', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <Switch name="dark" required label="Dark mode" />
      </form>,
    );
    expect(getForm().checkValidity()).toBe(false);
    await user.click(screen.getByRole('switch', { name: 'Dark mode' }));
    expect(getForm().checkValidity()).toBe(true);
  });

  it('a disabled switch is neither submitted nor validated, like a native checkbox', () => {
    render(
      <form aria-label="Form">
        <Switch name="dark" required disabled label="Dark mode" />
        <Switch name="compact" defaultChecked disabled label="Compact" />
      </form>,
    );
    // The user cannot switch a disabled switch on, so its requirement must not block the form.
    expect(getForm().checkValidity()).toBe(true);
    expect(Array.from(new FormData(getForm()).keys())).toEqual([]);
  });

  it('controlled: a form reset reports defaultChecked once through onCheckedChange', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    function Controlled() {
      const [checked, setChecked] = React.useState(true);
      return (
        <form aria-label="Form">
          <Switch
            label="Dark mode"
            defaultChecked
            checked={checked}
            onCheckedChange={(next) => {
              onCheckedChange(next);
              setChecked(next);
            }}
          />
        </form>
      );
    }
    render(<Controlled />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
    onCheckedChange.mockClear();
    act(() => getForm().reset());
    expect(onCheckedChange.mock.calls).toEqual([[true]]);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('form reset restores defaultChecked (with and without a name)', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Form">
        <Switch name="dark" defaultChecked label="Dark mode" />
        <Switch label="Compact" />
      </form>,
    );
    const named = screen.getByRole('switch', { name: 'Dark mode' });
    const unnamed = screen.getByRole('switch', { name: 'Compact' });
    await user.click(named);
    await user.click(unnamed);
    expect(named).toHaveAttribute('aria-checked', 'false');
    expect(unnamed).toHaveAttribute('aria-checked', 'true');
    act(() => getForm().reset());
    expect(named).toHaveAttribute('aria-checked', 'true');
    expect(unnamed).toHaveAttribute('aria-checked', 'false');
  });
});

describe('Switch — styling tokens', () => {
  it('off: transparent track with the accessible stroke and a stroke-accessible thumb', () => {
    render(<Switch label="Dark mode" />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    expect(sw).toHaveClass(
      'bg-transparent',
      'border-stroke-accessible',
      'forced-colors:border-[ButtonText]',
    );
    expect(getThumb(sw)).toHaveClass('bg-stroke-accessible', 'forced-colors:bg-[ButtonText]');
  });

  it('on: primary track with a primary-foreground thumb', () => {
    render(<Switch label="Dark mode" defaultChecked />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    expect(sw).toHaveClass('bg-primary', 'border-primary', 'forced-colors:bg-[Highlight]');
    expect(getThumb(sw)).toHaveClass(
      'bg-primary-foreground',
      'forced-colors:bg-[HighlightText]',
      'forced-colors:forced-color-adjust-none',
    );
  });

  it('forced colors: the track keeps system colors; only the thumb opts out (leaf)', () => {
    render(<Switch label="Dark mode" defaultChecked />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    expect(sw).toHaveClass('forced-colors:border-[Highlight]', 'forced-colors:bg-[Highlight]');
    expect(sw).not.toHaveClass('forced-colors:forced-color-adjust-none');
  });

  it('forced colors: a disabled switch that is on draws a GrayText thumb and border on Canvas', () => {
    render(<Switch label="Dark mode" defaultChecked disabled />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    expect(sw).toHaveClass('forced-colors:border-[GrayText]', 'forced-colors:bg-[Canvas]');
    expect(sw).not.toHaveClass('forced-colors:bg-[Highlight]');
    expect(sw).not.toHaveClass('forced-colors:border-[Highlight]');
    expect(getThumb(sw)).toHaveClass(
      'forced-colors:bg-[GrayText]',
      'forced-colors:forced-color-adjust-none',
    );
    expect(getThumb(sw)).not.toHaveClass('forced-colors:bg-[HighlightText]');
  });

  it('forced colors: a disabled switch that is off draws a GrayText thumb and border', () => {
    render(<Switch label="Dark mode" disabled />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    expect(sw).toHaveClass('forced-colors:border-[GrayText]');
    expect(sw).not.toHaveClass('forced-colors:border-[ButtonText]');
    expect(getThumb(sw)).toHaveClass('forced-colors:bg-[GrayText]');
    expect(getThumb(sw)).not.toHaveClass('forced-colors:bg-[ButtonText]');
  });

  it('sizes the track and the thumb in one unit (px), so the thumb fits the track at any root font size', () => {
    /** The value of a `<utility>-[<n>px]` class (not one behind a variant). */
    function px(element: HTMLElement, utility: string): number {
      const match = element.className.match(
        new RegExp(`(?:^|\\s)${utility}-\\[(\\d+(?:\\.\\d+)?)px\\](?=\\s|$)`),
      );
      if (!match) throw new Error(`no ${utility}-[…px] class in "${element.className}"`);
      return Number(match[1]);
    }
    render(
      <>
        <Switch label="Off" />
        <Switch label="On" defaultChecked />
      </>,
    );
    const off = screen.getByRole('switch', { name: 'Off' });
    const on = screen.getByRole('switch', { name: 'On' });
    // A rem track (h-5 w-10) scales with the root font size while the px thumb does not.
    expect(on.className).not.toMatch(/(^|\s)(h|w|size)-\d/);
    expect(on).toHaveClass('border');
    const border = 1;
    const thumb = px(getThumb(on), 'w');
    expect(px(getThumb(on), 'h')).toBe(thumb);
    const offInset = px(getThumb(off), 'translate-x');
    // The checked thumb stops as far from the inline end as the unchecked one from the start…
    expect(px(on, 'w') - 2 * border - thumb - px(getThumb(on), 'translate-x')).toBe(offInset);
    // …and the same distance from the top and bottom.
    expect(px(on, 'h') - 2 * border - thumb).toBe(2 * offInset);
  });

  it('sets its own zero track padding, so app button styles cannot shift the thumb (C-NATIVE)', () => {
    render(
      <>
        <Switch label="Off" />
        <Switch label="On" defaultChecked />
      </>,
    );
    expect(screen.getByRole('switch', { name: 'Off' })).toHaveClass('p-0', 'bg-transparent');
    expect(screen.getByRole('switch', { name: 'On' })).toHaveClass('p-0', 'bg-primary');
  });

  it('draws the label text on the px type ramp like Field and Label (text-body-1)', () => {
    render(<Switch label="Dark mode" />);
    expect(screen.getByText('Dark mode')).toHaveClass('text-body-1');
    expect(screen.getByText('Dark mode')).not.toHaveClass('text-sm');
  });

  it('turns off the track and thumb transitions for reduced motion', () => {
    render(<Switch label="Dark mode" />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    expect(sw).toHaveClass('motion-reduce:transition-none');
    expect(getThumb(sw)).toHaveClass('motion-reduce:transition-none');
  });

  it('mirrors the thumb position under dir="rtl" (wave-rtl: variant, C-LOGICAL)', () => {
    renderWithProviders(
      <>
        <Switch label="Off" />
        <Switch label="On" defaultChecked />
      </>,
      { dir: 'rtl' },
    );
    expect(getThumb(screen.getByRole('switch', { name: 'Off' }))).toHaveClass(
      'translate-x-[2px]',
      'wave-rtl:-translate-x-[2px]',
    );
    expect(getThumb(screen.getByRole('switch', { name: 'On' }))).toHaveClass(
      'translate-x-[22px]',
      'wave-rtl:-translate-x-[22px]',
    );
  });

  it('mirrors by its own direction, not by an RTL ancestor: no bare rtl: class inside an LTR subtree (C-LOGICAL)', () => {
    // Tailwind's `rtl:` also matches `[dir=rtl] *`, so it would push the thumb of a switch in an LTR
    // subtree of an RTL page out of its track; `wave-rtl:` uses the element's own direction.
    renderWithProviders(
      <div dir="ltr">
        <Switch label="Off" />
        <Switch label="On" defaultChecked />
      </div>,
      { dir: 'rtl' },
    );
    for (const name of ['Off', 'On']) {
      const sw = screen.getByRole('switch', { name });
      for (const element of [sw, getThumb(sw)]) {
        expect(element.className, name).not.toMatch(/(^|\s)rtl:/);
      }
    }
    expect(getThumb(screen.getByRole('switch', { name: 'On' }))).toHaveClass(
      'wave-rtl:-translate-x-[22px]',
    );
  });
});

describe('Switch — rich label and labelPosition', () => {
  const richLabel = (
    <>
      Share my <a href="#usage">usage data</a>
    </>
  );

  it('a label with a link names the switch with its whole text', async () => {
    render(<Switch label={richLabel} />);
    expect(screen.getByRole('switch', { name: 'Share my usage data' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'usage data' })).toBeInTheDocument();
    await expectNoA11yViolations();
  });

  it('clicking the label text toggles; clicking the link inside it does not', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <React.StrictMode>
        <Switch label={richLabel} onCheckedChange={onCheckedChange} />
      </React.StrictMode>,
    );
    const control = screen.getByRole('switch', { name: 'Share my usage data' });
    await user.click(screen.getByText(/Share my/));
    expect(control).toHaveAttribute('aria-checked', 'true');
    // fireEvent, not userEvent: user-event forwards every click inside a <label> to its control,
    // while browsers (and jsdom) skip the forwarding for a click on interactive content.
    fireEvent.click(screen.getByRole('link', { name: 'usage data' }));
    expect(control).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedChange.mock.calls).toEqual([[true]]);
  });

  it('renders the label after the control by default, with data-label-position="after"', () => {
    render(<Switch label="Dark mode" data-testid="root" />);
    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-label-position', 'after');
    const control = screen.getByRole('switch', { name: 'Dark mode' });
    expect(
      control.compareDocumentPosition(screen.getByText('Dark mode')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(root).not.toHaveClass('flex-col');
  });

  it.each([
    { position: 'before', column: false },
    { position: 'above', column: true },
  ] as const)(
    'labelPosition=$position renders the label first and keeps the name',
    async ({ position, column }) => {
      const user = userEvent.setup();
      render(<Switch label="Dark mode" labelPosition={position} data-testid="root" />);
      const root = screen.getByTestId('root');
      expect(root).toHaveAttribute('data-label-position', position);
      const text = screen.getByText('Dark mode');
      expect(root.firstElementChild).toBe(text);
      if (column) expect(root).toHaveClass('flex-col', 'items-start', 'gap-1');
      else expect(root).not.toHaveClass('flex-col');
      const control = screen.getByRole('switch', { name: 'Dark mode' });
      await user.click(text);
      expect(control).toHaveAttribute('aria-checked', 'true');
      await expectNoA11yViolations();
    },
  );

  it('keeps the DOM order of labelPosition="before" under dir="rtl"', () => {
    renderWithProviders(<Switch label="Dark mode" labelPosition="before" data-testid="root" />, {
      dir: 'rtl',
    });
    expect(screen.getByTestId('root').firstElementChild).toBe(screen.getByText('Dark mode'));
  });

  it.each(['after', 'before'] as const)(
    'labelPosition=%s: the track lines up with the first line of a two-line label, not its middle',
    (position) => {
      render(
        <Switch
          labelPosition={position}
          data-testid="root"
          label={
            <span className="flex flex-col">
              <span>Dark mode</span>{' '}
              <span className="text-caption-1 text-muted-foreground">Easier on the eyes</span>
            </span>
          }
        />,
      );
      const root = screen.getByTestId('root');
      // The 20px track is as tall as the first line of `text-body-1`: both start at the top.
      expect(root).toHaveClass('items-start');
      expect(root).not.toHaveClass('items-center');
      expect(root).not.toHaveClass('flex-col');
    },
  );

  it('renders label={0} as content', () => {
    render(<Switch label={0} />);
    expect(screen.getByRole('switch', { name: '0' })).toHaveAttribute(
      'aria-labelledby',
      screen.getByText('0').id,
    );
  });

  it('does not render children and warns once that the label goes in `label`', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { rerender } = render(
        <React.StrictMode>
          <Switch label="Dark mode">Ignored text</Switch>
        </React.StrictMode>,
      );
      rerender(
        <React.StrictMode>
          <Switch label="Dark mode">Ignored text</Switch>
        </React.StrictMode>,
      );
      expect(screen.queryByText('Ignored text')).not.toBeInTheDocument();
      expect(screen.getByRole('switch')).toHaveAccessibleName('Dark mode');
      expect(warn.mock.calls).toEqual([[CHILDREN_WARNING]]);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('Switch — disabledFocusable', () => {
  it('stays in the tab order with aria-disabled and the data attributes instead of disabled', async () => {
    const user = userEvent.setup();
    render(<Switch label="Dark mode" disabledFocusable data-testid="root" />);
    const control = screen.getByRole('switch', { name: 'Dark mode' });
    await user.tab();
    expect(control).toHaveFocus();
    expect(control).not.toBeDisabled();
    expect(control).toHaveAttribute('aria-disabled', 'true');
    expect(control).toHaveAttribute('data-disabled', '');
    expect(control).toHaveAttribute('data-disabled-focusable', '');
    expect(screen.getByTestId('root')).not.toHaveAttribute('aria-disabled');
    await expectNoA11yViolations();
  });

  it('is not toggled by a click, the label text, Space or Enter, and calls no handler (StrictMode)', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    const onClick = vi.fn();
    render(
      <React.StrictMode>
        <Switch
          label="Dark mode"
          disabledFocusable
          onCheckedChange={onCheckedChange}
          onClick={onClick}
        />
      </React.StrictMode>,
    );
    const control = screen.getByRole('switch', { name: 'Dark mode' });
    await user.click(control);
    await user.click(screen.getByText('Dark mode'));
    act(() => control.focus());
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps a click, Space and Enter on the switch from reaching ancestor onClick handlers (like a natively disabled control)', async () => {
    const user = userEvent.setup();
    const onAncestorClick = vi.fn();
    const { rerender } = render(
      <div onClick={onAncestorClick}>
        <Switch label="Dark mode" disabledFocusable />
      </div>,
    );
    const control = screen.getByRole('switch', { name: 'Dark mode' });
    await user.click(control);
    act(() => control.focus());
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(onAncestorClick).not.toHaveBeenCalled();
    expect(control).toHaveAttribute('aria-checked', 'false');

    // The same three activations of an available switch do reach the ancestor, once each.
    rerender(
      <div onClick={onAncestorClick}>
        <Switch label="Dark mode" />
      </div>,
    );
    await user.click(control);
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(onAncestorClick).toHaveBeenCalledTimes(3);
  });

  it('wins over disabled: the switch stays focusable', () => {
    render(<Switch label="Dark mode" disabled disabledFocusable />);
    const control = screen.getByRole('switch', { name: 'Dark mode' });
    expect(control).not.toBeDisabled();
    expect(control).toHaveAttribute('aria-disabled', 'true');
  });

  it('has the disabled look, forced colors included', () => {
    render(<Switch label="Dark mode" disabledFocusable defaultChecked data-testid="root" />);
    expect(screen.getByTestId('root')).toHaveClass('cursor-not-allowed', 'opacity-50');
    const control = screen.getByRole('switch', { name: 'Dark mode' });
    expect(control).toHaveClass('forced-colors:border-[GrayText]', 'forced-colors:bg-[Canvas]');
    expect(getThumb(control)).toHaveClass('forced-colors:bg-[GrayText]');
  });

  it('is neither submitted nor validated with its form', () => {
    render(
      <form aria-label="Form">
        <Switch name="dark" label="Dark mode" required defaultChecked disabledFocusable />
      </form>,
    );
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect(Array.from(new FormData(form).keys())).toEqual([]);
    expect(form.checkValidity()).toBe(true);
  });

  it('does not block the submission of a required Field', () => {
    renderWithFieldContext(
      <form aria-label="Form">
        <Switch label="Dark mode" disabledFocusable />
      </form>,
      { required: true },
    );
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    expect(form.checkValidity()).toBe(true);
  });

  it('routes a consumer aria-disabled to the switch, which then only carries the attribute', async () => {
    const user = userEvent.setup();
    render(<Switch label="Dark mode" aria-disabled data-testid="root" />);
    const control = screen.getByRole('switch', { name: 'Dark mode' });
    expect(control).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('root')).not.toHaveAttribute('aria-disabled');
    expect(control).not.toHaveAttribute('data-disabled-focusable');
    // Without disabledFocusable, aria-disabled keeps its 0.5 meaning: the look and handlers stay.
    await user.click(control);
    expect(control).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Switch — types', () => {
  it('types disabledFocusable as an optional boolean', () => {
    expectTypeOf<SwitchProps['disabledFocusable']>().toEqualTypeOf<boolean | undefined>();
  });

  it('types label as ReactNode and labelPosition as before/after/above', () => {
    expectTypeOf<SwitchProps['label']>().toEqualTypeOf<React.ReactNode>();
    expectTypeOf<SwitchLabelPosition>().toEqualTypeOf<'before' | 'after' | 'above'>();
    expectTypeOf<SwitchProps['labelPosition']>().toEqualTypeOf<SwitchLabelPosition | undefined>();
    // @ts-expect-error -- Switch labels do not go below the track
    void (<Switch labelPosition="below" />);
  });

  it('declares ref, controlRef and the routed handlers in SwitchProps (C-REF, C-ROUTING)', () => {
    expectTypeOf<SwitchProps['ref']>().toEqualTypeOf<React.Ref<HTMLLabelElement> | undefined>();
    expectTypeOf<SwitchProps['controlRef']>().toEqualTypeOf<
      React.Ref<HTMLButtonElement> | undefined
    >();
    expectTypeOf<SwitchProps['onKeyDown']>().toEqualTypeOf<
      React.KeyboardEventHandler<HTMLButtonElement> | undefined
    >();
    expectTypeOf<SwitchProps['onCheckedChange']>().toEqualTypeOf<
      ((checked: boolean) => void) | undefined
    >();
  });
});
