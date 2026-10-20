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
