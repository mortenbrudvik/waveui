import * as React from 'react';
import { isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { DismissIcon } from '../../lib/icons';
import { hasRenderedTextLabel, hasTextLabel, observeTextLabel } from '../../lib/labelInName';
import { hasIsolatingModalBelow, subscribeLayers } from '../../lib/layers';
import {
  materialiseSlotContent,
  resolveSlot,
  slotRendersContent,
  slotWrapsDefaultContent,
  type Slot,
  type SlotObject,
} from '../../lib/slot';
import type { BackdropAppearance, IconPosition } from '../../lib/types';
import type { PresenceAttributes } from '../../hooks/usePresence';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { Button } from '../button/Button';
import { BUTTON_OWN_PROP_KEYS, type UnwrappedButton } from '../button/Button.slots';

/*
 * The Close button and backdrop slots of Dialog and Drawer (P6-06 D93–D95); TeachingPopover.Header
 * renders the Close button too. Internal (not exported from the package). Imports Button, never
 * the reverse.
 */

type UnknownProps = Record<string, unknown>;

/** The `backdrop` slot of `Dialog.Content`, `Drawer` and the drawer panel shell. */
export type ModalBackdropSlot =
  Slot<'div'> | (SlotObject<'div'> & { appearance?: BackdropAppearance });

/** Attributes of a `closeButton` slot that name the Close button instead of `closeLabel`. */
const NAMING_KEYS: ReadonlySet<string> = new Set(['aria-label', 'aria-labelledby', 'title']);

const HANDLER_KEY = /^on[A-Z]/;

const noop = () => {};

/** How the `closeButton` slot splits between the built-in Button and the content inside it. */
interface CloseButtonParts {
  /**
   * Props for the built-in Button: every prop of a merged button (except Wave Button's own), or a
   * slot object's naming attributes and handlers.
   */
  buttonProps: UnknownProps;
  /** The Button's decorative `icon`: the slot's content, a merged Button's icon, or the glyph. */
  icon: Slot<'span'> | undefined;
  /** A merged Wave Button's `iconPosition`. */
  iconPosition: IconPosition | undefined;
  /** The Button's children: the content of a merged button (it may name the button). */
  children: React.ReactNode;
  /** `true` for a merged button: a text label in its content names the Close button. */
  contentMayName: boolean;
  /** Whether a merged button's literal content holds a text label (the server and first render). */
  literalTextLabel: boolean;
  /** A merged Wave Button's `disabledFocusable`. */
  disabledFocusable: boolean;
  /** What was merged, for the development warning (`null`: nothing). */
  merged: UnwrappedButton | null;
}

/** The decorative default glyph of the Close button. */
const defaultGlyph = () => <DismissIcon />;

function defaultParts(): CloseButtonParts {
  return {
    buttonProps: {},
    icon: defaultGlyph(),
    iconPosition: undefined,
    children: undefined,
    contentMayName: false,
    literalTextLabel: false,
    disabledFocusable: false,
    merged: null,
  };
}

function isButtonType(type: unknown): boolean {
  return type === 'button' || type === Button;
}

/**
 * The parts of a `<button>` or Wave `Button` merged into the built-in Close button: its props go
 * to the Button (Wave Button's own props are applied or dropped), its content becomes the Button's
 * children, and a Wave Button's `icon` stays its icon. Without content of either kind the
 * default glyph stays.
 */
function mergedParts(
  props: UnknownProps,
  children: unknown,
  isWaveButton: boolean,
  merged: UnwrappedButton,
): CloseButtonParts {
  const buttonProps: UnknownProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || key === 'dangerouslySetInnerHTML' || BUTTON_OWN_PROP_KEYS.has(key)) {
      continue;
    }
    buttonProps[key] = value;
  }
  // Markup of the merged button is its content too, in a span inside the Button.
  const markup = props.dangerouslySetInnerHTML as
    React.HTMLAttributes<HTMLElement>['dangerouslySetInnerHTML'] | undefined;
  const content =
    markup != null ? (
      <span className="inline-flex items-center" dangerouslySetInnerHTML={markup} />
    ) : (
      materialiseSlotContent(children)
    );
  const icon = isWaveButton && slotRendersContent(props.icon) ? (props.icon as Slot<'span'>) : null;
  const hasContent = icon !== null || slotRendersContent(content);
  return {
    buttonProps,
    icon: hasContent ? (icon ?? undefined) : defaultGlyph(),
    iconPosition: isWaveButton ? (props.iconPosition as IconPosition | undefined) : undefined,
    children: hasContent ? content : undefined,
    contentMayName: true,
    literalTextLabel: hasTextLabel(content),
    disabledFocusable: isWaveButton && Boolean(props.disabledFocusable),
    merged,
  };
}

/**
 * Splits the `closeButton` slot (D95): `null` means no Close button; `undefined` and booleans keep
 * the default; a `<button>`/`Button` element, or a slot object whose `as` is one, is merged; other
 * content is the Button's decorative icon, whose element takes a slot object's other attributes
 * while its naming attributes and handlers go to the Button. Content that renders nothing keeps
 * the default glyph, as does a slot object whose element wraps the default content.
 */
function resolveCloseButton(closeButton: Slot<'span'> | undefined): CloseButtonParts | null {
  if (closeButton === null) return null;
  if (closeButton === undefined || typeof closeButton === 'boolean') return defaultParts();

  // A Button written in a Server Component (a lazy client reference) is merged too.
  const element = closeButton as React.ReactNode;
  if (isElementOfType<UnknownProps>(element, 'button', Button)) {
    return mergedParts(
      element.props,
      element.props.children,
      isElementOfType(element, Button),
      'a button element',
    );
  }

  const resolved = resolveSlot(closeButton, 'span');
  if (!resolved) return defaultParts();
  const { Component, props, children } = resolved;
  if (isButtonType(Component)) {
    return mergedParts(
      props,
      children,
      Component === Button,
      'a slot object that renders a button',
    );
  }

  const buttonProps: UnknownProps = {};
  const contentProps: UnknownProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (NAMING_KEYS.has(key) || HANDLER_KEY.test(key)) buttonProps[key] = value;
    else contentProps[key] = value;
  }
  let inner: React.ReactNode;
  if (slotRendersContent(children)) inner = children;
  else if (slotWrapsDefaultContent(Component, { ...contentProps, children }))
    inner = defaultGlyph();
  return {
    buttonProps,
    // The content element, as a slot object of the Button's icon: Button adds its icon classes
    // and `aria-hidden`.
    icon: { ...contentProps, as: Component, children: inner } as SlotObject<'span'>,
    iconPosition: undefined,
    children: undefined,
    contentMayName: false,
    literalTextLabel: false,
    disabledFocusable: false,
    merged: null,
  };
}

/** Properties of {@link ModalCloseButton}. */
export interface ModalCloseButtonProps {
  /** `'Dialog.Content'`, `'Drawer'` or `'TeachingPopover.Header'`: the warning key and text. */
  componentName: string;
  /** The `closeButton` slot. */
  closeButton: Slot<'span'> | undefined;
  /**
   * The slot's prop name, for the warning key and text (TeachingPopover.Header's `dismissButton`).
   * @default 'closeButton'
   */
  slotName?: string;
  /** The Button's name unless the slot names it (`closeLabel`). */
  closeLabel: string;
  /** Asks to close with `'close-button'`. */
  onClose: (event: Event) => void;
  /** The part class and layout classes, after Button's own (`drawerClassNames.closeButton`, …). */
  className: string;
}

/**
 * The built-in Close button with the `closeButton` slot rules (D95), shared by `Dialog.Content`,
 * the built-in Drawer header, every `Drawer.HeaderTitle` and `TeachingPopover.Header` (its
 * `dismissButton`): a subtle, small Wave `Button` named by `closeLabel`, holding the dismiss glyph
 * or the slot's decorative content; a merged button's text label (two letters or digits,
 * `labelInName.ts`) names it instead, from the literal content on the server and the first render
 * and from the rendered text after mount. `null` when hidden. Warns once, from an effect, when a
 * button was merged.
 */
export function ModalCloseButton({
  componentName,
  closeButton,
  slotName = 'closeButton',
  closeLabel,
  onClose,
  className,
}: ModalCloseButtonProps): React.ReactNode {
  const parts = resolveCloseButton(closeButton);
  const merged = parts?.merged ?? null;
  React.useEffect(() => {
    if (merged === null) return;
    warnOnce(
      `${componentName}:${slotName}-button-element`,
      `${componentName}: \`${slotName}\` received ${merged}; its props were merged into the built-in Close button (buttons cannot be nested). Pass icon content instead, e.g. \`${slotName}={<CloseIcon />}\`.`,
    );
  }, [merged, componentName, slotName]);

  const {
    ref: slotRef,
    onClick: slotOnClick,
    className: slotClassName,
    ...slotButtonProps
  } = parts?.buttonProps ?? {};
  const hasOwnName = Object.keys(slotButtonProps).some(
    (key) => NAMING_KEYS.has(key) && slotButtonProps[key] != null,
  );

  // WCAG 2.5.3 (Label in Name): a merged button's text label names the Close button, which then
  // drops `closeLabel`. The literal content decides on the server and the first render; after
  // mount the rendered text does (text from components, e.g. translations, and later changes).
  const checksContent = parts !== null && parts.contentMayName && !hasOwnName;
  const literalTextLabel = parts?.literalTextLabel ?? false;
  const [labelTarget, setLabelTarget] = React.useState<HTMLButtonElement | null>(null);
  const subscribeToContent = React.useCallback(
    (onChange: () => void) => (labelTarget ? observeTextLabel(labelTarget, onChange) : noop),
    [labelTarget],
  );
  const contentHasTextLabel = React.useSyncExternalStore(
    subscribeToContent,
    () => (labelTarget ? hasRenderedTextLabel(labelTarget) : literalTextLabel),
    () => literalTextLabel,
  );
  const namedByContent = checksContent && contentHasTextLabel;
  const ref = useMergedRefs<HTMLButtonElement>(
    slotRef as React.Ref<HTMLButtonElement> | undefined,
    checksContent ? setLabelTarget : undefined,
  );

  if (parts === null) return null;
  return (
    <Button
      appearance="subtle"
      size="small"
      aria-label={hasOwnName || namedByContent ? undefined : closeLabel}
      {...slotButtonProps}
      ref={ref}
      icon={parts.icon}
      iconPosition={parts.iconPosition}
      disabledFocusable={parts.disabledFocusable}
      onClick={composeEventHandlers(
        slotOnClick as React.MouseEventHandler<HTMLButtonElement> | undefined,
        (event: React.MouseEvent<HTMLButtonElement>) => onClose(event.nativeEvent),
      )}
      className={cn(className, slotClassName as string | undefined)}
    >
      {parts.children}
    </Button>
  );
}
ModalCloseButton.displayName = 'ModalCloseButton';

/** The server snapshot of {@link useBackdropAppearance}: nothing is stacked on the server. */
const getServerAppearance = (): BackdropAppearance => 'dimmed';

/**
 * The automatic look of a modal surface's backdrop (D94): `'transparent'` while the surface is
 * open and another open modal surface whose isolation is active is stacked below it (nested in its
 * content or opened beside it), so the page is dimmed once; `'dimmed'` otherwise. Derived during
 * render from the layer stack (`hasIsolatingModalBelow`), re-read whenever a layer or an isolation
 * changes, so the upper surface dims when the lower one closes. A modal layer without isolation
 * (the DatePicker calendar) never counts. While closed it keeps the look it last had while open,
 * so a stacked surface's backdrop stays transparent through its exit motion instead of dimming the
 * page a second time.
 */
export function useBackdropAppearance(layerId: string, open: boolean): BackdropAppearance {
  const getSnapshot = React.useCallback(
    (): BackdropAppearance => (open && hasIsolatingModalBelow(layerId) ? 'transparent' : 'dimmed'),
    [layerId, open],
  );
  const live = React.useSyncExternalStore(subscribeLayers, getSnapshot, getServerAppearance);
  // The look while open, held through the close (a previous-value state, updated only while open).
  const [held, setHeld] = React.useState(live);
  if (open && live !== held) setHeld(live);
  return open ? live : held;
}

/** Properties of {@link ModalBackdrop}. */
export interface ModalBackdropProps {
  /** The `backdrop` slot. */
  backdrop: ModalBackdropSlot | undefined;
  /**
   * The stable class (`dialogContentClassNames.backdrop`, `drawerClassNames.backdrop`, plus a
   * variant's), first in the backdrop's classes.
   */
  className: string;
  /** The surface's dismiss layer (for the automatic appearance). */
  layerId: string;
  /** Whether the surface is open. */
  open: boolean;
  /** The surface's backdrop press handling (`useBackdropPress`), after the slot's own handler. */
  onMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
  /** The presence attributes of the surface's top-level elements (P6-07). */
  presenceProps: PresenceAttributes;
  /**
   * The backdrop's motion classes (its `backdropMotion`, resolved), after the base classes and
   * before the slot's `className`.
   */
  motionClassName?: string;
}

/**
 * The backdrop element of a modal or alert surface with the `backdrop` slot rules (D93) and the
 * automatic appearance (D94): `aria-hidden`, `fixed inset-0`, rendered as `data-appearance` and
 * filled with the backdrop token, or transparent, then its motion classes. `null` renders none;
 * `undefined` and booleans the default; shorthand content renders inside it; a slot object's
 * attributes, `className` (merged last), `style`, `ref` and handlers (composed, the slot's first)
 * go to it, its children render inside it, and its `appearance` overrides the automatic one.
 * `aria-hidden="true"` always wins.
 */
export function ModalBackdrop({
  backdrop,
  className,
  layerId,
  open,
  onMouseDown,
  presenceProps,
  motionClassName,
}: ModalBackdropProps): React.ReactNode {
  const automatic = useBackdropAppearance(layerId, open);
  const slot = backdrop === null || typeof backdrop === 'boolean' ? undefined : backdrop;
  const resolved = slot === undefined ? null : resolveSlot<'div'>(slot as Slot<'div'>, 'div');
  const {
    appearance: ownAppearance,
    className: slotClassName,
    onMouseDown: slotOnMouseDown,
    ref: slotRef,
    ...slotProps
  } = resolved?.props ?? {};
  const ref = useMergedRefs<HTMLElement>(slotRef as React.Ref<HTMLElement> | undefined);
  if (backdrop === null) return null;

  const appearance: BackdropAppearance =
    ownAppearance === 'dimmed' || ownAppearance === 'transparent' ? ownAppearance : automatic;
  const Component: React.ElementType = resolved?.Component ?? 'div';
  return (
    <Component
      data-appearance={appearance}
      {...slotProps}
      {...presenceProps}
      ref={ref}
      aria-hidden="true"
      onMouseDown={composeEventHandlers(
        slotOnMouseDown as React.MouseEventHandler<HTMLElement> | undefined,
        onMouseDown,
      )}
      className={cn(
        className,
        'fixed inset-0',
        appearance === 'transparent' ? 'bg-transparent' : 'bg-backdrop',
        motionClassName,
        slotClassName as string | undefined,
      )}
    >
      {resolved?.children}
    </Component>
  );
}
ModalBackdrop.displayName = 'ModalBackdrop';
