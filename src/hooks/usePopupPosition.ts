import { useMemo } from 'react';
import type * as React from 'react';
import {
  arrow as arrowMiddleware,
  autoUpdate,
  flip as flipMiddleware,
  offset as offsetMiddleware,
  platform,
  shift as shiftMiddleware,
  size as sizeMiddleware,
  useFloating,
  type Middleware,
  type Placement,
  type Platform,
  type ReferenceType,
  type SizeOptions,
} from '@floating-ui/react-dom';
import type { PopupAlign, PopupSide } from '../lib/types';
import type { Direction } from '../lib/direction';
import { useDirection } from './useDirection';

/** Options of {@link usePopupPosition}. */
export interface UsePopupPositionOptions {
  /** Whether the popup is open; positions are kept up to date only while `true`. */
  open: boolean;
  /** Side of the anchor. `start`/`end` follow the writing direction. @default 'bottom' */
  side?: PopupSide;
  /** Alignment along that side. @default 'start' */
  align?: PopupAlign;
  /** Distance from the anchor in px. @default 4 (tooltips use 8) */
  offset?: number;
  /** Flip to the opposite side when there is not enough room. @default true */
  flip?: boolean;
  /** Shift along the side to stay inside the viewport. @default { padding: 8 } */
  shift?: boolean | { padding: number };
  /** Make the surface as wide as the anchor (listboxes). @default false */
  matchReferenceWidth?: boolean;
  /** Limit the surface to the available space (`max-width`/`max-height`). @default false */
  fitViewport?: boolean;
  /** An arrow (beak) element inside the surface, positioned through `arrowStyles`. */
  arrowRef?: React.RefObject<HTMLElement | null>;
  /** CSS positioning strategy. @default 'fixed' */
  strategy?: 'absolute' | 'fixed';
}

/** Returned by {@link usePopupPosition}. */
export interface UsePopupPositionResult {
  /** Ref callback for the anchor (trigger) element. */
  setReference(el: HTMLElement | null): void;
  /** Ref callback for the popup surface. */
  setFloating(el: HTMLElement | null): void;
  /** Position styles for the surface (also in `floatingProps.style`). */
  floatingStyles: React.CSSProperties;
  /** Position styles for the arrow element. */
  arrowStyles: React.CSSProperties;
  /** Final placement after flipping, e.g. `'top-start'`. */
  placement: string;
  /** Final physical side after flipping. */
  side: 'top' | 'bottom' | 'left' | 'right';
  /** Whether a position has been computed since the popup opened. */
  isPositioned: boolean;
  /** Spread onto the surface: `data-side`, `data-align` and the position style. */
  floatingProps: { 'data-side': string; 'data-align': string; style: React.CSSProperties };
}

type PhysicalSide = 'top' | 'bottom' | 'left' | 'right';

const STATIC_SIDE: Record<PhysicalSide, PhysicalSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

/** Half the arrow size, so the arrow sticks out of the surface towards the anchor. */
const ARROW_OFFSET = 'calc(var(--wave-popup-arrow-size, 8px) / -2)';

function resolveSide(side: PopupSide, dir: Direction): PhysicalSide {
  if (side === 'start') return dir === 'rtl' ? 'right' : 'left';
  if (side === 'end') return dir === 'rtl' ? 'left' : 'right';
  return side;
}

/** Keeps the position updated while mounted; observers are used only where they exist. */
function whileElementsMounted(
  reference: ReferenceType,
  floating: HTMLElement,
  update: () => void,
): () => void {
  return autoUpdate(reference, floating, update, {
    elementResize: typeof ResizeObserver !== 'undefined',
    layoutShift: typeof IntersectionObserver !== 'undefined',
  });
}

/**
 * Writes the available space and the anchor width as CSS variables on the surface:
 * `--wave-popup-available-width`, `--wave-popup-available-height`, `--wave-popup-reference-width`.
 * It captures no options (floating-ui compares middleware functions by source text).
 */
const sizeApply: NonNullable<SizeOptions['apply']> = ({
  availableWidth,
  availableHeight,
  rects,
  elements,
}) => {
  const style = elements.floating.style;
  style.setProperty('--wave-popup-available-width', `${Math.max(0, Math.floor(availableWidth))}px`);
  style.setProperty(
    '--wave-popup-available-height',
    `${Math.max(0, Math.floor(availableHeight))}px`,
  );
  style.setProperty('--wave-popup-reference-width', `${Math.round(rects.reference.width)}px`);
};

/**
 * Positions a popup surface next to its anchor with `@floating-ui/react-dom` (Tooltip, Popover,
 * Menu, listboxes, the DatePicker calendar, TeachingPopover): `offset`, `flip`, `shift` (8px
 * viewport padding), optional `size` (reference width / available space as CSS variables) and
 * `arrow`. Logical `start`/`end` sides follow `useDirection()` (the WaveProvider `dir`, else the
 * document direction), and so does start/end alignment.
 *
 * Positions update only while `open` (`autoUpdate` on scroll/resize; element resizes and layout
 * shifts only where `ResizeObserver`/`IntersectionObserver` exist). Spread `floatingProps` onto the
 * surface: `data-side`/`data-align` expose the final placement for styling (C-CLASS).
 *
 * Destructure the result: `eslint-plugin-react-hooks` (`react-hooks/refs`) treats an object
 * whose member is passed to a `ref` prop as a ref, and then rejects reading its other members
 * during render.
 *
 * @example
 * const { setReference, setFloating, floatingProps } = usePopupPosition({ open, side: 'bottom' });
 * <button ref={setReference} />
 * {open && <Portal><div ref={setFloating} {...floatingProps} /></Portal>}
 */
export function usePopupPosition(options: UsePopupPositionOptions): UsePopupPositionResult {
  const {
    open,
    side = 'bottom',
    align = 'start',
    offset = 4,
    flip = true,
    shift = { padding: 8 },
    matchReferenceWidth = false,
    fitViewport = false,
    arrowRef,
    strategy = 'fixed',
  } = options;
  const dir = useDirection();
  const physicalSide = resolveSide(side, dir);
  const requestedPlacement = (
    align === 'center' ? physicalSide : `${physicalSide}-${align}`
  ) as Placement;
  const padding = shift === false ? 0 : shift === true ? 8 : shift.padding;

  const middleware: Middleware[] = [offsetMiddleware(offset)];
  if (flip) middleware.push(flipMiddleware({ padding }));
  if (shift !== false) middleware.push(shiftMiddleware({ padding }));
  if (matchReferenceWidth || fitViewport) {
    middleware.push(sizeMiddleware({ padding, apply: sizeApply }));
  }
  if (arrowRef) middleware.push(arrowMiddleware({ element: arrowRef }));

  // Alignment follows the hook's direction (not only the surface's computed CSS direction).
  const directionalPlatform = useMemo<Platform>(
    () => ({ ...platform, isRTL: () => dir === 'rtl' }),
    [dir],
  );

  const { refs, floatingStyles, placement, middlewareData, isPositioned } = useFloating({
    open,
    placement: requestedPlacement,
    strategy,
    middleware,
    platform: directionalPlatform,
    whileElementsMounted: open ? whileElementsMounted : undefined,
  });

  const [finalSide, finalAlign = 'center'] = placement.split('-') as [PhysicalSide, string?];

  const style = useMemo<React.CSSProperties>(() => {
    const next: React.CSSProperties = { ...floatingStyles };
    if (matchReferenceWidth) next.width = 'var(--wave-popup-reference-width)';
    if (fitViewport) {
      next.maxWidth = 'var(--wave-popup-available-width)';
      next.maxHeight = 'var(--wave-popup-available-height)';
    }
    return next;
  }, [floatingStyles, matchReferenceWidth, fitViewport]);

  const arrowX = middlewareData.arrow?.x;
  const arrowY = middlewareData.arrow?.y;
  const arrowStyles = useMemo<React.CSSProperties>(() => {
    const styles: Record<string, string> = {
      position: 'absolute',
      left: arrowX != null ? `${arrowX}px` : '',
      top: arrowY != null ? `${arrowY}px` : '',
    };
    styles[STATIC_SIDE[finalSide]] = ARROW_OFFSET;
    return styles as React.CSSProperties;
  }, [arrowX, arrowY, finalSide]);

  const floatingProps = useMemo(
    () => ({ 'data-side': finalSide, 'data-align': finalAlign, style }),
    [finalSide, finalAlign, style],
  );

  return {
    setReference: refs.setReference,
    setFloating: refs.setFloating,
    floatingStyles: style,
    arrowStyles,
    placement,
    side: finalSide,
    isPositioned,
    floatingProps,
  };
}
