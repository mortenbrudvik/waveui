import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';

// ---------------------------------------------------------------------------
// Individual helpers (kept as public API for backward compatibility)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Unified mega-helper
// ---------------------------------------------------------------------------

export interface TestSystemPropsConfig {
  /** Expected root HTML element tag name. */
  expectedTag: string;
  /** Expected Component.displayName. */
  displayName: string;
  /** Whether the component supports the `as` prop. @default false */
  polymorphic?: boolean;
  /** Whether to run axe a11y checks. @default true */
  a11y?: boolean;
  /** Required props for rendering (e.g. { children: 'Click me' }). */
  defaultProps?: Record<string, unknown>;
  /** Additional axe test variants (e.g., disabled, error states). */
  a11yVariants?: Array<{ name: string; props: Record<string, unknown> }>;
}

/**
 * Combined helper that verifies all cross-cutting system props for a component
 * in a single call: ref forwarding, rest spread, className merging, displayName,
 * polymorphic `as`, and axe accessibility.
 */
export function testSystemProps(
  Component: React.ComponentType<any>,
  config: TestSystemPropsConfig,
) {
  const props = config.defaultProps ?? {};

  testForwardRef(Component, config.expectedTag, props);
  testRestSpread(Component, props);
  testClassName(Component, props);

  if (config.polymorphic) {
    testPolymorphicAs(Component, props);
  }

  testDisplayName(Component, config.displayName);

  if (config.a11y !== false) {
    testA11y(Component, props);

    if (config.a11yVariants) {
      for (const variant of config.a11yVariants) {
        it(`has no accessibility violations (${variant.name})`, async () => {
          const { container } = render(
            React.createElement(Component, { ...props, ...variant.props }),
          );
          const results = await axe(container);
          expect(results).toHaveNoViolations();
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// DisplayName verification
// ---------------------------------------------------------------------------

/**
 * Verify that a component has the expected displayName.
 */
export function testDisplayName(
  Component: React.ComponentType<any>,
  expectedName: string,
) {
  it(`has displayName "${expectedName}"`, () => {
    expect(Component.displayName).toBe(expectedName);
  });
}

// ---------------------------------------------------------------------------
// Compound component exposure
// ---------------------------------------------------------------------------

/**
 * Verify that a compound component exposes all expected sub-components.
 */
export function testCompoundExposure(
  Parent: Record<string, unknown>,
  expectedSubComponents: string[],
) {
  describe('compound component exposure', () => {
    for (const name of expectedSubComponents) {
      it(`exposes ${name} sub-component`, () => {
        expect(Parent[name]).toBeDefined();
        expect(typeof Parent[name]).toBe('function');
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Focus event testing
// ---------------------------------------------------------------------------

/**
 * Verify that onFocus and onBlur callbacks fire correctly.
 */
export function testFocusEvents(
  Component: React.ComponentType<any>,
  defaultProps: Record<string, unknown> = {},
  selector?: string,
) {
  describe('focus events', () => {
    it('calls onFocus', async () => {
      const onFocus = vi.fn();
      const { container } = render(
        React.createElement(Component, { ...defaultProps, onFocus }),
      );
      const element = selector
        ? container.querySelector(selector)!
        : container.firstElementChild!;
      await userEvent.click(element as Element);
      expect(onFocus).toHaveBeenCalled();
    });

    it('calls onBlur', async () => {
      const onBlur = vi.fn();
      const { container } = render(
        React.createElement(Component, { ...defaultProps, onBlur }),
      );
      const element = selector
        ? container.querySelector(selector)!
        : container.firstElementChild!;
      await userEvent.click(element as Element);
      await userEvent.tab();
      expect(onBlur).toHaveBeenCalled();
    });
  });
}

// ---------------------------------------------------------------------------
// Overlay test wrapper
// ---------------------------------------------------------------------------

/**
 * Creates a wrapper component for testing overlay sub-components in isolation.
 *
 * Usage:
 * ```ts
 * const DialogWrapper = createOverlayTestWrapper(Dialog, { open: true, onOpenChange: () => {} });
 * render(<Dialog.Content>Content</Dialog.Content>, { wrapper: DialogWrapper });
 * ```
 */
export function createOverlayTestWrapper(
  OverlayRoot: React.ComponentType<any>,
  rootProps: Record<string, unknown>,
): React.ComponentType<{ children: React.ReactNode }> {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(OverlayRoot, rootProps, children);
  }
  Wrapper.displayName = 'OverlayTestWrapper';
  return Wrapper;
}
