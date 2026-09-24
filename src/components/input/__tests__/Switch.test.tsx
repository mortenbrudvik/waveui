import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '../Switch';
import type { SwitchProps } from '../Switch';
import {
  renderWithProviders,
  testComposedHandler,
  testFocusEvents,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';
import { renderWithFieldContext, FIELD_TEST_IDS, FIELD_TEST_TEXT } from '../../../test-utils-field';

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
      const deprecations = warn.mock.calls.filter(([msg]) =>
        String(msg).includes('Switch: `onChange` is deprecated'),
      );
      expect(deprecations).toHaveLength(1);
      expect(String(deprecations[0][0])).toContain('Use `onCheckedChange` instead.');
    } finally {
      warn.mockRestore();
    }
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

  it('turns off the track and thumb transitions for reduced motion', () => {
    render(<Switch label="Dark mode" />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    expect(sw).toHaveClass('motion-reduce:transition-none');
    expect(getThumb(sw)).toHaveClass('motion-reduce:transition-none');
  });

  it('mirrors the thumb position under dir="rtl"', () => {
    renderWithProviders(
      <>
        <Switch label="Off" />
        <Switch label="On" defaultChecked />
      </>,
      { dir: 'rtl' },
    );
    expect(getThumb(screen.getByRole('switch', { name: 'Off' }))).toHaveClass(
      'translate-x-[2px]',
      'rtl:-translate-x-[2px]',
    );
    expect(getThumb(screen.getByRole('switch', { name: 'On' }))).toHaveClass(
      'translate-x-[22px]',
      'rtl:-translate-x-[22px]',
    );
  });
});

describe('Switch — types', () => {
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
