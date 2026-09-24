import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import {
  FieldContext,
  createFieldControlIdClaim,
  useFieldContext,
  useFieldControl,
  type FieldContextValue,
  type FieldControlIdClaim,
  type FieldControlProps,
  type UseFieldControlOptions,
} from '../useFieldControl';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../test-utils-field';

const FIELD: FieldContextValue = {
  controlId: 'ctl',
  labelId: 'lbl',
  hintId: 'hint',
  errorId: undefined,
  invalid: false,
  required: false,
  hasErrorMessage: false,
};

function withField(value: FieldContextValue | null) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <FieldContext.Provider value={value}>{children}</FieldContext.Provider>;
  };
}

function merge(
  props: FieldControlProps,
  field: FieldContextValue | null,
  options?: UseFieldControlOptions,
): FieldControlProps {
  return renderHook(() => useFieldControl(props, options), { wrapper: withField(field) }).result
    .current;
}

/* ------------------------------------------------------------------ */
/*  Probes: minimal controls that spread the merged props              */
/* ------------------------------------------------------------------ */

function ButtonControl(props: FieldControlProps & { role?: string }) {
  const { role = 'checkbox', ...rest } = props;
  const field = useFieldControl(rest);
  return <button type="button" role={role} aria-checked="false" {...field} />;
}

function GroupControl(props: FieldControlProps) {
  const field = useFieldControl(props, { labelable: false });
  return (
    <div role="radiogroup" {...field}>
      <button type="button" role="radio" aria-checked="false">
        One
      </button>
    </div>
  );
}

function InputControl(props: FieldControlProps) {
  const field = useFieldControl(props, { nativeRequired: true });
  return <input {...field} />;
}

describe('useFieldControl — merge rules', () => {
  it('outside a Field returns only the defined consumer keys', () => {
    expect(merge({}, null)).toEqual({});
    const result = merge({ id: 'x', 'aria-label': 'Name', 'aria-describedby': 'd' }, null);
    expect(result).toEqual({ id: 'x', 'aria-label': 'Name', 'aria-describedby': 'd' });
    expect(Object.values(result)).not.toContain(undefined);
  });

  it('never returns keys whose value is undefined', () => {
    const result = merge({}, { ...FIELD, hintId: undefined, labelId: undefined });
    expect(Object.entries(result).filter(([, v]) => v === undefined)).toEqual([]);
    expect(result).toEqual({ id: 'ctl' });
  });

  it('uses the Field controlId as id; the consumer id wins', () => {
    expect(merge({}, FIELD).id).toBe('ctl');
    expect(merge({ id: 'own' }, FIELD).id).toBe('own');
  });

  it('labelable control whose id is the controlId: named by <label htmlFor>, no aria-labelledby', () => {
    expect(merge({}, FIELD)['aria-labelledby']).toBeUndefined();
    expect(merge({ 'aria-labelledby': 'x' }, FIELD)['aria-labelledby']).toBe('x');
  });

  it('non-labelable control: aria-labelledby = consumer ids + field labelId', () => {
    expect(merge({}, FIELD, { labelable: false })['aria-labelledby']).toBe('lbl');
    expect(merge({ 'aria-labelledby': 'x' }, FIELD, { labelable: false })['aria-labelledby']).toBe(
      'x lbl',
    );
  });

  it('id mismatch (own id, or not the first child) adds aria-labelledby = labelId', () => {
    expect(merge({ id: 'own' }, FIELD)['aria-labelledby']).toBe('lbl');
    expect(merge({ id: 'own', 'aria-labelledby': 'lbl' }, FIELD)['aria-labelledby']).toBe('lbl');
  });

  it('an aria-label suppresses the added labelledby (the consumer named the control)', () => {
    const result = merge({ 'aria-label': 'Custom' }, FIELD, { labelable: false });
    expect(result['aria-labelledby']).toBeUndefined();
    expect(result['aria-label']).toBe('Custom');
    expect(merge({ 'aria-label': 'C', 'aria-labelledby': 'x' }, FIELD)['aria-labelledby']).toBe(
      'x',
    );
  });

  it('a Field without a label adds no aria-labelledby', () => {
    expect(
      merge({}, { ...FIELD, labelId: undefined }, { labelable: false })['aria-labelledby'],
    ).toBeUndefined();
  });

  it('aria-describedby joins consumer, error and hint ids (deduplicated)', () => {
    const field = { ...FIELD, errorId: 'err' };
    expect(merge({}, field)['aria-describedby']).toBe('err hint');
    expect(merge({ 'aria-describedby': 'mine hint' }, field)['aria-describedby']).toBe(
      'mine hint err',
    );
  });

  it('aria-invalid / aria-required come from the field; consumer values win', () => {
    const field = { ...FIELD, invalid: true, required: true };
    expect(merge({}, field)).toMatchObject({ 'aria-invalid': true, 'aria-required': true });
    expect(merge({ 'aria-invalid': false, 'aria-required': false }, field)).toMatchObject({
      'aria-invalid': false,
      'aria-required': false,
    });
    const plain = merge({}, FIELD);
    expect('aria-invalid' in plain).toBe(false);
    expect('aria-required' in plain).toBe(false);
  });

  it('required is returned only with nativeRequired', () => {
    const field = { ...FIELD, required: true };
    expect('required' in merge({}, field)).toBe(false);
    expect('required' in merge({ required: true }, field)).toBe(false);
    expect(merge({}, field, { nativeRequired: true }).required).toBe(true);
    expect(merge({ required: false }, field, { nativeRequired: true }).required).toBe(false);
    expect('required' in merge({}, FIELD, { nativeRequired: true })).toBe(false);
    expect(merge({ required: true }, null, { nativeRequired: true }).required).toBe(true);
  });

  it('controlIdAssigned: a control without an id gets its own id and aria-labelledby = labelId', () => {
    const assigned = { ...FIELD, controlIdAssigned: true };
    const nested = merge({}, assigned);
    expect(nested.id).toMatch(/^field-control-/);
    expect(nested.id).not.toBe('ctl');
    expect(nested['aria-labelledby']).toBe('lbl');
    expect(merge({ 'aria-labelledby': 'x' }, assigned)['aria-labelledby']).toBe('x lbl');
    // The consumer named the control: no added labelledby, but the id is still its own.
    const named = merge({ 'aria-label': 'Custom' }, assigned);
    expect(named.id).not.toBe('ctl');
    expect(named['aria-labelledby']).toBeUndefined();
  });

  it('controlIdAssigned: the first child (id = controlId) and an own id are unchanged', () => {
    const assigned = { ...FIELD, controlIdAssigned: true };
    const target = merge({ id: 'ctl' }, assigned);
    expect(target.id).toBe('ctl');
    expect(target['aria-labelledby']).toBeUndefined();
    const own = merge({ id: 'own' }, assigned);
    expect(own.id).toBe('own');
    expect(own['aria-labelledby']).toBe('lbl');
  });

  it('controlIdAssigned false or absent keeps controlId as the default id', () => {
    for (const field of [{ ...FIELD, controlIdAssigned: false }, FIELD]) {
      expect(merge({}, field)).toEqual({ id: 'ctl', 'aria-describedby': 'hint' });
    }
  });

  it('keeps a stable hook order and fallback id while controlIdAssigned changes', () => {
    const seen: (string | undefined)[] = [];
    function Probe() {
      const props = useFieldControl({});
      seen.push(props.id);
      return <input {...props} />;
    }
    const at = (controlIdAssigned: boolean | undefined) => (
      <FieldContext.Provider value={{ ...FIELD, controlIdAssigned }}>
        <Probe />
      </FieldContext.Provider>
    );
    const { rerender } = render(at(true));
    const fallback = screen.getByRole('textbox').id;
    expect(fallback).not.toBe('ctl');
    rerender(at(undefined));
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'ctl');
    rerender(at(true));
    expect(screen.getByRole('textbox')).toHaveAttribute('id', fallback);
    expect(new Set(seen)).toEqual(new Set([fallback, 'ctl']));
  });

  it('useFieldContext is null outside a Field and the value inside', () => {
    expect(renderHook(() => useFieldContext()).result.current).toBeNull();
    expect(renderHook(() => useFieldContext(), { wrapper: withField(FIELD) }).result.current).toBe(
      FIELD,
    );
  });
});

describe('useFieldControl — accessible name and description (renderWithFieldContext)', () => {
  it('a labelable control is named by the label via htmlFor', () => {
    renderWithFieldContext(<ButtonControl />);
    expect(screen.getByRole('checkbox', { name: FIELD_TEST_TEXT.label })).toHaveAttribute(
      'id',
      FIELD_TEST_IDS.controlId,
    );
  });

  it('a non-labelable group is named through aria-labelledby', () => {
    renderWithFieldContext(<GroupControl />);
    expect(screen.getByRole('radiogroup', { name: FIELD_TEST_TEXT.label })).toBeInTheDocument();
  });

  it('a control carrying its own id is still named (id mismatch → aria-labelledby)', () => {
    renderWithFieldContext(<InputControl id="own-id" />);
    const input = screen.getByRole('textbox', { name: FIELD_TEST_TEXT.label });
    expect(input).toHaveAttribute('id', 'own-id');
  });

  it('hint and error describe the control; invalid and required reach it', () => {
    renderWithFieldContext(<ButtonControl />, {
      hintId: FIELD_TEST_IDS.hintId,
      errorId: FIELD_TEST_IDS.errorId,
      required: true,
    });
    const control = screen.getByRole('checkbox', { name: FIELD_TEST_TEXT.label });
    expect(control).toHaveAccessibleDescription(`${FIELD_TEST_TEXT.error} ${FIELD_TEST_TEXT.hint}`);
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAttribute('aria-required', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(FIELD_TEST_TEXT.error);
  });

  it('nativeRequired sets the native required attribute so constraint validation runs', () => {
    renderWithFieldContext(<InputControl />, { required: true });
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: FIELD_TEST_TEXT.label });
    expect(input).toBeRequired();
    expect(input.validity.valueMissing).toBe(true);
  });

  it('a consumer aria-label replaces the Field label as the name', () => {
    renderWithFieldContext(<GroupControl aria-label="Custom name" />);
    expect(screen.getByRole('radiogroup', { name: 'Custom name' })).toBeInTheDocument();
  });

  it('does not reuse controlId when Field already gave it to its first child', () => {
    function Probe(props: FieldControlProps) {
      return <input {...useFieldControl(props)} />;
    }
    renderWithFieldContext(
      <>
        <Probe />
        <Probe id={FIELD_TEST_IDS.controlId} />
        <Probe id="own" />
      </>,
      { controlIdAssigned: true },
    );
    const [nested, target, own] = screen.getAllByRole('textbox');
    expect(nested.id).not.toBe(FIELD_TEST_IDS.controlId);
    expect(nested).toHaveAttribute('aria-labelledby', FIELD_TEST_IDS.labelId);
    expect(target).toHaveAttribute('id', FIELD_TEST_IDS.controlId);
    expect(target).not.toHaveAttribute('aria-labelledby');
    expect(own).toHaveAttribute('aria-labelledby', FIELD_TEST_IDS.labelId);
  });

  it('controlIdAssigned: every control is named and described, and no id is duplicated', () => {
    renderWithFieldContext(
      <>
        <InputControl id={FIELD_TEST_IDS.controlId} />
        <InputControl />
        <ButtonControl />
      </>,
      { controlIdAssigned: true, hintId: FIELD_TEST_IDS.hintId },
    );
    const controls = [
      ...screen.getAllByRole('textbox', { name: FIELD_TEST_TEXT.label }),
      screen.getByRole('checkbox', { name: FIELD_TEST_TEXT.label }),
    ];
    expect(controls).toHaveLength(3);
    for (const control of controls) {
      expect(control).toHaveAccessibleDescription(FIELD_TEST_TEXT.hint);
    }
    for (const el of document.querySelectorAll('[id]')) {
      expect(document.querySelectorAll(`[id="${CSS.escape(el.id)}"]`), el.id).toHaveLength(1);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  controlIdClaim: one control inside a left-alone wrapper takes      */
/*  the controlId                                                      */
/* ------------------------------------------------------------------ */

/** Every `id` that more than one element in the document carries. */
function duplicateIds(): string[] {
  const counts = new Map<string, number>();
  for (const el of document.querySelectorAll('[id]')) {
    counts.set(el.id, (counts.get(el.id) ?? 0) + 1);
  }
  return [...counts].filter(([, count]) => count > 1).map(([id]) => id);
}

/**
 * Stand-in for a `Field` that leaves its first child alone (a plain `<div>`, a Fragment): a real
 * label and hint, and a context carrying a claim, the way `Field` provides it.
 */
function ClaimingField({
  children,
  claim,
}: {
  children: React.ReactNode;
  claim?: FieldControlIdClaim;
}) {
  const [ownClaim] = React.useState(createFieldControlIdClaim);
  const controlIdClaim = claim ?? ownClaim;
  const value = React.useMemo<FieldContextValue>(
    () => ({ ...FIELD, controlIdClaim }),
    [controlIdClaim],
  );
  return (
    <div>
      <label id="lbl" htmlFor="ctl">
        Price range
      </label>
      <FieldContext.Provider value={value}>{children}</FieldContext.Provider>
      <p id="hint">In euros</p>
    </div>
  );
}

function Probe({
  testId,
  placeholder,
  ...props
}: FieldControlProps & { testId: string; placeholder?: string }) {
  return <input data-testid={testId} placeholder={placeholder} {...useFieldControl(props)} />;
}

const MemoProbe = React.memo(Probe);

describe('useFieldControl — one control takes the controlId (controlIdClaim)', () => {
  it('the claim is first come, first served and idempotent per token', () => {
    const claim = createFieldControlIdClaim();
    expect(claim.claim('a')).toBe(true);
    expect(claim.claim('b')).toBe(false);
    expect(claim.claim('a')).toBe(true);
    // Unmounting the holder frees the id and tells the subscribers.
    const unmountA = claim.mount('a');
    const listener = vi.fn();
    const unsubscribe = claim.subscribe(listener);
    const version = claim.getVersion();
    unmountA();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(claim.getVersion()).not.toBe(version);
    expect(claim.claim('b')).toBe(true);
    unsubscribe();
  });

  it('gives controlId to the first control only; the others get their own id and aria-labelledby', () => {
    render(
      <ClaimingField>
        <div>
          <InputControl />
          <InputControl />
          <ButtonControl />
        </div>
      </ClaimingField>,
    );
    const [first, second] = screen.getAllByRole('textbox', { name: 'Price range' });
    const box = screen.getByRole('checkbox', { name: 'Price range' });
    expect(first).toHaveAttribute('id', 'ctl');
    expect(first).not.toHaveAttribute('aria-labelledby');
    for (const later of [second, box]) {
      expect(later.id).toMatch(/^field-control-/);
      expect(later).toHaveAttribute('aria-labelledby', 'lbl');
    }
    for (const control of [first, second, box]) {
      expect(control).toHaveAccessibleDescription('In euros');
    }
    expect(duplicateIds()).toEqual([]);
  });

  it('a control with its own id does not take controlId', () => {
    render(
      <ClaimingField>
        <Probe testId="own" id="own" />
        <Probe testId="next" />
      </ClaimingField>,
    );
    expect(screen.getByTestId('own')).toHaveAttribute('aria-labelledby', 'lbl');
    expect(screen.getByTestId('next')).toHaveAttribute('id', 'ctl');
    expect(screen.getByTestId('next')).not.toHaveAttribute('aria-labelledby');
  });

  it('with controlIdAssigned no control claims (the first child holds controlId)', () => {
    const claim = createFieldControlIdClaim();
    render(
      <FieldContext.Provider value={{ ...FIELD, controlIdAssigned: true, controlIdClaim: claim }}>
        <Probe testId="target" id="ctl" />
        <Probe testId="nested" />
      </FieldContext.Provider>,
    );
    expect(screen.getByTestId('nested').id).toMatch(/^field-control-/);
    expect(claim.claim('probe')).toBe(true);
  });

  it('hands controlId to the next control when the holder unmounts', () => {
    const error = vi.spyOn(console, 'error');
    try {
      const ui = (showFirst: boolean) => (
        <ClaimingField>
          {showFirst && <Probe testId="first" />}
          <Probe testId="second" />
        </ClaimingField>
      );
      const { rerender } = render(ui(true));
      expect(screen.getByTestId('first')).toHaveAttribute('id', 'ctl');
      expect(screen.getByTestId('second')).not.toHaveAttribute('id', 'ctl');
      rerender(ui(false));
      const second = screen.getByTestId('second');
      expect(second).toHaveAttribute('id', 'ctl');
      expect(second).not.toHaveAttribute('aria-labelledby');
      expect(second).toHaveAccessibleName('Price range');
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it('the holder keeps controlId; it hands it over when it gets an id of its own', () => {
    const ui = (firstId?: string) => (
      <ClaimingField>
        <Probe testId="first" id={firstId} />
        <Probe testId="second" />
      </ClaimingField>
    );
    const { rerender } = render(ui());
    rerender(ui('own'));
    expect(screen.getByTestId('first')).toHaveAttribute('id', 'own');
    expect(screen.getByTestId('second')).toHaveAttribute('id', 'ctl');
    // Without its own id again, the first control does not take controlId back from the holder.
    rerender(ui());
    expect(screen.getByTestId('first').id).toMatch(/^field-control-/);
    expect(screen.getByTestId('first')).toHaveAttribute('aria-labelledby', 'lbl');
    expect(screen.getByTestId('second')).toHaveAttribute('id', 'ctl');
    expect(duplicateIds()).toEqual([]);
  });

  it('a later control that re-renders alone does not take controlId from the holder', () => {
    const ui = (placeholder: string) => (
      <ClaimingField>
        <MemoProbe testId="first" />
        <Probe testId="second" placeholder={placeholder} />
      </ClaimingField>
    );
    const { rerender } = render(ui('a'));
    rerender(ui('b'));
    expect(screen.getByTestId('second')).toHaveAttribute('placeholder', 'b');
    expect(screen.getByTestId('first')).toHaveAttribute('id', 'ctl');
    expect(screen.getByTestId('second')).not.toHaveAttribute('id', 'ctl');
    expect(duplicateIds()).toEqual([]);
  });

  it('assigns the same way under StrictMode', () => {
    render(
      <React.StrictMode>
        <ClaimingField>
          <Probe testId="first" />
          <Probe testId="second" />
        </ClaimingField>
      </React.StrictMode>,
    );
    expect(screen.getByTestId('first')).toHaveAttribute('id', 'ctl');
    expect(screen.getByTestId('second')).toHaveAttribute('aria-labelledby', 'lbl');
    expect(screen.getAllByRole('textbox', { name: 'Price range' })).toHaveLength(2);
    expect(duplicateIds()).toEqual([]);
  });

  it('frees a controlId claimed by a render that never mounted', () => {
    const claim = createFieldControlIdClaim();
    expect(claim.claim('discarded-render')).toBe(true);
    render(
      <ClaimingField claim={claim}>
        <Probe testId="only" />
      </ClaimingField>,
    );
    expect(screen.getByTestId('only')).toHaveAttribute('id', 'ctl');
    expect(screen.getByTestId('only')).not.toHaveAttribute('aria-labelledby');
  });

  it('server render and hydration agree on which control holds controlId', async () => {
    const ui = (
      <ClaimingField>
        <Probe testId="first" />
        <Probe testId="second" />
      </ClaimingField>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(ui);
    document.body.appendChild(container);
    const ids = () => Array.from(container.querySelectorAll('input'), (input) => input.id);
    const serverIds = ids();
    expect(serverIds[0]).toBe('ctl');
    expect(serverIds[1]).not.toBe('ctl');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, ui);
      });
      expect(error).not.toHaveBeenCalled();
      expect(ids()).toEqual(serverIds);
    } finally {
      act(() => root?.unmount());
      container.remove();
      error.mockRestore();
    }
  });
});

describe('renderWithFieldContext', () => {
  it('renders a real label (id + htmlFor) and provides the resolved context', () => {
    function Probe() {
      return <output data-testid="context">{JSON.stringify(useFieldContext())}</output>;
    }
    const { field } = renderWithFieldContext(<Probe />);
    const label = screen.getByText(FIELD_TEST_TEXT.label);
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('id', FIELD_TEST_IDS.labelId);
    expect(label).toHaveAttribute('for', FIELD_TEST_IDS.controlId);
    expect(JSON.parse(screen.getByTestId('context').textContent ?? 'null')).toEqual(
      JSON.parse(JSON.stringify(field)),
    );
    expect(field).toEqual({
      controlId: FIELD_TEST_IDS.controlId,
      labelId: FIELD_TEST_IDS.labelId,
      hintId: undefined,
      errorId: undefined,
      invalid: false,
      required: false,
      hasErrorMessage: false,
    });
  });

  it('renders hint and error elements only for the given ids; an error implies invalid', () => {
    const { field } = renderWithFieldContext(<span />, { hintId: 'h', errorId: 'e' });
    expect(document.getElementById('h')).toHaveTextContent(FIELD_TEST_TEXT.hint);
    expect(document.getElementById('e')).toHaveTextContent(FIELD_TEST_TEXT.error);
    expect(document.getElementById('e')).toHaveAttribute('role', 'alert');
    expect(field.invalid).toBe(true);
    expect(field.hasErrorMessage).toBe(true);
  });

  it('passes controlIdAssigned through only when given', () => {
    expect(renderWithFieldContext(<span />, { controlIdAssigned: true }).field).toMatchObject({
      controlIdAssigned: true,
    });
    expect('controlIdAssigned' in renderWithFieldContext(<span />).field).toBe(false);
  });

  it('passes controlIdClaim through only when given', () => {
    const controlIdClaim = createFieldControlIdClaim();
    expect(renderWithFieldContext(<span />, { controlIdClaim }).field.controlIdClaim).toBe(
      controlIdClaim,
    );
    expect('controlIdClaim' in renderWithFieldContext(<span />).field).toBe(false);
  });

  it('labelId: undefined renders no label', () => {
    renderWithFieldContext(<span />, { labelId: undefined });
    expect(screen.queryByText(FIELD_TEST_TEXT.label)).toBeNull();
  });

  it('custom texts and a required asterisk that is not part of the name', () => {
    renderWithFieldContext(
      <ButtonControl />,
      { required: true },
      { label: 'Country', hint: 'Pick one', error: 'Bad' },
    );
    expect(screen.getByRole('checkbox', { name: 'Country' })).toBeInTheDocument();
  });

  it('rerender keeps the Field context around the new ui', () => {
    const { rerender } = renderWithFieldContext(<ButtonControl />);
    rerender(<ButtonControl role="switch" />);
    expect(screen.getByRole('switch', { name: FIELD_TEST_TEXT.label })).toBeInTheDocument();
  });

  it('passes render options through (container)', () => {
    const container = document.body.appendChild(document.createElement('section'));
    const { unmount } = renderWithFieldContext(<ButtonControl />, {}, { container });
    expect(container.querySelector('label')).not.toBeNull();
    unmount();
    container.remove();
  });
});

describe('FieldContext without renderWithFieldContext', () => {
  it('a raw provider works for controls rendered next to a real label', () => {
    render(
      <FieldContext.Provider value={FIELD}>
        <label id="lbl" htmlFor="ctl">
          Raw label
        </label>
        <GroupControl />
      </FieldContext.Provider>,
    );
    expect(screen.getByRole('radiogroup', { name: 'Raw label' })).toBeInTheDocument();
  });
});
