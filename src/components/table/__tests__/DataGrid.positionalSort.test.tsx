import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { DataGrid } from '../DataGrid';

/*
 * P13-03: the 0.4 positional `onSortChange(columnId, direction)` is announced in development, once,
 * from an effect. The supported forms (the object callback of a grid with `items`, `sort` or
 * `defaultSort`, and a legacy grid without a callback) stay silent.
 */

const MESSAGE =
  '[WaveUI] DataGrid: `onSortChange(columnId, direction)` is deprecated and will be removed in 1.0. Use `onSortChange(sort, details?)` instead. Pass `items`, `sort` or `defaultSort` to receive the sort object.';

const content = (
  <>
    <DataGrid.Header>
      <DataGrid.Row>
        <DataGrid.HeaderCell columnId="name" sortable>
          Name
        </DataGrid.HeaderCell>
      </DataGrid.Row>
    </DataGrid.Header>
    <DataGrid.Body>
      <DataGrid.Row>
        <DataGrid.Cell>Alice</DataGrid.Cell>
      </DataGrid.Row>
    </DataGrid.Body>
  </>
);

describe('DataGrid positional onSortChange (P13-03)', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  const positional = (
    <DataGrid aria-label="People" onSortChange={() => {}}>
      {content}
    </DataGrid>
  );

  it('warns once across rerenders and instances', () => {
    const ui = (
      <>
        {positional}
        {positional}
      </>
    );
    const { rerender } = render(ui);
    rerender(ui);
    expect(warn.mock.calls).toEqual([[MESSAGE]]);
  });

  it('logs nothing while rendering on the server (the warning comes from an effect)', () => {
    renderToString(positional);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs nothing in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(positional);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs nothing for a legacy grid without a callback', () => {
    render(<DataGrid aria-label="People">{content}</DataGrid>);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['defaultSort', { defaultSort: null }],
    ['sort', { sort: null }],
    ['items', { items: [{ id: 1 }] }],
  ] as const)('logs nothing for the object callback of a grid with %s', (_name, props) => {
    render(
      <DataGrid aria-label="People" {...props} onSortChange={() => {}}>
        {content}
      </DataGrid>,
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
