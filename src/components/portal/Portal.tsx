import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';
import { Z_INDEX, registerLayerElement } from '../../lib/layers';
import { useIsClient } from '../../hooks/useIsClient';
import { useDirection } from '../../hooks/useDirection';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { DismissLayerContext, DismissLayerProvider } from '../../hooks/useDismiss';
import { useWaveTheme } from '../provider/WaveProvider';

/** Props accepted by {@link Portal}. */
export interface PortalProps {
  /** Content rendered into the portal. */
  children: React.ReactNode;
  /** Element to render into. @default WaveProvider `portalContainer`, else `document.body` */
  container?: HTMLElement | null;
  /**
   * Stacking layer: `--wave-z-overlay` (dialogs, popovers, menus, listboxes), `--wave-z-toast`
   * (above overlays) or `--wave-z-tooltip`. The portal's nesting depth is added.
   * @default 'overlay'
   */
  layer?: 'overlay' | 'toast' | 'tooltip';
  /**
   * The dismiss layer of the content (from `useDismiss`). Provided to the children through
   * `DismissLayerProvider`, so layers opened inside become its descendants.
   */
  layerId?: string;
  /** Render the children inline instead (no portal, no wrapper). @default false */
  disabled?: boolean;
  /** Extra classes for the portal wrapper. */
  className?: string;
  /** Ref to the portal wrapper `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Nesting depth of portals: `0` outside any portal; each `Portal` provides `depth + 1` to its
 * children. Portals add it to their z-index so a surface opened from inside another overlay always
 * stacks above it — also when both mount in the same commit.
 */
export const PortalDepthContext = React.createContext(0);
PortalDepthContext.displayName = 'PortalDepthContext';

/**
 * Renders its children into `document.body` (or the WaveProvider `portalContainer`), wrapped in a
 * `<div class="wave-portal …">` that carries the provider's theme classes, direction and font, so
 * portaled overlays look like the rest of the themed tree. The wrapper paints no background.
 *
 * - **Client only, first commit**: nothing is rendered on the server or during hydration (no
 *   mismatch); in every other client render the portal exists in the first commit, so layout
 *   effects and ref callbacks of the content see connected elements.
 * - **Stacking**: `z-index: calc(<layer variable> + depth)`, where depth is the number of portals
 *   it is rendered in, so a surface opened from inside another overlay always stacks above it,
 *   also when both mount in the same commit.
 * - **Layers**: the wrapper is registered with the enclosing dismiss layer (the parent), so presses
 *   and focus inside the portal count as inside that layer; `layerId` is provided only to the
 *   children.
 *
 * Content that must exist on the server or before an overlay opens (tooltip descriptions, closed
 * listboxes) is rendered inline instead.
 */
export const Portal = ({
  children,
  container,
  layer = 'overlay',
  layerId,
  disabled = false,
  className,
  ref,
}: PortalProps) => {
  const isClient = useIsClient();
  const { themeClassName, portalContainer } = useWaveTheme();
  const dir = useDirection();
  const depth = React.useContext(PortalDepthContext);
  const parentLayerId = React.useContext(DismissLayerContext);

  const registerWithParent = React.useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || parentLayerId === null) return;
      return registerLayerElement(parentLayerId, el);
    },
    [parentLayerId],
  );
  const wrapperRef = useMergedRefs<HTMLDivElement>(ref, registerWithParent);

  const content =
    layerId === undefined ? (
      children
    ) : (
      <DismissLayerProvider layerId={layerId}>{children}</DismissLayerProvider>
    );

  if (disabled) return <>{content}</>;
  if (!isClient) return null;

  const target = container ?? portalContainer ?? document.body;

  return createPortal(
    <div
      ref={wrapperRef}
      className={cn('wave-portal', themeClassName, className)}
      dir={dir}
      data-wave-portal=""
      data-layer={layer}
      style={{ position: 'relative', zIndex: `calc(${Z_INDEX[layer]} + ${depth})` }}
    >
      <PortalDepthContext.Provider value={depth + 1}>{content}</PortalDepthContext.Provider>
    </div>,
    target,
  );
};

Portal.displayName = 'Portal';
