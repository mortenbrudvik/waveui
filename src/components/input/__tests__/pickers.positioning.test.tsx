import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Combobox } from '../Combobox';
import { DatePicker } from '../DatePicker';
import { Dropdown } from '../Dropdown';
import { Option } from '../Option';
import { TagPicker } from '../TagPicker';
import { TimePicker } from '../TimePicker';
import { usePopupPosition } from '../../../hooks/usePopupPosition';
import type { PopupPositioningOptions } from '../../../lib/types';

// The hook runs on every render, open or not: the options a picker hands it are what the
// `positioning` prop decides.
vi.mock('../../../hooks/usePopupPosition', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hooks/usePopupPosition')>();
  return { ...actual, usePopupPosition: vi.fn(actual.usePopupPosition) };
});

const spy = vi.mocked(usePopupPosition);

const FALLBACK = [{ side: 'top' as const }];

const PICKERS: [string, (positioning?: PopupPositioningOptions) => React.ReactElement][] = [
  [
    'Combobox',
    (positioning) => (
      <Combobox aria-label="Fruit" positioning={positioning}>
        <Option value="a">Apple</Option>
      </Combobox>
    ),
  ],
  [
    'Dropdown',
    (positioning) => (
      <Dropdown aria-label="Fruit" positioning={positioning}>
        <Option value="a">Apple</Option>
      </Dropdown>
    ),
  ],
  [
    'TagPicker',
    (positioning) => (
      <TagPicker
        aria-label="Fruits"
        options={[{ value: 'a', label: 'Apple' }]}
        positioning={positioning}
      />
    ),
  ],
  ['TimePicker', (positioning) => <TimePicker aria-label="Time" positioning={positioning} />],
];

function lastOptions() {
  const call = spy.mock.calls.at(-1);
  if (!call) throw new Error('usePopupPosition was not called');
  return call[0];
}

describe.each(PICKERS)('%s positioning', (_name, ui) => {
  it('keeps the listbox defaults without positioning', () => {
    spy.mockClear();
    render(ui());
    expect(lastOptions()).toMatchObject({ matchReferenceWidth: true, fitViewport: true });
    expect(lastOptions().fallbackPlacements).toBeUndefined();
  });

  it('passes offset (also 0) and fallbackPlacements to the position hook', () => {
    spy.mockClear();
    const { unmount } = render(ui({ offset: 12, fallbackPlacements: FALLBACK }));
    expect(lastOptions()).toMatchObject({ offset: 12, fallbackPlacements: FALLBACK });
    unmount();
    render(ui({ offset: 0 }));
    expect(lastOptions().offset).toBe(0);
  });

  it('lets matchReferenceWidth and fitViewport be switched off', () => {
    spy.mockClear();
    render(ui({ matchReferenceWidth: false, fitViewport: false }));
    expect(lastOptions()).toMatchObject({ matchReferenceWidth: false, fitViewport: false });
  });
});

// 1.0 (Phase 14, R5): `ref` reaches the control and joins its merged ref, beside the positioning
// reference of Combobox and Dropdown. An inline ref that changes on every render is swapped alone,
// as an inline `controlRef` was in 0.18: the reference is attached once and never detached while
// the picker is mounted. TimePicker and DatePicker place their popup against the row around the
// input, which `ref` does not reach.
const INLINE_REF_PICKERS: [
  string,
  (pass: number, ref: (node: HTMLElement | null) => void) => React.ReactElement,
  (container: HTMLElement) => Element,
][] = [
  [
    'Combobox',
    (pass, ref) => (
      <Combobox aria-label="Fruit" data-pass={pass} ref={ref}>
        <Option value="a">Apple</Option>
      </Combobox>
    ),
    (container) => container.querySelector('[role="combobox"]')!,
  ],
  [
    'Dropdown',
    (pass, ref) => (
      <Dropdown aria-label="Fruit" data-pass={pass} ref={ref}>
        <Option value="a">Apple</Option>
      </Dropdown>
    ),
    (container) => container.querySelector('[role="combobox"]')!,
  ],
  [
    'TimePicker',
    (pass, ref) => <TimePicker aria-label="Time" data-pass={pass} ref={ref} />,
    (container) => container.querySelector('[role="combobox"]')!.parentElement!,
  ],
  [
    'DatePicker',
    (pass, ref) => <DatePicker aria-label="Date" data-pass={pass} ref={ref} />,
    (container) => container.querySelector('input')!.parentElement!,
  ],
];

describe.each(INLINE_REF_PICKERS)(
  '%s positioning reference with an inline ref',
  (_name, ui, reference) => {
    it('attaches the reference once and keeps it while an inline ref changes on every render', async () => {
      const actual = (
        await vi.importActual<typeof import('../../../hooks/usePopupPosition')>(
          '../../../hooks/usePopupPosition',
        )
      ).usePopupPosition;
      const calls: unknown[] = [];
      let recording: ((el: HTMLElement | null) => void) | undefined;
      spy.mockImplementation((options) => {
        const result = actual(options);
        // One stable wrapper per picker, as the hook's own setter is stable.
        recording ??= (el) => {
          calls.push(el);
          result.setReference(el);
        };
        return { ...result, setReference: recording };
      });
      try {
        const nodes: (HTMLElement | null)[] = [];
        const inline = () => (node: HTMLElement | null) => {
          nodes.push(node);
        };
        const { container, rerender, unmount } = render(ui(0, inline()));
        rerender(ui(1, inline()));
        rerender(ui(2, inline()));
        const anchor = reference(container);
        expect(calls).toEqual([anchor]);
        // The inline ref itself is swapped on every render: the old one detached, the new one
        // attached to the control.
        expect(nodes.filter((node) => node !== null)).toHaveLength(3);
        expect(nodes.at(-1)).not.toBeNull();
        unmount();
        expect(calls).toEqual([anchor, null]);
      } finally {
        spy.mockImplementation(actual);
      }
    });
  },
);

describe('DatePicker positioning', () => {
  it('keeps the calendar defaults without positioning', () => {
    spy.mockClear();
    render(<DatePicker aria-label="Date" />);
    expect(lastOptions().offset).toBeUndefined();
  });

  it('passes offset and fallbackPlacements to the position hook', () => {
    spy.mockClear();
    render(
      <DatePicker aria-label="Date" positioning={{ offset: 10, fallbackPlacements: FALLBACK }} />,
    );
    expect(lastOptions()).toMatchObject({ offset: 10, fallbackPlacements: FALLBACK });
  });
});
