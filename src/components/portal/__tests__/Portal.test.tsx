import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { Portal, PortalDepthContext } from '../Portal';
import { WaveProvider } from '../../provider/WaveProvider';
import { DismissLayerContext, DismissLayerProvider } from '../../../hooks/useDismiss';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { getTopmostLayer, isInsideLayerTree, registerLayer } from '../../../lib/layers';
import { expectNoA11yViolations, testDisplayName } from '../../../test-utils';

function getWrapper(el: HTMLElement): HTMLElement {
  const wrapper = el.closest<HTMLElement>('[data-wave-portal]');
  if (!wrapper) throw new Error('no portal wrapper');
  return wrapper;
}

afterEach(() => {
  // Unmount first (the setup file's cleanup runs after this hook), then check the shared stack.
  cleanup();
  expect(getTopmostLayer()).toBeNull();
});

describe('Portal', () => {
  testDisplayName(Portal, 'Portal');

  it('renders its children into document.body inside a wave-portal wrapper', () => {
    const { container } = render(
      <Portal>
        <button type="button">Inside</button>
      </Portal>,
    );
    const button = screen.getByRole('button', { name: 'Inside' });
    expect(container).not.toContainElement(button);
    const wrapper = getWrapper(button);
    expect(wrapper.parentElement).toBe(document.body);
    expect(wrapper).toHaveClass('wave-portal');
    expect(wrapper).toHaveAttribute('data-wave-portal', '');
    expect(wrapper).toHaveAttribute('data-layer', 'overlay');
    expect(wrapper.style.position).toBe('relative');
    expect(wrapper.style.zIndex).toBe('calc(var(--wave-z-overlay, 1000) + 0)');
  });

  it('renders in the first commit (no second render needed)', () => {
    let seenInLayoutEffect: HTMLElement | null = null;
    function Probe() {
      const ref = React.useRef<HTMLDivElement>(null);
      React.useLayoutEffect(() => {
        seenInLayoutEffect = ref.current;
      }, []);
      return (
        <Portal>
          <div ref={ref}>Surface</div>
        </Portal>
      );
    }
    render(<Probe />);
    expect(seenInLayoutEffect).not.toBeNull();
    expect(seenInLayoutEffect!.isConnected).toBe(true);
  });

  it('uses the z-index variable of its layer', () => {
    render(
      <>
        <Portal layer="toast">
          <span>Toast</span>
        </Portal>
        <Portal layer="tooltip">
          <span>Tip</span>
        </Portal>
      </>,
    );
    expect(getWrapper(screen.getByText('Toast'))).toHaveAttribute('data-layer', 'toast');
    expect(getWrapper(screen.getByText('Toast')).style.zIndex).toBe(
      'calc(var(--wave-z-toast, 1100) + 0)',
    );
    expect(getWrapper(screen.getByText('Tip')).style.zIndex).toBe(
      'calc(var(--wave-z-tooltip, 1200) + 0)',
    );
  });

  it('stacks a nested portal above its parent, also when both mount in one commit', () => {
    render(
      <Portal>
        <span>Parent</span>
        <Portal>
          <span>Child</span>
          <Portal>
            <span>Grandchild</span>
          </Portal>
        </Portal>
      </Portal>,
    );
    expect(getWrapper(screen.getByText('Parent')).style.zIndex).toBe(
      'calc(var(--wave-z-overlay, 1000) + 0)',
    );
    expect(getWrapper(screen.getByText('Child')).style.zIndex).toBe(
      'calc(var(--wave-z-overlay, 1000) + 1)',
    );
    expect(getWrapper(screen.getByText('Grandchild')).style.zIndex).toBe(
      'calc(var(--wave-z-overlay, 1000) + 2)',
    );
  });

  it('provides depth + 1 to its children through PortalDepthContext', () => {
    function Reader() {
      return <span data-testid="depth">{React.useContext(PortalDepthContext)}</span>;
    }
    render(
      <Portal>
        <Portal>
          <Reader />
        </Portal>
      </Portal>,
    );
    expect(screen.getByTestId('depth')).toHaveTextContent('2');
  });

  it('carries the provider theme classes and direction, without painting a background', () => {
    render(
      <WaveProvider theme="dark" dir="rtl">
        <Portal className="custom-portal">
          <span>Themed</span>
        </Portal>
      </WaveProvider>,
    );
    const wrapper = getWrapper(screen.getByText('Themed'));
    expect(wrapper).toHaveClass('wave-portal', 'wave-dark', 'dark', 'custom-portal');
    expect(wrapper).toHaveAttribute('dir', 'rtl');
    expect(wrapper.className).not.toMatch(/\bbg-/);
  });

  it('follows the document direction outside a provider', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    try {
      render(
        <Portal>
          <span>Doc dir</span>
        </Portal>,
      );
      expect(getWrapper(screen.getByText('Doc dir'))).toHaveAttribute('dir', 'rtl');
    } finally {
      // Unmount first: outside a provider the portal observes the document direction, so resetting
      // it while the portal is still mounted would re-render the portal outside act().
      cleanup();
      document.documentElement.removeAttribute('dir');
    }
  });

  it('renders into the container prop, else the provider portalContainer', () => {
    const custom = document.createElement('div');
    const fromProvider = document.createElement('div');
    document.body.append(custom, fromProvider);
    try {
      const { unmount } = render(
        <WaveProvider portalContainer={fromProvider}>
          <Portal>
            <span>Provider target</span>
          </Portal>
          <Portal container={custom}>
            <span>Prop target</span>
          </Portal>
        </WaveProvider>,
      );
      expect(fromProvider).toContainElement(screen.getByText('Provider target'));
      expect(custom).toContainElement(screen.getByText('Prop target'));
      unmount();
    } finally {
      custom.remove();
      fromProvider.remove();
    }
  });

  it('forwards ref to the wrapper element', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Portal ref={ref}>
        <span>Ref</span>
      </Portal>,
    );
    expect(ref.current).toBe(getWrapper(screen.getByText('Ref')));
  });

  it('renders inline when disabled', () => {
    const { container } = render(
      <Portal disabled>
        <span>Inline</span>
      </Portal>,
    );
    expect(container).toContainElement(screen.getByText('Inline'));
    expect(document.querySelector('[data-wave-portal]')).toBeNull();
  });

  it('registers its wrapper with the parent layer and provides its own layerId only to children', () => {
    const unregisterParent = registerLayer({
      id: 'parent-layer',
      parentId: null,
      kind: 'popover',
      order: 0,
      getElements: () => [],
      getAnchor: () => null,
      escape: true,
      outsidePress: true,
      focusOutside: false,
      onDismiss: () => {},
    });
    function Reader() {
      return <span data-testid="context">{React.useContext(DismissLayerContext)}</span>;
    }
    try {
      const { unmount } = render(
        <DismissLayerProvider layerId="parent-layer">
          <Portal layerId="own-layer">
            <button type="button">In portal</button>
            <Reader />
          </Portal>
        </DismissLayerProvider>,
      );
      const button = screen.getByRole('button', { name: 'In portal' });
      expect(isInsideLayerTree('parent-layer', button)).toBe(true);
      // The own layer id is not the registration target (only its children see it).
      expect(isInsideLayerTree('own-layer', button)).toBe(false);
      expect(screen.getByTestId('context')).toHaveTextContent('own-layer');
      unmount();
      expect(isInsideLayerTree('parent-layer', button)).toBe(false);
    } finally {
      unregisterParent();
    }
  });

  it('lets a focus trap focus its content synchronously (no requestAnimationFrame)', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    function Trapped() {
      const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
      useFocusTrap(surface, { enabled: true });
      return (
        <Portal>
          <div ref={setSurface} tabIndex={-1}>
            <button type="button">First</button>
          </div>
        </Portal>
      );
    }
    try {
      render(<Trapped />);
      expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
      expect(raf).not.toHaveBeenCalled();
    } finally {
      raf.mockRestore();
    }
  });

  it('has no axe violations with portaled content', async () => {
    render(
      <Portal>
        <div role="dialog" aria-label="Portaled dialog">
          <button type="button">OK</button>
        </div>
      </Portal>,
    );
    await expectNoA11yViolations();
  });

  it('renders nothing on the server and hydrates without warnings', async () => {
    function App() {
      return (
        <div>
          <span>Static</span>
          <Portal>
            <span>Portaled after hydration</span>
          </Portal>
        </div>
      );
    }
    const html = renderToString(<App />);
    expect(html).toContain('Static');
    expect(html).not.toContain('Portaled after hydration');

    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    const errors = vi.spyOn(console, 'error');
    const root = await act(async () => hydrateRoot(host, <App />));
    try {
      expect(errors).not.toHaveBeenCalled();
      expect(screen.getByText('Portaled after hydration')).toBeInTheDocument();
      expect(host).not.toContainElement(screen.getByText('Portaled after hydration'));
    } finally {
      errors.mockRestore();
      act(() => root.unmount());
      host.remove();
    }
  });
});
