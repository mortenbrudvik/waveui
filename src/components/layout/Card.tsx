import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { hasWarned, isDev, warnOnce } from '../../lib/dev';
import { getTabbableElements } from '../../lib/focus';
import { CheckIcon } from '../../lib/icons';
import { focusRing, forcedColors } from '../../lib/styles';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';

/**
 * Elements whose own events a selectable card ignores: a click or key press that starts inside a
 * nested control belongs to that control, never to the card (layout#35). A `<label>` counts too:
 * its click already activates the control it labels.
 */
const INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, label, summary, [role="button"], [tabindex]';

/** `Node.ELEMENT_NODE`, spelled out so no realm's `Node` global is read. */
const ELEMENT_NODE = 1;

/**
 * Whether the card must ignore `event`: it started outside the card's DOM, or inside an
 * interactive element nested in `root` (the card itself, which carries `role="button"`/`tabindex`
 * in the default mode, does not count).
 *
 * React events bubble through portals along the component tree, so a menu, popover or dialog
 * opened from inside the card (e.g. a footer overflow menu) reaches the card's handlers although
 * its DOM lives elsewhere. Such a target is not a DOM descendant of the card and never selects it.
 *
 * The target is duck typed (`nodeType`) rather than checked with `instanceof`, so a card rendered
 * into another realm's document (an iframe, or a popout window reached through `createPortal`)
 * still selects: its nodes are not instances of the main realm's `Node`/`Element`.
 */
function isForeignEvent(event: React.SyntheticEvent, root: Element): boolean {
  const target = event.target as Partial<Node> | null;
  if (!target || typeof target.nodeType !== 'number' || !root.contains(target as Node)) {
    return true;
  }
  if (target.nodeType !== ELEMENT_NODE) return false;
  const control = (target as Element).closest(INTERACTIVE_SELECTOR);
  return control !== null && control !== root && root.contains(control);
}

/** Warn-once key of the "selectable card contains tabbable elements" diagnostic. */
const NESTED_INTERACTIVE_WARNING = 'Card:nested-interactive';

/**
 * The id of the header title that names the built-in checkbox of a `selectionControl="checkbox"`
 * card; `null` everywhere else (other cards, and a `Card.Header` rendered on its own, which does
 * not require a Card). A string, never an object, so the provider value needs no memoisation.
 */
const CardTitleIdContext = React.createContext<string | null>(null);

/**
 * The Card's own props (the XOwnProps rule of `PolymorphicProps`: component-specific props only).
 * Every other prop comes from the rendered element (`as`).
 */
export interface CardOwnProps {
  /**
   * Whether the card is selected. Shown with the selected colors plus non-color cues: a 2px primary
   * border (a 1px border plus an inset 1px ring), a Highlight outline in forced-colors mode, and a
   * check glyph (with `selectionControl="checkbox"` the checked checkbox instead).
   *
   * The state reaches assistive technology only on a selectable card (`onSelect`): as
   * `aria-pressed` (default mode) or as the built-in checkbox's checked state. Without `onSelect`,
   * `selected` is a visual state only (the glyph is decorative); state it in the content if it
   * matters to screen-reader users, or make the card selectable.
   */
  selected?: boolean;
  /**
   * Makes the card selectable: called when the card is activated by a click, Enter (on key down)
   * or Space (on key up, like a native button) in the default mode, or when its built-in checkbox
   * changes (`selectionControl="checkbox"`). Clicks and key presses that start inside a nested
   * interactive element (a button, link, input or any element with `tabindex`), or in content
   * portaled out of the card (a menu, popover or dialog opened from it), are ignored, so a footer
   * action never selects the card.
   */
  onSelect?: () => void;
  /**
   * How a selectable card (`onSelect`) exposes its selection:
   * - `'card'` (default): the card itself is the control — `role="button"`, a tab stop, Enter and
   *   Space activation and `aria-pressed={selected}` when `selected` is defined. Use it only for
   *   cards **without** interactive content: a button inside a `role="button"` card is invalid
   *   (axe `nested-interactive`), and a development warning points here. A button's children are
   *   presentational, so the card's content is flattened into its name: a heading (e.g.
   *   `<Card.Header as="h3">`), list or other structure inside it is not exposed and cannot be
   *   reached by heading navigation (no warning covers this). Keep such cards short.
   * - `'checkbox'`: the card is not a widget; a built-in native checkbox (top end corner) carries
   *   `selected` and is named by the `Card.Header` title (or `selectLabel`). Pointer clicks on
   *   non-interactive card areas still toggle it. Use it for cards with actions, and for cards
   *   whose headings or other structure must stay navigable.
   * @default 'card'
   */
  selectionControl?: 'card' | 'checkbox';
  /**
   * Accessible name of the built-in checkbox (`selectionControl="checkbox"`). Defaults to the
   * `Card.Header` title, which the checkbox references with `aria-labelledby`.
   */
  selectLabel?: string;
}

/**
 * Props of {@link Card} rendered as `C` (default `'div'`). `CardProps` without a type argument is
 * the 0.4 name: the props of a Card rendered as a `<div>`, including `ref`.
 */
export type CardProps<C extends React.ElementType = 'div'> = PolymorphicProps<C, CardOwnProps>;

/** The props the implementation reads, for any `as` (the public typing is `PolymorphicComponent`). */
type CardImplProps = CardOwnProps &
  Omit<React.HTMLAttributes<HTMLElement>, 'onSelect'> & {
    as?: React.ElementType;
    ref?: React.Ref<HTMLElement>;
    type?: string;
  };

/**
 * A surface that groups related content, with `Card.Header`, `Card.Body` and `Card.Footer`.
 *
 * **Selectable cards** (`onSelect`) come in two patterns:
 * - A card without interactive content is itself the control (`selectionControl="card"`, the
 *   default): it is a `role="button"` tab stop activated by click, Enter (key down) or Space (key
 *   up, cancelled by moving focus away first), with `aria-pressed` reflecting `selected`. Its
 *   content becomes the button's name, so headings and other structure inside it are flattened.
 * - A card that contains buttons or links, or headings that must stay navigable, uses
 *   `selectionControl="checkbox"`: a built-in checkbox named by the header title carries the
 *   selection, and the card's actions and structure stay separate from it.
 *
 * In both modes events that start inside a nested interactive element, or in content portaled out
 * of the card, are ignored. `onClick`, `onKeyDown` and `onKeyUp` are composed with the built-in
 * selection (call `event.preventDefault()` to skip it). A `selected` card without `onSelect` shows
 * the selected look only; its state is not exposed to assistive technology.
 *
 * React Server Components cannot dot into a client module: import the flat names `CardHeader`,
 * `CardBody` and `CardFooter` there; `Card.Header` etc. work in client files.
 *
 * @example
 * <Card onSelect={toggle} selected={selected}>
 *   <Card.Header title="Pro plan" subtitle="Billed monthly" />
 * </Card>
 *
 * <Card onSelect={toggle} selected={selected} selectionControl="checkbox">
 *   <Card.Header title="Pro plan" />
 *   <Card.Footer><Button>Details</Button></Card.Footer>
 * </Card>
 */
const CardRoot: PolymorphicComponent<'div', CardOwnProps> = (props) => {
  const {
    as,
    selected,
    onSelect,
    selectionControl = 'card',
    selectLabel,
    className,
    children,
    ref,
    onClick,
    onKeyDown,
    onKeyUp,
    onBlur,
    ...rest
  } = props as CardImplProps;

  const Component: React.ElementType = as ?? 'div';
  const selectable = onSelect !== undefined;
  const checkboxMode = selectable && selectionControl === 'checkbox';
  const cardMode = selectable && !checkboxMode;
  /** A native `<button>` already has the role, tab stop and keyboard activation. */
  const nativeButton = Component === 'button';

  const titleId = useId('card-title');
  const rootRef = React.useRef<HTMLElement | null>(null);
  const mergedRef = useMergedRefs<HTMLElement>(ref, rootRef);

  // Development diagnostics (C-DEV): read the mounted DOM after every commit (content can change
  // without prop changes), warn once. Once a key has warned, its DOM scan is skipped.
  React.useEffect(() => {
    const root = rootRef.current;
    if (!isDev || !root || !selectable) return;
    if (
      cardMode &&
      !hasWarned(NESTED_INTERACTIVE_WARNING) &&
      getTabbableElements(root).length > 0
    ) {
      warnOnce(
        NESTED_INTERACTIVE_WARNING,
        'Card: a selectable card (`onSelect`) is a button and must not contain focusable elements (buttons, links, inputs). Use `selectionControl="checkbox"` for cards with interactive content.',
      );
    }
    if (checkboxMode && !selectLabel && !root.ownerDocument.getElementById(titleId)) {
      warnOnce(
        'Card:checkbox-name',
        'Card: the selection checkbox has no accessible name. Render a `Card.Header` with a `title`, or pass `selectLabel`.',
      );
    }
  });

  /**
   * Set by an unprevented Space keydown on the card; Space selects on the following keyup only
   * while it is set (like a native button and P01's Button: a keyup alone never selects, and
   * moving focus away in between cancels). The ref is only touched from event handlers, through
   * these two stable callbacks (C-HOOKS).
   */
  const spaceArmedRef = React.useRef(false);
  /** Arms (or disarms) Space activation. */
  const setSpaceArmed = useEventCallback((armed: boolean) => {
    spaceArmedRef.current = armed;
  });
  /** Reads and clears the Space arm. */
  const takeSpaceArmed = useEventCallback(() => {
    const armed = spaceArmedRef.current;
    spaceArmedRef.current = false;
    return armed;
  });

  const handleClick = composeEventHandlers<React.MouseEvent<HTMLElement>>(onClick, (event) => {
    if (!selectable || isForeignEvent(event, event.currentTarget)) return;
    onSelect();
  });

  /** Keyboard activation applies to a `role="button"` card (a native `<button>` has its own). */
  const keyboardActivation = cardMode && !nativeButton;

  const handleKeyDown = composeEventHandlers<React.KeyboardEvent<HTMLElement>>(
    onKeyDown,
    (event) => {
      if (!keyboardActivation) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (isForeignEvent(event, event.currentTarget)) return;
      // Space would scroll the page: prevent it now, select on keyup. Enter selects on keydown; a
      // held Enter does not toggle repeatedly.
      event.preventDefault();
      if (event.key === ' ') setSpaceArmed(true);
      else if (!event.repeat) onSelect?.();
    },
  );

  const handleKeyUp = composeEventHandlers<React.KeyboardEvent<HTMLElement>>(
    onKeyUp,
    (event) => {
      if (!keyboardActivation || event.key !== ' ') return;
      // Always consume the arm, also when the consumer prevented this keyup.
      const armed = takeSpaceArmed();
      if (!armed || event.defaultPrevented || isForeignEvent(event, event.currentTarget)) return;
      event.preventDefault();
      onSelect?.();
    },
    { checkDefaultPrevented: false },
  );

  // Moving focus away between Space keydown and keyup cancels the activation (native behavior).
  const handleBlur = composeEventHandlers<React.FocusEvent<HTMLElement>>(
    onBlur,
    () => {
      if (keyboardActivation) setSpaceArmed(false);
    },
    { checkDefaultPrevented: false },
  );

  /** Defaults the consumer may override (C-COMPOSE: before `{...rest}`). */
  const defaults: Record<string, unknown> = {};
  if (cardMode) {
    if (nativeButton) {
      defaults.type = 'button';
    } else {
      defaults.role = 'button';
      defaults.tabIndex = 0;
    }
    if (selected !== undefined) defaults['aria-pressed'] = selected;
  }

  return (
    <CardTitleIdContext.Provider value={checkboxMode ? titleId : null}>
      <Component
        {...defaults}
        {...rest}
        ref={mergedRef}
        data-selected={selected ? '' : undefined}
        className={cn(
          'overflow-hidden rounded-md border border-border bg-card shadow-4',
          // Positions the check glyph / checkbox; plain cards keep their 0.4 positioning.
          (selectable || selected !== undefined) && 'relative',
          selected &&
            cn(
              'border-primary bg-selected text-selected-foreground ring-1 ring-inset ring-primary',
              forcedColors.selectedContainer,
            ),
          selectable && 'cursor-pointer',
          cardMode && focusRing,
          className,
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={handleBlur}
      >
        {checkboxMode && (
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={() => onSelect()}
            aria-label={selectLabel}
            aria-labelledby={selectLabel ? undefined : titleId}
            className={cn(
              'absolute end-3 top-3 m-0 size-4 cursor-pointer accent-primary',
              focusRing,
            )}
          />
        )}
        {selected && !checkboxMode && (
          <CheckIcon size={12} className="absolute end-2 top-2 text-primary" />
        )}
        {children}
      </Component>
    </CardTitleIdContext.Provider>
  );
};
CardRoot.displayName = 'Card';

/** The Card.Header's own props (component-specific props only). */
export interface CardHeaderOwnProps {
  /**
   * Title content displayed in the card header. It also names a selectable card's built-in
   * checkbox (`selectionControl="checkbox"`).
   */
  title?: React.ReactNode;
  /** Subtitle content displayed below the title. */
  subtitle?: React.ReactNode;
}

/** Props of {@link CardHeader} rendered as `C` (default `'div'`), including `ref`. */
export type CardHeaderProps<C extends React.ElementType = 'div'> = PolymorphicProps<
  C,
  CardHeaderOwnProps
>;

type CardHeaderImplProps = CardHeaderOwnProps &
  Omit<React.HTMLAttributes<HTMLElement>, 'title'> & {
    as?: React.ElementType;
    ref?: React.Ref<HTMLElement>;
  };

/**
 * The header of a {@link Card}: a title and an optional subtitle, followed by any children.
 * Flat export for React Server Components (`Card.Header` in client files).
 */
export const CardHeader: PolymorphicComponent<'div', CardHeaderOwnProps> = (props) => {
  const { as, title, subtitle, className, children, ref, ...rest } = props as CardHeaderImplProps;
  const Component: React.ElementType = as ?? 'div';
  /** Set only inside a `selectionControl="checkbox"` card: the title names its checkbox. */
  const titleId = React.useContext(CardTitleIdContext);
  return (
    // In a checkbox card the header keeps clear of the checkbox in the top end corner.
    <Component ref={ref} className={cn('p-4', titleId && 'pe-10', className)} {...rest}>
      {title && (
        <div id={titleId ?? undefined} className="text-subtitle-1">
          {title}
        </div>
      )}
      {subtitle && <div className="text-caption-1 text-muted-foreground">{subtitle}</div>}
      {children}
    </Component>
  );
};
CardHeader.displayName = 'CardHeader';

/** The Card.Body's own props: none besides the element's (component-specific props only). */
export type CardBodyOwnProps = Record<never, never>;

/** Props of {@link CardBody} rendered as `C` (default `'div'`), including `ref`. */
export type CardBodyProps<C extends React.ElementType = 'div'> = PolymorphicProps<
  C,
  CardBodyOwnProps
>;

type CardSectionImplProps = React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  ref?: React.Ref<HTMLElement>;
};

/**
 * The main content of a {@link Card}. Flat export for React Server Components (`Card.Body` in
 * client files).
 */
export const CardBody: PolymorphicComponent<'div', CardBodyOwnProps> = (props) => {
  const { as, className, ref, ...rest } = props as CardSectionImplProps;
  const Component: React.ElementType = as ?? 'div';
  return <Component ref={ref} className={cn('p-4 pt-0', className)} {...rest} />;
};
CardBody.displayName = 'CardBody';

/** The Card.Footer's own props: none besides the element's (component-specific props only). */
export type CardFooterOwnProps = Record<never, never>;

/** Props of {@link CardFooter} rendered as `C` (default `'div'`), including `ref`. */
export type CardFooterProps<C extends React.ElementType = 'div'> = PolymorphicProps<
  C,
  CardFooterOwnProps
>;

/**
 * The action row of a {@link Card} (end-aligned). A selectable card with actions here needs
 * `selectionControl="checkbox"`. Flat export for React Server Components (`Card.Footer` in client
 * files).
 */
export const CardFooter: PolymorphicComponent<'div', CardFooterOwnProps> = (props) => {
  const { as, className, ref, ...rest } = props as CardSectionImplProps;
  const Component: React.ElementType = as ?? 'div';
  return (
    <Component ref={ref} className={cn('flex justify-end gap-2 p-4 pt-0', className)} {...rest} />
  );
};
CardFooter.displayName = 'CardFooter';

/**
 * Card with dotted sub-components (`Card.Header`, `Card.Body`, `Card.Footer`). In React Server
 * Components use the flat exports `CardHeader`, `CardBody` and `CardFooter` instead.
 */
export const Card = /* @__PURE__ */ Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});
