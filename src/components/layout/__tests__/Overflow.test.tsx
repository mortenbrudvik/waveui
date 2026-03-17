import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Overflow, OverflowItem, useIsOverflowing } from '../Overflow';

// Mock ResizeObserver for jsdom
beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      private cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
      }
      observe() {
        // Fire immediately with empty entries to simulate initial measurement
        this.cb([], this);
      }
      unobserve() {}
      disconnect() {}
    } as any;
  }
});

describe('Overflow', () => {
  it('renders without crashing', () => {
    render(
      <Overflow data-testid="overflow">
        <OverflowItem itemId="a">Item A</OverflowItem>
        <OverflowItem itemId="b">Item B</OverflowItem>
      </Overflow>,
    );
    expect(screen.getByTestId('overflow')).toBeInTheDocument();
  });

  it('forwards ref to the container div', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Overflow ref={ref} data-testid="overflow">
        <OverflowItem itemId="a">A</OverflowItem>
      </Overflow>,
    );
    expect(ref.current).toBe(screen.getByTestId('overflow'));
    expect(ref.current!.tagName.toLowerCase()).toBe('div');
  });

  it('merges custom className', () => {
    render(
      <Overflow data-testid="overflow" className="my-custom">
        <OverflowItem itemId="a">A</OverflowItem>
      </Overflow>,
    );
    expect(screen.getByTestId('overflow').className).toContain('my-custom');
  });

  it('renders all items when there is no overflow', () => {
    render(
      <Overflow>
        <OverflowItem itemId="a">Item A</OverflowItem>
        <OverflowItem itemId="b">Item B</OverflowItem>
      </Overflow>,
    );
    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Item B')).toBeInTheDocument();
  });

  it('renders overflow button prop when provided', () => {
    // In jsdom, no real layout, so we just verify the overflowButton prop doesn't crash
    render(
      <Overflow overflowButton={(count) => <button>+{count}</button>}>
        <OverflowItem itemId="a">A</OverflowItem>
      </Overflow>,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});

describe('OverflowItem', () => {
  it('forwards ref to the item div', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Overflow>
        <OverflowItem ref={ref} itemId="a" data-testid="item">
          Item
        </OverflowItem>
      </Overflow>,
    );
    expect(ref.current).toBe(screen.getByTestId('item'));
  });

  it('spreads rest props', () => {
    render(
      <Overflow>
        <OverflowItem itemId="a" data-testid="item" aria-label="test">
          Item
        </OverflowItem>
      </Overflow>,
    );
    expect(screen.getByTestId('item')).toHaveAttribute('aria-label', 'test');
  });
});

describe('useIsOverflowing', () => {
  it('returns false when element is not overflowing', () => {
    function TestComponent() {
      const ref = React.useRef<HTMLDivElement>(null);
      const isOverflowing = useIsOverflowing(ref);
      return (
        <div ref={ref} data-testid="container">
          {isOverflowing ? 'overflowing' : 'not-overflowing'}
        </div>
      );
    }
    render(<TestComponent />);
    // In jsdom, scrollWidth === clientWidth === 0, so not overflowing
    expect(screen.getByTestId('container').textContent).toBe('not-overflowing');
  });
});
