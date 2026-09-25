import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFormReset } from '../useFormReset';

/** An uncontrolled stand-in value control **without a name**: a button that counts clicks. */
function Counter({
  defaultValue = 0,
  form,
  onReset,
}: {
  defaultValue?: number;
  form?: string;
  onReset?: () => void;
}) {
  const [value, setValue] = React.useState(defaultValue);
  const ref = React.useRef<HTMLButtonElement>(null);
  useFormReset(
    ref,
    () => {
      setValue(defaultValue);
      onReset?.();
    },
    form,
  );
  return (
    <button type="button" ref={ref} onClick={() => setValue((v) => v + 1)}>
      Count {value}
    </button>
  );
}

describe('useFormReset', () => {
  it('resets an uncontrolled control without a name when its form resets', async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Order">
        <Counter defaultValue={2} />
        <button type="reset">Reset</button>
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'Count 2' }));
    expect(screen.getByRole('button', { name: 'Count 3' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('button', { name: 'Count 2' })).toBeInTheDocument();
  });

  it('works with form.reset() synchronously inside act', () => {
    const onReset = vi.fn();
    const { container } = render(
      <form aria-label="Order">
        <Counter onReset={onReset} />
      </form>,
    );
    act(() => {
      screen.getByRole('button', { name: 'Count 0' }).click();
    });
    act(() => {
      (container.querySelector('form') as HTMLFormElement).reset();
    });
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Count 0' })).toBeInTheDocument();
  });

  it('finds the form through the `form` id when the control is outside it', () => {
    const onReset = vi.fn();
    render(
      <>
        <form id="external" aria-label="External" />
        <Counter form="external" onReset={onReset} />
      </>,
    );
    act(() => {
      (document.getElementById('external') as HTMLFormElement).reset();
    });
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('honours the control element’s own form attribute', () => {
    const onReset = vi.fn();
    function Attr() {
      const ref = React.useRef<HTMLInputElement>(null);
      useFormReset(ref, onReset);
      return <input ref={ref} form="owner" aria-label="Field" />;
    }
    render(
      <>
        <form id="owner" aria-label="Owner" />
        <Attr />
      </>,
    );
    act(() => {
      (document.getElementById('owner') as HTMLFormElement).reset();
    });
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('ignores resets of other forms', () => {
    const onReset = vi.fn();
    render(
      <>
        <form aria-label="Mine">
          <Counter onReset={onReset} />
        </form>
        <form id="other" aria-label="Other" />
      </>,
    );
    act(() => {
      (document.getElementById('other') as HTMLFormElement).reset();
    });
    expect(onReset).not.toHaveBeenCalled();
  });

  it('does nothing when a reset handler cancels the reset', () => {
    const onReset = vi.fn();
    render(
      <form aria-label="Mine" onReset={(e) => e.preventDefault()}>
        <Counter onReset={onReset} />
      </form>,
    );
    act(() => {
      (screen.getByRole('form', { name: 'Mine' }) as HTMLFormElement).reset();
    });
    expect(onReset).not.toHaveBeenCalled();
  });

  it('a `form` id that matches nothing means no form (no closest() fallback)', () => {
    const onReset = vi.fn();
    render(
      <form aria-label="Mine">
        <Counter form="missing" onReset={onReset} />
      </form>,
    );
    act(() => {
      (screen.getByRole('form', { name: 'Mine' }) as HTMLFormElement).reset();
    });
    expect(onReset).not.toHaveBeenCalled();
  });

  it('always calls the latest onReset and stops listening on unmount', () => {
    const first = vi.fn();
    const second = vi.fn();
    const form = document.body.appendChild(document.createElement('form'));
    try {
      const { rerender, unmount } = render(<Counter onReset={first} />, { container: form });
      rerender(<Counter onReset={second} />);
      act(() => form.reset());
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
      unmount();
      form.reset();
      expect(second).toHaveBeenCalledTimes(1);
    } finally {
      form.remove();
    }
  });
});
