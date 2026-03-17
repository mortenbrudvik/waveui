import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

/**
 * Verify that a component forwards its ref to the correct DOM element.
 */
export function testForwardRef(
  Component: React.ComponentType<any>,
  expectedTag: string,
  requiredProps: Record<string, unknown> = {},
) {
  it('forwards ref to DOM element', () => {
    const ref = React.createRef<HTMLElement>();
    render(React.createElement(Component, { ...requiredProps, ref, 'data-testid': 'ref-test' }));
    const el = screen.getByTestId('ref-test');
    expect(ref.current).toBe(el);
    expect(el.tagName.toLowerCase()).toBe(expectedTag.toLowerCase());
  });
}

/**
 * Verify that rest/spread props (data-testid, aria-label, etc.) pass through.
 */
export function testRestSpread(
  Component: React.ComponentType<any>,
  requiredProps: Record<string, unknown> = {},
) {
  it('spreads rest props to DOM element', () => {
    render(
      React.createElement(Component, {
        ...requiredProps,
        'data-testid': 'spread-test',
        'aria-label': 'test-label',
      }),
    );
    const el = screen.getByTestId('spread-test');
    expect(el).toHaveAttribute('aria-label', 'test-label');
  });
}

/**
 * Verify that custom className merges with defaults (doesn't replace them).
 */
export function testClassName(
  Component: React.ComponentType<any>,
  requiredProps: Record<string, unknown> = {},
) {
  it('merges custom className', () => {
    render(
      React.createElement(Component, {
        ...requiredProps,
        className: 'my-custom-class',
        'data-testid': 'class-test',
      }),
    );
    const el = screen.getByTestId('class-test');
    expect(el.className).toContain('my-custom-class');
  });
}

/**
 * Verify that the `as` prop changes the rendered element type.
 */
export function testPolymorphicAs(
  Component: React.ComponentType<any>,
  requiredProps: Record<string, unknown> = {},
) {
  it('renders as a different element via `as` prop', () => {
    render(
      React.createElement(Component, {
        ...requiredProps,
        as: 'section',
        'data-testid': 'as-test',
      }),
    );
    const el = screen.getByTestId('as-test');
    expect(el.tagName.toLowerCase()).toBe('section');
  });
}

/**
 * Verify that a component has no accessibility violations (via axe-core).
 */
export function testA11y(
  Component: React.ComponentType<any>,
  requiredProps: Record<string, unknown> = {},
) {
  it('has no accessibility violations', async () => {
    const { container } = render(React.createElement(Component, { ...requiredProps }));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
}
