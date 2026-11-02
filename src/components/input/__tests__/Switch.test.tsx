import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '../Switch';
import type { SwitchLabelPosition, SwitchProps } from '../Switch';
import { switchClassNames } from '../../../lib/classNames';
import {
  expectInertSlotProps,
  sortAttributes,
  expectNoA11yViolations,
  renderWithProviders,
  testComposedHandler,
  testFocusEvents,
  testNoImplicitSubmit,
  testRootPartRef,
  testSystemProps,
  UNKNOWN_PROP,
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
    ref: 'control',
    control: { role: 'switch', tag: 'button' },
    defaultProps: { label: 'Dark mode' },
    a11yVariants: [
      { name: 'checked', props: { defaultChecked: true } },
      { name: 'disabled', props: { disabled: true } },
      { name: 'required with a name', props: { name: 'dark', required: true } },
      { name: 'label before', props: { labelPosition: 'before' } },
      { name: 'label above', props: { labelPosition: 'above' } },
    ],
  });

  testRootPartRef(Switch, { props: { label: 'Dark mode' } });

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

  it('has no onChange alias of onCheckedChange: the 0.4 name is removed in 1.0', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onCheckedChange = vi.fn();
      render(
        <Switch
          label="Dark mode"
          // @ts-expect-error -- `onChange(checked)` is removed in 1.0: use `onCheckedChange`
          onChange={onChange}
          onCheckedChange={onCheckedChange}
        />,
      );
      await user.click(screen.getByRole('switch', { name: 'Dark mode' }));
      expect(onCheckedChange.mock.calls).toEqual([[true]]);
      expect(onChange).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
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

  it('gives ref the button and slotProps.root.ref the label', () => {
    const ref = React.createRef<HTMLButtonElement>();
    const root = React.createRef<HTMLLabelElement>();
    render(<Switch ref={ref} slotProps={{ root: { ref: root } }} label="Dark mode" />);
    expect(root.current?.tagName).toBe('LABEL');
    expect(ref.current).toBe(screen.getByRole('switch', { name: 'Dark mode' }));
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

// 1.0 (Phase 14, R5): `ref` reaches the role="switch" button, the focusable control; the root
// <label> is `slotProps.root.ref`, and `controlRef` is gone.
describe('Switch — ref reaches the control', () => {
  it('focuses the switch through ref', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Switch ref={ref} label="Dark mode" />);
    act(() => ref.current?.focus());
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toHaveFocus();
  });

  it('gives ref and slotProps.track.ref the same button', () => {
    const ref = React.createRef<HTMLButtonElement>();
    const track = React.createRef<HTMLButtonElement>();
    render(<Switch ref={ref} label="Dark mode" slotProps={{ track: { ref: track } }} />);
    const control = screen.getByRole('switch', { name: 'Dark mode' });
    expect(ref.current).toBe(control);
    expect(track.current).toBe(control);
  });

  it('keeps the invalid focus and the form reset working with an inline ref that changes on every render', async () => {
    const user = userEvent.setup();
    const nodes: (HTMLButtonElement | null)[] = [];
    const ui = (pass: number) => (
      <form aria-label="Form">
        <Switch
          ref={(node) => {
            nodes.push(node);
          }}
          name="dark"
          required
          label="Dark mode"
          data-pass={pass}
        />
      </form>
    );
    const { rerender } = render(ui(0));
    rerender(ui(1));
    rerender(ui(2));
    const control = screen.getByRole('switch', { name: 'Dark mode' });
    expect(nodes.at(-1)).toBe(control);
    const form = screen.getByRole('form', { name: 'Form' }) as HTMLFormElement;
    // The hidden input's invalid event focuses the control through the Switch's own ref.
    act(() => {
      form.reportValidity();
    });
    expect(control).toHaveFocus();
    await user.click(control);
    rerender(ui(3));
    expect(control).toHaveAttribute('aria-checked', 'true');
    act(() => form.reset());
    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(nodes.at(-1)).toBe(control);
  });

  it('attaches a callback ref once, keeps it across renders and detaches it on unmount', () => {
    const ref = vi.fn();
    const { rerender, unmount } = render(<Switch ref={ref} label="Dark mode" />);
    const control = screen.getByRole('switch', { name: 'Dark mode' });
    rerender(<Switch ref={ref} label="Dark mode" defaultChecked />);
    expect(ref.mock.calls).toEqual([[control]]);
    unmount();
    expect(ref.mock.calls).toEqual([[control], [null]]);
  });

  it('in StrictMode, attaches only the control: React detaches and attaches it again on mount, once', () => {
    const ref = vi.fn();
    const { rerender, unmount } = render(
      <React.StrictMode>
        <Switch ref={ref} label="Dark mode" />
      </React.StrictMode>,
    );
    const control = screen.getByRole('switch', { name: 'Dark mode' });
    rerender(
      <React.StrictMode>
        <Switch ref={ref} label="Dark mode" defaultChecked />
      </React.StrictMode>,
    );
    expect(ref.mock.calls).toEqual([[control], [null], [control]]);
    unmount();
    expect(ref).toHaveBeenLastCalledWith(null);
  });

  it('reaches the control the Field label points at', () => {
    const ref = React.createRef<HTMLButtonElement>();
    renderWithFieldContext(<Switch ref={ref} />);
    const fieldLabel = screen.getByText(FIELD_TEST_TEXT.label).closest('label') as HTMLLabelElement;
    expect(ref.current).toBe(screen.getByRole('switch', { name: FIELD_TEST_TEXT.label }));
    expect(ref.current?.id).toBe(fieldLabel.htmlFor);
  });

  it('has no controlRef: TypeScript rejects it, and untyped code puts an unknown prop on the root', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const controlRef = React.createRef<HTMLButtonElement>();
      render(
        <Switch
          label="Dark mode"
          // @ts-expect-error -- `controlRef` is removed in 1.0: `ref` reaches the switch
          controlRef={controlRef}
        />,
      );
      const control = screen.getByRole('switch', { name: 'Dark mode' });
      expect(controlRef.current).toBeNull();
      expect(control.closest('label')).toHaveAttribute('controlref', '[object Object]');
      expect(error.mock.calls).toEqual([UNKNOWN_PROP('controlRef')]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
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
      'wave:bg-transparent',
      'wave:border-stroke-accessible',
      'wave:forced-colors:border-[ButtonText]',
    );
    expect(getThumb(sw)).toHaveClass(
      'wave:bg-stroke-accessible',
      'wave:forced-colors:bg-[ButtonText]',
    );
  });

  it('on: primary track with a primary-foreground thumb', () => {
    render(<Switch label="Dark mode" defaultChecked />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    expect(sw).toHaveClass(
      'wave:bg-primary',
      'wave:border-primary',
      'wave:forced-colors:bg-[Highlight]',
    );
    expect(getThumb(sw)).toHaveClass(
      'wave:bg-primary-foreground',
      'wave:forced-colors:bg-[HighlightText]',
      'wave:forced-colors:forced-color-adjust-none',
    );
  });

  it('forced colors: the track keeps system colors; only the thumb opts out (leaf)', () => {
    render(<Switch label="Dark mode" defaultChecked />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    expect(sw).toHaveClass(
      'wave:forced-colors:border-[Highlight]',
      'wave:forced-colors:bg-[Highlight]',
    );
    expect(sw).not.toHaveClass('wave:forced-colors:forced-color-adjust-none');
  });

  it('forced colors: a disabled switch that is on draws a GrayText thumb and border on Canvas', () => {
    render(<Switch label="Dark mode" defaultChecked disabled />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    expect(sw).toHaveClass(
      'wave:forced-colors:border-[GrayText]',
      'wave:forced-colors:bg-[Canvas]',
    );
    expect(sw).not.toHaveClass('wave:forced-colors:bg-[Highlight]');
    expect(sw).not.toHaveClass('wave:forced-colors:border-[Highlight]');
    expect(getThumb(sw)).toHaveClass(
      'wave:forced-colors:bg-[GrayText]',
      'wave:forced-colors:forced-color-adjust-none',
    );
    expect(getThumb(sw)).not.toHaveClass('wave:forced-colors:bg-[HighlightText]');
  });

  it('forced colors: a disabled switch that is off draws a GrayText thumb and border', () => {
    render(<Switch label="Dark mode" disabled />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    expect(sw).toHaveClass('wave:forced-colors:border-[GrayText]');
    expect(sw).not.toHaveClass('wave:forced-colors:border-[ButtonText]');
    expect(getThumb(sw)).toHaveClass('wave:forced-colors:bg-[GrayText]');
    expect(getThumb(sw)).not.toHaveClass('wave:forced-colors:bg-[ButtonText]');
  });

  it('sizes the track and the thumb in one unit (px), so the thumb fits the track at any root font size', () => {
    /** The value of a `<utility>-[<n>px]` class (not one behind a variant). */
    function px(element: HTMLElement, utility: string): number {
      const match = element.className.match(
        new RegExp(`(?:^|\\s)wave:${utility}-\\[(\\d+(?:\\.\\d+)?)px\\](?=\\s|$)`),
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
    expect(on.className).not.toMatch(/(^|\s)wave:(h|w|size)-\d/);
    expect(on).toHaveClass('wave:border');
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
    expect(screen.getByRole('switch', { name: 'Off' })).toHaveClass(
      'wave:p-0',
      'wave:bg-transparent',
    );
    expect(screen.getByRole('switch', { name: 'On' })).toHaveClass('wave:p-0', 'wave:bg-primary');
  });

  it('draws the label text on the px type ramp like Field and Label (text-body-1)', () => {
    render(<Switch label="Dark mode" />);
    expect(screen.getByText('Dark mode')).toHaveClass('wave:text-body-1');
    expect(screen.getByText('Dark mode')).not.toHaveClass('wave:text-sm');
  });

  it('turns off the track and thumb transitions for reduced motion', () => {
    render(<Switch label="Dark mode" />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    expect(sw).toHaveClass('wave:motion-reduce:transition-none');
    expect(getThumb(sw)).toHaveClass('wave:motion-reduce:transition-none');
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
      'wave:translate-x-[2px]',
      'wave:wave-rtl:-translate-x-[2px]',
    );
    expect(getThumb(screen.getByRole('switch', { name: 'On' }))).toHaveClass(
      'wave:translate-x-[22px]',
      'wave:wave-rtl:-translate-x-[22px]',
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
        expect(element.className, name).not.toMatch(/(^|\s)wave:rtl:/);
      }
    }
    expect(getThumb(screen.getByRole('switch', { name: 'On' }))).toHaveClass(
      'wave:wave-rtl:-translate-x-[22px]',
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
    expect(root).not.toHaveClass('wave:flex-col');
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
      if (column) expect(root).toHaveClass('wave:flex-col', 'wave:items-start', 'wave:gap-1');
      else expect(root).not.toHaveClass('wave:flex-col');
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
      expect(root).toHaveClass('wave:items-start');
      expect(root).not.toHaveClass('wave:items-center');
      expect(root).not.toHaveClass('wave:flex-col');
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
    expect(screen.getByTestId('root')).toHaveClass('wave:cursor-not-allowed', 'wave:opacity-50');
    const control = screen.getByRole('switch', { name: 'Dark mode' });
    expect(control).toHaveClass(
      'wave:forced-colors:border-[GrayText]',
      'wave:forced-colors:bg-[Canvas]',
    );
    expect(getThumb(control)).toHaveClass('wave:forced-colors:bg-[GrayText]');
  });

  it('keeps its focus ring at full strength: the dimmed look lifts while a focus ring shows inside it', () => {
    render(
      <>
        <Switch label="Dark mode" disabledFocusable data-testid="focusable" />
        <Switch label="Compact" data-testid="available" />
      </>,
    );
    // The root's opacity dims the switch's outline too, which would put the ring below 3:1.
    // tailwind-merge keeps both classes (different variants); the variant wins while it matches.
    expect(screen.getByTestId('focusable')).toHaveClass(
      'wave:opacity-50',
      'wave:has-focus-visible:opacity-100',
    );
    expect(screen.getByTestId('available').className).not.toMatch(/opacity/);
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

describe('size (Phase 4 D14)', () => {
  const control = () => screen.getByRole('switch', { name: 'Wi-Fi' });
  const thumb = () => control().firstElementChild as HTMLElement;

  it('medium is the 0.7 look', () => {
    render(<Switch label="Wi-Fi" defaultChecked />);
    expect(control()).toHaveClass('wave:h-[20px]', 'wave:w-[40px]');
    expect(thumb()).toHaveClass(
      'wave:h-[14px]',
      'wave:w-[14px]',
      'wave:translate-x-[22px]',
      'wave:wave-rtl:-translate-x-[22px]',
    );
    expect(control().closest('label')).toHaveAttribute('data-size', 'medium');
  });

  it('small: 32×16 track, 10px thumb, 24px-tall target layer, centred on the label line', () => {
    const { rerender } = render(
      <Switch label="Wi-Fi" size="small" checked={false} onCheckedChange={() => {}} />,
    );
    expect(control()).toHaveClass(
      'wave:h-[16px]',
      'wave:w-[32px]',
      'wave:mt-0.5',
      'wave:before:-inset-y-[5px]',
      'wave:before:inset-x-0',
    );
    expect(thumb()).toHaveClass(
      'wave:h-[10px]',
      'wave:w-[10px]',
      'wave:translate-x-[2px]',
      'wave:wave-rtl:-translate-x-[2px]',
    );
    rerender(<Switch label="Wi-Fi" size="small" checked onCheckedChange={() => {}} />);
    expect(thumb()).toHaveClass('wave:translate-x-[18px]', 'wave:wave-rtl:-translate-x-[18px]');
  });

  it('small with the label above: no offset (the column gap alone, 4px); beside it, the offset', () => {
    const { rerender } = render(<Switch label="Wi-Fi" size="small" labelPosition="above" />);
    expect(control().closest('label')).toHaveClass('wave:flex-col', 'wave:gap-1');
    expect(control()).toHaveClass('wave:h-[16px]', 'wave:w-[32px]');
    expect(control()).not.toHaveClass('wave:mt-0.5');
    rerender(<Switch label="Wi-Fi" size="small" labelPosition="before" />);
    expect(control()).toHaveClass('wave:mt-0.5');
  });

  it('mirrors the small thumb in RTL through the wave-rtl classes', () => {
    renderWithProviders(<Switch label="Wi-Fi" size="small" defaultChecked />, { dir: 'rtl' });
    expect(thumb()).toHaveClass('wave:wave-rtl:-translate-x-[18px]');
  });

  it('renders and reports the default for a size from untyped code', () => {
    // @ts-expect-error Switch has no large size
    render(<Switch label="Wi-Fi" size="large" />);
    expect(control()).toHaveClass('wave:h-[20px]', 'wave:w-[40px]');
    expect(control().closest('label')).toHaveAttribute('data-size', 'medium');
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

  it('declares ref (for the button) and the routed handlers in SwitchProps, and no controlRef (C-REF, C-ROUTING)', () => {
    expectTypeOf<SwitchProps['ref']>().toEqualTypeOf<React.Ref<HTMLButtonElement> | undefined>();
    expectTypeOf<SwitchProps>().not.toHaveProperty('controlRef');
    const labelRef = React.createRef<HTMLLabelElement>();
    // @ts-expect-error -- in 1.0 `ref` reaches the role="switch" button; the label is slotProps.root.ref
    void (<Switch ref={labelRef} />);
    expectTypeOf<SwitchProps['onKeyDown']>().toEqualTypeOf<
      React.KeyboardEventHandler<HTMLButtonElement> | undefined
    >();
    expectTypeOf<SwitchProps['onCheckedChange']>().toEqualTypeOf<
      ((checked: boolean) => void) | undefined
    >();
  });
});

describe('Switch — slotProps', () => {
  type SwitchSlotProps = NonNullable<SwitchProps['slotProps']>;
  const EVERY_PART: SwitchSlotProps = { root: {}, track: {}, thumb: {}, label: {} };

  it('renders the 0.17.1 markup without slotProps (attributes compared in sorted order)', () => {
    // Captured from 17abc07: the merged props may put the class before the locked attributes.
    expect(
      sortAttributes(
        renderToString(<Switch label="Dark mode" defaultChecked aria-describedby="hint" />),
      ),
    ).toBe(
      [
        '<label class="wave-switch wave:relative wave:inline-flex wave:items-start wave:gap-2 wave:select-none wave:cursor-pointer" data-label-position="after" data-size="medium">',
        '<button aria-checked="true" aria-describedby="hint" aria-labelledby="switch-label-_R_0H1_" class="wave-switch__track wave:relative wave:inline-flex wave:shrink-0 wave:items-center wave:rounded-full wave:border wave:p-0 wave:transition-colors wave:duration-200 wave:motion-reduce:transition-none wave:h-[20px] wave:w-[40px] wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:border-primary wave:bg-primary wave:forced-colors:border-[Highlight] wave:forced-colors:bg-[Highlight]" id="switch-_R_0_" role="switch" type="button">',
        '<span aria-hidden="true" class="wave-switch__thumb wave:block wave:rounded-full wave:transition-transform wave:duration-200 wave:motion-reduce:transition-none wave:forced-colors:forced-color-adjust-none wave:h-[14px] wave:w-[14px] wave:translate-x-[22px] wave:wave-rtl:-translate-x-[22px] wave:bg-primary-foreground wave:forced-colors:bg-[HighlightText]">',
        '</span>',
        '</button>',
        '<span class="wave-switch__label wave:text-body-1 wave:text-foreground" id="switch-label-_R_0H1_">Dark mode',
        '</span>',
        '</label>',
      ].join(''),
    );
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    const cases: SwitchProps[] = [
      { label: 'Dark mode' },
      { label: 'Dark mode', labelPosition: 'before', defaultChecked: true },
      { label: 'Dark mode', disabledFocusable: true, size: 'small', 'aria-describedby': 'd' },
      { 'aria-label': 'Dark mode', disabled: true, id: 'own', tabIndex: 0 },
      // The root's own props: the rest, the style and the hidden state.
      {
        label: 'Dark mode',
        labelPosition: 'above',
        className: 'c',
        style: { color: 'red' },
        title: 't',
        hidden: true,
        inert: true,
        'aria-hidden': true,
        onPointerDown: () => {},
      },
    ];
    for (const props of cases) {
      expectInertSlotProps((slotProps) => <Switch {...props} slotProps={slotProps} />, EVERY_PART);
    }
  });

  it('puts your className, style and data-* on each part, after its stable class and own classes', () => {
    render(
      <Switch
        label="Dark mode"
        slotProps={{
          track: { className: 'my-track', style: { width: 50 }, 'data-part': 'track' },
          thumb: { className: 'my-thumb', style: { opacity: 0.5 }, 'data-part': 'thumb' },
          label: { className: 'my-label', style: { color: 'red' }, 'data-part': 'label' },
        }}
      />,
    );
    const track = screen.getByRole('switch', { name: 'Dark mode' });
    const thumb = getThumb(track);
    const label = screen.getByText('Dark mode');
    for (const [element, stable, own, mine, part] of [
      [track, switchClassNames.track, 'wave:rounded-full', 'my-track', 'track'],
      [thumb, switchClassNames.thumb, 'wave:block', 'my-thumb', 'thumb'],
      [label, switchClassNames.label, 'wave:text-body-1', 'my-label', 'label'],
    ] as const) {
      expect(element).toHaveClass(stable, own, mine);
      expect(element.classList[0]).toBe(stable);
      expect(element.classList[element.classList.length - 1]).toBe(mine);
      expect(element).toHaveAttribute('data-part', part);
    }
    expect(track).toHaveStyle({ width: '50px' });
    expect(thumb).toHaveStyle({ opacity: '0.5' });
    expect(label).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('lets your class replace a conflicting class of the part', () => {
    render(<Switch label="Dark mode" slotProps={{ track: { className: 'rounded-none' } }} />);
    const track = screen.getByRole('switch', { name: 'Dark mode' });
    expect(track).toHaveClass('rounded-none');
    expect(track).not.toHaveClass('wave:rounded-full');
  });

  it('attaches your refs to the parts, beside ref', () => {
    const root = React.createRef<HTMLLabelElement>();
    const track = React.createRef<HTMLButtonElement>();
    const thumb = React.createRef<HTMLSpanElement>();
    const label = React.createRef<HTMLSpanElement>();
    const ref = React.createRef<HTMLButtonElement>();
    render(
      <Switch
        ref={ref}
        label="Dark mode"
        slotProps={{
          root: { ref: root },
          track: { ref: track },
          thumb: { ref: thumb },
          label: { ref: label },
        }}
      />,
    );
    const control = screen.getByRole('switch', { name: 'Dark mode' });
    expect(track.current).toBe(control);
    expect(ref.current).toBe(control);
    expect(thumb.current).toBe(getThumb(control));
    expect(label.current).toBe(screen.getByText('Dark mode'));
    expect(root.current).toBe(control.closest('label'));
  });

  it("runs your track onClick first, then the Switch's onClick and the toggle", async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    render(
      <Switch
        label="Dark mode"
        onClick={() => order.push('onClick')}
        onCheckedChange={() => order.push('toggle')}
        slotProps={{ track: { onClick: () => order.push('part') } }}
      />,
    );
    await user.click(screen.getByRole('switch', { name: 'Dark mode' }));
    expect(order).toEqual(['part', 'onClick', 'toggle']);
  });

  it("skips the Switch's onClick and the toggle when your track onClick prevents the default", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onCheckedChange = vi.fn();
    render(
      <Switch
        label="Dark mode"
        onClick={onClick}
        onCheckedChange={onCheckedChange}
        slotProps={{ track: { onClick: (event) => event.preventDefault() } }}
      />,
    );
    const track = screen.getByRole('switch', { name: 'Dark mode' });
    await user.click(track);
    expect(track).toHaveAttribute('aria-checked', 'false');
    expect(onClick).not.toHaveBeenCalled();
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('calls your onClick and onCheckedChange once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onCheckedChange = vi.fn();
    render(
      <React.StrictMode>
        <Switch
          label="Dark mode"
          onCheckedChange={onCheckedChange}
          slotProps={{ track: { onClick } }}
        />
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('switch', { name: 'Dark mode' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('runs your focus and key handlers before the Switch ones', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    render(
      <Switch
        label="Dark mode"
        onFocus={() => order.push('onFocus')}
        onKeyDown={() => order.push('onKeyDown')}
        slotProps={{
          track: {
            onFocus: () => order.push('part focus'),
            onKeyDown: () => order.push('part key'),
          },
        }}
      />,
    );
    await user.tab();
    await user.keyboard('a');
    expect(order).toEqual(['part focus', 'onFocus', 'part key', 'onKeyDown']);
  });

  it('does not call your track onClick under disabledFocusable, nor toggle (StrictMode)', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onCheckedChange = vi.fn();
    const onFocus = vi.fn();
    render(
      <React.StrictMode>
        <Switch
          label="Dark mode"
          disabledFocusable
          onCheckedChange={onCheckedChange}
          slotProps={{ track: { onClick, onFocus } }}
        />
      </React.StrictMode>,
    );
    const track = screen.getByRole('switch', { name: 'Dark mode' });
    await user.click(track);
    await user.keyboard(' ');
    expect(onClick).not.toHaveBeenCalled();
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(track).toHaveAttribute('aria-checked', 'false');
    // Its other handlers still run, as the Switch's own do.
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('keeps the locked attributes of the track; your ids join its aria-labelledby and aria-describedby', () => {
    render(
      <>
        <span id="extra-name">Extra</span>
        <span id="extra-description">More</span>
        <span id="own-description">Own</span>
        <Switch
          label="Dark mode"
          disabled
          aria-describedby="own-description"
          slotProps={{
            track: {
              id: 'mine',
              role: 'checkbox',
              type: 'submit',
              tabIndex: 3,
              disabled: false,
              autoFocus: true,
              'aria-label': 'Other',
              'aria-invalid': true,
              'aria-checked': 'mixed',
              'aria-labelledby': 'extra-name',
              'aria-describedby': 'extra-description',
            },
          }}
        />
      </>,
    );
    const track = screen.getByRole('switch', { name: 'Dark mode Extra' });
    const labelId = screen.getByText('Dark mode').id;
    expect(track.id).toMatch(/^switch-/);
    expect(track).toHaveAttribute('type', 'button');
    expect(track).not.toHaveAttribute('tabindex');
    expect(track).toBeDisabled();
    expect(track).not.toHaveFocus();
    expect(track).toHaveAttribute('aria-checked', 'false');
    expect(track).not.toHaveAttribute('aria-label');
    expect(track).not.toHaveAttribute('aria-invalid');
    expect(track).toHaveAttribute('aria-labelledby', `${labelId} extra-name`);
    expect(track).toHaveAttribute('aria-describedby', 'own-description extra-description');
  });

  it('keeps the thumb decorative and the label id that names the control', () => {
    render(
      <Switch
        label="Dark mode"
        slotProps={{ thumb: { 'aria-hidden': false }, label: { id: 'mine' } }}
      />,
    );
    const track = screen.getByRole('switch', { name: 'Dark mode' });
    expect(getThumb(track)).toHaveAttribute('aria-hidden', 'true');
    const label = screen.getByText('Dark mode');
    expect(label.id).not.toBe('mine');
    expect(track).toHaveAttribute('aria-labelledby', label.id);
  });

  it('adds the attributes the Switch does not set, such as a title', () => {
    render(<Switch label="Dark mode" slotProps={{ track: { title: 'Toggle the theme' } }} />);
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toHaveAttribute(
      'title',
      'Toggle the theme',
    );
  });

  it('ignores the label part without a label', () => {
    const label = React.createRef<HTMLSpanElement>();
    render(
      <Switch
        aria-label="Dark mode"
        slotProps={{ label: { ref: label, className: 'my-label' } }}
      />,
    );
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeInTheDocument();
    expect(label.current).toBeNull();
    expect(document.querySelector('.my-label')).toBeNull();
  });

  it('keeps the mirrored thumb classes under dir="rtl" next to yours', () => {
    renderWithProviders(
      <Switch label="Dark mode" slotProps={{ thumb: { className: 'my-thumb' } }} />,
      { dir: 'rtl' },
    );
    expect(getThumb(screen.getByRole('switch', { name: 'Dark mode' }))).toHaveClass(
      'wave:translate-x-[2px]',
      'wave:wave-rtl:-translate-x-[2px]',
      'my-thumb',
    );
  });

  it('keeps its form and visibility: a part sets no form, hidden or aria-hidden on the switch', async () => {
    const user = userEvent.setup();
    render(
      <>
        <form aria-label="Settings">
          <Switch
            label="Dark mode"
            name="dark"
            slotProps={{ track: { form: 'elsewhere', hidden: true, 'aria-hidden': true } }}
          />
        </form>
        <form id="elsewhere" aria-label="Elsewhere" />
      </>,
    );
    const control = screen.getByRole('switch', { name: 'Dark mode' });
    expect(control).not.toHaveAttribute('form');
    expect(control).not.toHaveAttribute('hidden');
    expect(control).not.toHaveAttribute('aria-hidden');
    // It resets with the form it is in, the one its hidden input submits with.
    await user.click(control);
    const form = screen.getByRole('form', { name: 'Settings' }) as HTMLFormElement;
    expect([...new FormData(form).keys()]).toEqual(['dark']);
    act(() => form.reset());
    expect(control).toHaveAttribute('aria-checked', 'false');
  });

  it.each([
    ['enabled', {}, 1],
    ['disabled', { disabled: true }, 0],
    ['disabledFocusable', { disabledFocusable: true }, 0],
  ] as const)(
    'calls your label and thumb onClick only while the switch is enabled (%s)',
    (_, state, calls) => {
      const labelClick = vi.fn();
      const thumbClick = vi.fn();
      render(
        <Switch
          label="Dark mode"
          {...state}
          slotProps={{ label: { onClick: labelClick }, thumb: { onClick: thumbClick } }}
        />,
      );
      const track = screen.getByRole('switch', { name: 'Dark mode' });
      fireEvent.click(screen.getByText('Dark mode'));
      fireEvent.click(getThumb(track));
      expect(labelClick).toHaveBeenCalledTimes(calls);
      expect(thumbClick).toHaveBeenCalledTimes(calls);
    },
  );

  it('keeps the label text naming the switch: a part sets no aria-label on it', () => {
    render(<Switch label="Dark mode" slotProps={{ label: { 'aria-label': 'Other' } }} />);
    expect(screen.getByText('Dark mode')).not.toHaveAttribute('aria-label');
    expect(screen.getByRole('switch')).toHaveAccessibleName('Dark mode');
  });

  it('keeps the thumb out of the tab order and the track reachable: no tabIndex or inert from a part', () => {
    render(
      <Switch label="Dark mode" slotProps={{ thumb: { tabIndex: 0 }, track: { inert: true } }} />,
    );
    const track = screen.getByRole('switch', { name: 'Dark mode' });
    expect(getThumb(track)).not.toHaveAttribute('tabindex');
    expect(track).not.toHaveAttribute('inert');
  });

  it('has no accessibility violations with every part customised', async () => {
    render(
      <Switch
        label="Dark mode"
        slotProps={{
          track: { className: 'my-track', title: 'Theme' },
          thumb: { className: 'my-thumb' },
          label: { className: 'my-label' },
        }}
      />,
    );
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof SwitchSlotProps>().toEqualTypeOf<'root' | 'track' | 'thumb' | 'label'>();
    expectTypeOf<NonNullable<SwitchSlotProps['root']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLLabelElement> | undefined
    >();
    expectTypeOf<NonNullable<SwitchSlotProps['track']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLButtonElement> | undefined
    >();
    expectTypeOf<NonNullable<SwitchSlotProps['thumb']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<SwitchSlotProps['label']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    // @ts-expect-error -- a part takes no children: the Switch draws its content
    void (<Switch slotProps={{ label: { children: 'Other' } }} />);
    // @ts-expect-error -- a part takes no children: the Switch draws its content
    void (<Switch slotProps={{ root: { children: 'Other' } }} />);
  });

  describe('the root part', () => {
    const control = () => screen.getByRole('switch', { name: 'Dark mode', hidden: true });
    const root = () => control().closest('label') as HTMLElement;

    it("puts your className, style, data-* and attributes on the root <label>, after the Switch's className and style", () => {
      render(
        <Switch
          label="Dark mode"
          className="mine"
          style={{ color: 'red', width: 10 }}
          slotProps={{
            root: { className: 'my-root', style: { width: 20 }, 'data-part': 'root', title: 'R' },
          }}
        />,
      );
      expect(root().classList[0]).toBe(switchClassNames.root);
      expect(root().className).toMatch(/ mine my-root$/);
      expect(root()).toHaveStyle({ color: 'rgb(255, 0, 0)', width: '20px' });
      expect(root()).toHaveAttribute('data-part', 'root');
      expect(root()).toHaveAttribute('title', 'R');
      expect(control()).not.toHaveAttribute('data-part');
    });

    it('lets your class replace a conflicting class of the root', () => {
      render(<Switch label="Dark mode" slotProps={{ root: { className: 'items-center' } }} />);
      expect(root()).toHaveClass('items-center');
      expect(root()).not.toHaveClass('wave:items-start');
    });

    it("keeps the props you give the Switch over the part's", () => {
      render(
        <Switch
          label="Dark mode"
          title="Own"
          data-x="own"
          slotProps={{ root: { title: 'Part', 'data-x': 'part' } }}
        />,
      );
      expect(root()).toHaveAttribute('title', 'Own');
      expect(root()).toHaveAttribute('data-x', 'own');
    });

    it('keeps its data attributes and its hidden state: a part changes none of them', () => {
      const { rerender } = render(
        <Switch
          label="Dark mode"
          size="small"
          labelPosition="above"
          slotProps={{
            root: {
              'data-size': 'medium',
              'data-label-position': 'after',
              hidden: true,
              inert: true,
              'aria-hidden': true,
            },
          }}
        />,
      );
      expect(root()).toHaveAttribute('data-size', 'small');
      expect(root()).toHaveAttribute('data-label-position', 'above');
      for (const attribute of ['hidden', 'inert', 'aria-hidden']) {
        expect(root()).not.toHaveAttribute(attribute);
      }
      // The Switch's own hidden state stays its own.
      rerender(<Switch label="Dark mode" hidden slotProps={{ root: { hidden: false } }} />);
      expect(root()).toHaveAttribute('hidden');
    });

    // State-off lock: the root has no `for` of its own (it labels the switch it holds), so a
    // part's `htmlFor` would be the only one and would send the text's clicks to another element.
    it('keeps a part from giving the root a for: a click on the text still toggles the switch once', async () => {
      const user = userEvent.setup();
      const onCheckedChange = vi.fn();
      const { rerender } = render(
        <>
          <input type="checkbox" id="decoy" aria-label="Decoy" />
          <Switch
            label="Dark mode"
            onCheckedChange={onCheckedChange}
            slotProps={{ root: { htmlFor: 'decoy' } }}
          />
        </>,
      );
      expect(root()).not.toHaveAttribute('for');
      await user.click(screen.getByText('Dark mode'));
      expect(onCheckedChange.mock.calls).toEqual([[true]]);
      expect(screen.getByRole('checkbox', { name: 'Decoy' })).not.toBeChecked();
      // A `for` given to the Switch itself (untyped code) still reaches the root, as in 0.18.
      rerender(
        <>
          <input type="checkbox" id="decoy" aria-label="Decoy" />
          <Switch label="Dark mode" {...({ htmlFor: 'decoy' } as object)} />
        </>,
      );
      expect(root()).toHaveAttribute('for', 'decoy');
    });

    it("runs your root handlers before the Switch's own; preventDefault() in yours skips its own", () => {
      const order: string[] = [];
      const { rerender } = render(
        <Switch
          label="Dark mode"
          onPointerDown={() => order.push('own')}
          slotProps={{ root: { onPointerDown: () => order.push('part') } }}
        />,
      );
      fireEvent.pointerDown(root());
      expect(order).toEqual(['part', 'own']);
      rerender(
        <Switch
          label="Dark mode"
          onPointerDown={() => order.push('own')}
          slotProps={{ root: { onPointerDown: (event) => event.preventDefault() } }}
        />,
      );
      fireEvent.pointerDown(root());
      expect(order).toEqual(['part', 'own']);
    });

    // A click on the label text reaches the root, then the <label> passes it to the switch, whose
    // own click bubbles to the root again: the browser's label behaviour. The toggle happens once.
    it('toggles once per click on the text or the switch and per Space, your root onClick seeing each click as it bubbles (StrictMode)', async () => {
      const user = userEvent.setup();
      const onCheckedChange = vi.fn();
      const targets: EventTarget[] = [];
      render(
        <React.StrictMode>
          <Switch
            label="Dark mode"
            onCheckedChange={onCheckedChange}
            slotProps={{ root: { onClick: (event) => targets.push(event.target) } }}
          />
        </React.StrictMode>,
      );
      const text = screen.getByText('Dark mode');
      await user.click(text);
      expect(targets).toEqual([text, control()]);
      expect(onCheckedChange.mock.calls).toEqual([[true]]);
      targets.length = 0;
      await user.click(getThumb(control()));
      expect(targets).toEqual([getThumb(control())]);
      await user.keyboard(' ');
      expect(targets).toEqual([getThumb(control()), control()]);
      expect(onCheckedChange.mock.calls).toEqual([[true], [false], [true]]);
    });

    it('keeps the label text from toggling when your root onClick prevents the default; the switch handles its own click first', async () => {
      const user = userEvent.setup();
      const onCheckedChange = vi.fn();
      render(
        <Switch
          label="Dark mode"
          onCheckedChange={onCheckedChange}
          slotProps={{ root: { onClick: (event) => event.preventDefault() } }}
        />,
      );
      await user.click(screen.getByText('Dark mode'));
      expect(control()).toHaveAttribute('aria-checked', 'false');
      expect(onCheckedChange).not.toHaveBeenCalled();
      await user.click(control());
      expect(onCheckedChange.mock.calls).toEqual([[true]]);
    });

    it.each([
      ['disabled', { disabled: true }],
      ['disabledFocusable', { disabledFocusable: true }],
    ] as const)('neither calls your root onClick nor toggles while %s', async (_, state) => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onCheckedChange = vi.fn();
      render(
        <Switch
          label="Dark mode"
          {...state}
          onCheckedChange={onCheckedChange}
          slotProps={{ root: { onClick } }}
        />,
      );
      await user.click(screen.getByText('Dark mode'));
      fireEvent.click(root());
      fireEvent.click(control());
      if ('disabledFocusable' in state) {
        act(() => control().focus());
        await user.keyboard(' ');
      }
      expect(onClick).not.toHaveBeenCalled();
      expect(onCheckedChange).not.toHaveBeenCalled();
      expect(control()).toHaveAttribute('aria-checked', 'false');
    });

    it('has no accessibility violations with the root customised', async () => {
      render(
        <Switch
          label="Dark mode"
          slotProps={{ root: { className: 'my-root', title: 'Theme' }, track: { title: 'Track' } }}
        />,
      );
      await expectNoA11yViolations();
    });
  });
});
