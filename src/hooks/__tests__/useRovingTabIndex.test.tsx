import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { useRovingTabIndex } from '../useRovingTabIndex';

/** Minimal test harness for the roving tabindex hook */
function TestGroup({
  activeValue,
  items,
  orientation = 'horizontal',
  loop = true,
  onFocusMove,
}: {
  activeValue: string;
  items: string[];
  orientation?: 'horizontal' | 'vertical' | 'both';
  loop?: boolean;
  onFocusMove?: (value: string) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { handleKeyDown, getTabIndex } = useRovingTabIndex(containerRef, {
    activeValue,
    items,
    orientation,
    loop,
    onFocusMove,
  });

  return (
    <div ref={containerRef} role="group" onKeyDown={handleKeyDown}>
      {items.map((item) => (
        <button key={item} data-roving-value={item} tabIndex={getTabIndex(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}

describe('useRovingTabIndex', () => {
  it('sets tabIndex 0 on active item and -1 on others', () => {
    render(<TestGroup activeValue="b" items={['a', 'b', 'c']} />);
    expect(screen.getByText('a')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByText('b')).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('c')).toHaveAttribute('tabindex', '-1');
  });

  it('falls back to first item when activeValue is not in items', () => {
    render(<TestGroup activeValue="z" items={['a', 'b', 'c']} />);
    expect(screen.getByText('a')).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('b')).toHaveAttribute('tabindex', '-1');
  });

  it('moves focus right with ArrowRight (horizontal)', async () => {
    const user = userEvent.setup();
    const onFocusMove = vi.fn();
    render(<TestGroup activeValue="a" items={['a', 'b', 'c']} onFocusMove={onFocusMove} />);
    screen.getByText('a').focus();
    await user.keyboard('{ArrowRight}');
    expect(onFocusMove).toHaveBeenCalledWith('b');
    expect(screen.getByText('b')).toHaveFocus();
  });

  it('moves focus left with ArrowLeft (horizontal)', async () => {
    const user = userEvent.setup();
    const onFocusMove = vi.fn();
    render(<TestGroup activeValue="b" items={['a', 'b', 'c']} onFocusMove={onFocusMove} />);
    screen.getByText('b').focus();
    await user.keyboard('{ArrowLeft}');
    expect(onFocusMove).toHaveBeenCalledWith('a');
    expect(screen.getByText('a')).toHaveFocus();
  });

  it('wraps focus around with loop=true', async () => {
    const user = userEvent.setup();
    const onFocusMove = vi.fn();
    render(<TestGroup activeValue="c" items={['a', 'b', 'c']} loop onFocusMove={onFocusMove} />);
    screen.getByText('c').focus();
    await user.keyboard('{ArrowRight}');
    expect(onFocusMove).toHaveBeenCalledWith('a');
    expect(screen.getByText('a')).toHaveFocus();
  });

  it('does not wrap with loop=false', async () => {
    const user = userEvent.setup();
    const onFocusMove = vi.fn();
    render(
      <TestGroup activeValue="c" items={['a', 'b', 'c']} loop={false} onFocusMove={onFocusMove} />,
    );
    screen.getByText('c').focus();
    await user.keyboard('{ArrowRight}');
    expect(onFocusMove).not.toHaveBeenCalled();
  });

  it('supports vertical orientation with ArrowDown/ArrowUp', async () => {
    const user = userEvent.setup();
    const onFocusMove = vi.fn();
    render(
      <TestGroup
        activeValue="a"
        items={['a', 'b', 'c']}
        orientation="vertical"
        onFocusMove={onFocusMove}
      />,
    );
    screen.getByText('a').focus();
    await user.keyboard('{ArrowDown}');
    expect(onFocusMove).toHaveBeenCalledWith('b');

    onFocusMove.mockClear();
    await user.keyboard('{ArrowUp}');
    expect(onFocusMove).toHaveBeenCalledWith('a');
  });

  it('does not respond to ArrowDown/ArrowUp in horizontal mode', async () => {
    const user = userEvent.setup();
    const onFocusMove = vi.fn();
    render(
      <TestGroup
        activeValue="a"
        items={['a', 'b', 'c']}
        orientation="horizontal"
        onFocusMove={onFocusMove}
      />,
    );
    screen.getByText('a').focus();
    await user.keyboard('{ArrowDown}');
    expect(onFocusMove).not.toHaveBeenCalled();
  });

  it('Home moves to first item', async () => {
    const user = userEvent.setup();
    const onFocusMove = vi.fn();
    render(<TestGroup activeValue="c" items={['a', 'b', 'c']} onFocusMove={onFocusMove} />);
    screen.getByText('c').focus();
    await user.keyboard('{Home}');
    expect(onFocusMove).toHaveBeenCalledWith('a');
    expect(screen.getByText('a')).toHaveFocus();
  });

  it('End moves to last item', async () => {
    const user = userEvent.setup();
    const onFocusMove = vi.fn();
    render(<TestGroup activeValue="a" items={['a', 'b', 'c']} onFocusMove={onFocusMove} />);
    screen.getByText('a').focus();
    await user.keyboard('{End}');
    expect(onFocusMove).toHaveBeenCalledWith('c');
    expect(screen.getByText('c')).toHaveFocus();
  });
});
