import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { render } from '@testing-library/react';
import { resolveSlot, renderSlot } from '../slot';

describe('resolveSlot', () => {
  it('returns null for null', () => {
    expect(resolveSlot(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(resolveSlot(undefined)).toBeNull();
  });

  it('returns null for false', () => {
    expect(resolveSlot(false)).toBeNull();
  });

  it('wraps string ReactNode in defaultAs', () => {
    const result = resolveSlot('hello', 'span');
    expect(result).not.toBeNull();
    expect(result!.Component).toBe('span');
    expect(result!.children).toBe('hello');
  });

  it('wraps number ReactNode in defaultAs', () => {
    const result = resolveSlot(42, 'span');
    expect(result).not.toBeNull();
    expect(result!.Component).toBe('span');
    expect(result!.children).toBe(42);
  });

  it('wraps ReactElement in defaultAs', () => {
    const el = React.createElement('b', null, 'bold');
    const result = resolveSlot(el, 'div');
    expect(result).not.toBeNull();
    expect(result!.Component).toBe('div');
    expect(result!.children).toBe(el);
  });

  it('defaults to span when no defaultAs', () => {
    const result = resolveSlot('hi');
    expect(result!.Component).toBe('span');
  });

  it('extracts as/children/className from SlotObject', () => {
    const result = resolveSlot({
      as: 'div',
      children: 'content',
      className: 'custom',
    });
    expect(result!.Component).toBe('div');
    expect(result!.children).toBe('content');
    expect(result!.props.className).toContain('custom');
  });

  it('uses defaultAs when SlotObject has no as', () => {
    const result = resolveSlot({ children: 'content' }, 'div');
    expect(result!.Component).toBe('div');
  });

  it('merges baseClassName with SlotObject className', () => {
    const result = resolveSlot({ className: 'custom' }, 'span', 'base');
    expect(result!.props.className).toContain('base');
    expect(result!.props.className).toContain('custom');
  });

  it('passes through extra props from SlotObject', () => {
    const result = resolveSlot({
      children: 'x',
      'data-foo': 'bar',
      style: { color: 'red' },
    } as any);
    expect(result!.props['data-foo']).toBe('bar');
    expect(result!.props.style).toEqual({ color: 'red' });
  });

  it('applies baseClassName for ReactNode shorthand', () => {
    const result = resolveSlot('text', 'span', 'base-class');
    expect(result!.props.className).toBe('base-class');
  });
});

describe('renderSlot', () => {
  it('returns null for null/undefined/false', () => {
    expect(renderSlot(null)).toBeNull();
    expect(renderSlot(undefined)).toBeNull();
    expect(renderSlot(false)).toBeNull();
  });

  it('renders ReactNode shorthand', () => {
    const element = renderSlot('hello', 'span');
    const { container } = render(element!);
    expect(container.querySelector('span')).toHaveTextContent('hello');
  });

  it('renders SlotObject with custom as', () => {
    const element = renderSlot({ as: 'strong', children: 'bold' });
    const { container } = render(element!);
    expect(container.querySelector('strong')).toHaveTextContent('bold');
  });

  it('renders SlotObject with baseClassName', () => {
    const element = renderSlot({ children: 'x', className: 'custom' }, 'span', 'base');
    render(element!);
    const span = document.querySelector('span');
    expect(span?.className).toContain('base');
    expect(span?.className).toContain('custom');
  });
});
