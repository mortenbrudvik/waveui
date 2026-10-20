import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useModalOpen } from '../useModalOpen';
import { Dialog } from '../../components/overlays/Dialog';
import { Popover } from '../../components/overlays/Popover';
import { registerLayer, type LayerRecord } from '../../lib/layers';

function Probe({ onRender }: { onRender?: (value: boolean) => void }) {
  const modalOpen = useModalOpen();
  React.useEffect(() => {
    onRender?.(modalOpen);
  }, [modalOpen, onRender]);
  return <output>{String(modalOpen)}</output>;
}

function AppDialog({ open, title = 'Sheet' }: { open: boolean; title?: string }) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <Dialog.Content title={title}>Body</Dialog.Content>
    </Dialog>
  );
}

function rawModal(id: string): () => void {
  const record: LayerRecord = {
    id,
    parentId: null,
    kind: 'modal',
    order: 0,
    getElements: () => [],
    getAnchor: () => null,
    escape: true,
    outsidePress: true,
    focusOutside: false,
    onDismiss: vi.fn(),
  };
  return registerLayer(record);
}

describe('useModalOpen', () => {
  it('is false with no layers', () => {
    render(<Probe />);
    expect(screen.getByRole('status')).toHaveTextContent('false');
  });

  it('is true while a Dialog is open and false in the commit that closes it', async () => {
    function App({ open }: { open: boolean }) {
      return (
        <>
          <Probe />
          <AppDialog open={open} />
        </>
      );
    }
    const { rerender } = render(<App open={false} />);
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('false');
    rerender(<App open />);
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('true');
    rerender(<App open={false} />);
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('false');
    rerender(<App open />);
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('true');
    rerender(<App open={false} />);
  });

  it('ignores a popover layer', () => {
    render(
      <>
        <Probe />
        <Popover open onOpenChange={() => {}}>
          <Popover.Content aria-label="Details">Body</Popover.Content>
        </Popover>
      </>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('false');
  });

  it('stays true until the last of two modals closes', () => {
    render(<Probe />);
    let releaseFirst: () => void = () => {};
    let releaseSecond: () => void = () => {};
    act(() => {
      releaseFirst = rawModal('first');
      releaseSecond = rawModal('second');
    });
    expect(screen.getByRole('status')).toHaveTextContent('true');
    act(() => releaseFirst());
    expect(screen.getByRole('status')).toHaveTextContent('true');
    act(() => releaseSecond());
    expect(screen.getByRole('status')).toHaveTextContent('false');
  });

  it('reports each change once in StrictMode', () => {
    const seen: boolean[] = [];
    const onRender = (value: boolean) => {
      // StrictMode runs the mount effect twice: only a different value is a change.
      if (seen.at(-1) !== value) seen.push(value);
    };
    render(
      <React.StrictMode>
        <Probe onRender={onRender} />
      </React.StrictMode>,
    );
    let release: () => void = () => {};
    act(() => {
      release = rawModal('strict');
    });
    act(() => release());
    expect(seen).toEqual([false, true, false]);
  });

  it('is false in server-rendered output', () => {
    expect(renderToString(<Probe />)).toContain('false');
  });
});
