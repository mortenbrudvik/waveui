import * as React from 'react';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { useFocusVisible } from '../useFocusVisible';

function Probe({ label = 'mode' }: { label?: string }) {
  return <output aria-label={label}>{String(useFocusVisible())}</output>;
}

const mode = (label = 'mode') => screen.getByLabelText(label);

describe('useFocusVisible', () => {
  it('is false before any interaction', () => {
    render(<Probe />);
    expect(mode()).toHaveTextContent('false');
  });

  it('is true after a key press and false after a pointer press', async () => {
    const user = userEvent.setup();
    render(<Probe />);
    await user.keyboard('a');
    expect(mode()).toHaveTextContent('true');
    await user.pointer({ keys: '[MouseLeft]', target: document.body });
    expect(mode()).toHaveTextContent('false');
  });

  it('switches to the mouse on a touch press too', async () => {
    render(<Probe />);
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(mode()).toHaveTextContent('true');
    fireEvent.touchStart(document.body);
    expect(mode()).toHaveTextContent('false');
  });

  it('ignores a lone modifier key', async () => {
    const user = userEvent.setup();
    render(<Probe />);
    await user.keyboard('{Shift}{Control}{Alt}{Meta}');
    expect(mode()).toHaveTextContent('false');
  });

  it('keeps every subscriber in step', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Probe label="one" />
        <Probe label="two" />
      </>,
    );
    await user.keyboard('{ArrowDown}');
    expect(mode('one')).toHaveTextContent('true');
    expect(mode('two')).toHaveTextContent('true');
  });

  it('adds one set of document listeners for many subscribers and removes it after the last', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    onTestFinished(() => {
      add.mockRestore();
      remove.mockRestore();
    });
    const first = render(<Probe label="one" />);
    const afterFirst = add.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);
    const second = render(<Probe label="two" />);
    expect(add.mock.calls.length).toBe(afterFirst);
    first.unmount();
    expect(remove).not.toHaveBeenCalled();
    second.unmount();
    expect(remove.mock.calls.length).toBe(afterFirst);
  });

  it('starts from false again when a new subscriber follows the last unmount', async () => {
    const user = userEvent.setup();
    const first = render(<Probe />);
    await user.keyboard('a');
    expect(mode()).toHaveTextContent('true');
    first.unmount();
    render(<Probe />);
    expect(mode()).toHaveTextContent('false');
  });

  it('is false in server-rendered output and hydrates without a mismatch', async () => {
    const html = renderToString(<Probe />);
    expect(html).toContain('false');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    try {
      let root: ReturnType<typeof hydrateRoot> | undefined;
      await act(async () => {
        root = hydrateRoot(container, <Probe />);
      });
      expect(error).not.toHaveBeenCalled();
      await act(async () => root?.unmount());
    } finally {
      container.remove();
      error.mockRestore();
    }
  });

  it('reports a change once in StrictMode', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    function Recorder() {
      const value = useFocusVisible();
      React.useEffect(() => {
        if (seen.at(-1) !== String(value)) seen.push(String(value));
      }, [value]);
      return null;
    }
    render(
      <React.StrictMode>
        <Recorder />
      </React.StrictMode>,
    );
    await user.keyboard('a');
    expect(seen).toEqual(['false', 'true']);
  });
});
