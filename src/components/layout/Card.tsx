import * as React from 'react';
import {
  cardBodyClassNames,
  cardClassNames,
  cardFooterClassNames,
  cardHeaderClassNames,
} from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { hasWarned, isDev, warnOnce } from '../../lib/dev';
import { getTabbableElements } from '../../lib/focus';
import { CheckIcon } from '../../lib/icons';
import { materialiseSlotContent, renderSlot, slotRendersContent } from '../../lib/slot';
import { focusRing, forcedColors } from '../../lib/styles';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import type { CoreSize, Orientation, Slot } from '../../lib/types';
import { CardCornersContext, CardOrientationContext } from './Card.context';
import { CardPreview } from './Card.preview';

export { CardPreview };
export type { CardPreviewOwnProps, CardPreviewProps } from './Card.preview';
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

/** The look of a Card: a filled surface with a shadow, a muted fill, an outline, or no surface. */
export type CardAppearance = 'filled' | 'filled-alternative' | 'outline' | 'subtle';

/**
 * Surface, border and shadow of a card per appearance, and the hover and pressed fills of a
 * selectable one (`filled` lifts its shadow instead of changing its fill). Literal strings only.
 */
const cardAppearanceClasses: Readonly<
  Record<CardAppearance, { surface: string; interactive: string }>
> = {
  filled: {
    surface: 'border border-border bg-card shadow-4',
    interactive: 'not-disabled:not-aria-disabled:hover:shadow-8',
  },
  'filled-alternative': {
    surface: 'border border-transparent bg-muted',
    interactive:
      'not-disabled:not-aria-disabled:hover:bg-muted-hover not-disabled:not-aria-disabled:active:bg-muted-pressed',
  },
  outline: {
    surface: 'border border-border bg-transparent',
    interactive:
      'not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed',
  },
  subtle: {
    surface: 'border border-transparent bg-transparent',
    interactive:
      'not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed',
  },
};

/** The padding the parts of a card read (`--wave-card-padding`), per size. */
const cardSizeClasses: Readonly<Record<CoreSize, string>> = {
  small: '[--wave-card-padding:0.75rem]',
  medium: '[--wave-card-padding:1rem]',
  large: '[--wave-card-padding:1.25rem]',
};

/**
 * The Card's own props (the XOwnProps rule of `PolymorphicProps`: component-specific props only).
 * Every other prop comes from the rendered element (`as`).
 */
export interface CardOwnProps {
  /**
   * Look of the card: `filled` (a surface with a border and a shadow), `filled-alternative` (a
   * muted fill), `outline` (a border only) or `subtle` (no surface until hovered or selected). A
   * selectable card gets a hover and pressed look for its appearance; the selected look is the
   * same in every appearance.
   * @default 'filled'
   */
  appearance?: CardAppearance;
  /**
   * Padding of the card's parts: `small` 0.75rem, `medium` 1rem, `large` 1.25rem.
   * @default 'medium'
   */
  size?: CoreSize;
  /**
   * Layout of the card's parts: `vertical` stacks them, `horizontal` puts them in a row (put the
   * text parts in one wrapper element to keep them stacked beside a `Card.Preview`).
   * @default 'vertical'
   */
  orientation?: Orientation;
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
  /**
   * The built-in checkbox of `selectionControl="checkbox"`: an object of `<input>` attributes is
   * merged onto it (a class, `aria-describedby`, `name`; its type, checked state and change
   * handling stay the card's), an element replaces it (give that control its own name and call
   * `onSelect` from it), and `null` or `false` removes it, for a control you render elsewhere.
   * Ignored with the default `selectionControl`.
   */
  checkbox?: Slot<'input'>;
  /**
   * An action over the top end corner of the card (a menu button, say). A card with one is
   * positioned; with `selectionControl="checkbox"` the built-in checkbox then moves to the top
   * start corner. Content that renders nothing renders no element.
   */
  floatingAction?: Slot<'span'>;
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

// The Card root, documented on the exported `Card` const.
const CardRoot: PolymorphicComponent<'div', CardOwnProps> = (props) => {
  const {
    as,
    selected,
    onSelect,
    selectionControl = 'card',
    selectLabel,
    checkbox,
    floatingAction,
    appearance = 'filled',
    size = 'medium',
    orientation = 'vertical',
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
  const hasFloatingAction = floatingAction !== undefined && slotRendersContent(floatingAction);
  // The built-in checkbox: not with `checkbox={null | false}` (the consumer renders the control)
  // nor with an element (it replaces it); an object is merged onto it.
  const checkboxHidden = checkbox === null || checkbox === false;
  const checkboxElement = React.isValidElement(checkbox) ? checkbox : null;
  const builtInCheckbox = checkboxMode && !checkboxHidden && checkboxElement === null;
  const checkboxProps =
    typeof checkbox === 'object' &&
    checkbox !== null &&
    !React.isValidElement(checkbox) &&
    !Array.isArray(checkbox)
      ? (checkbox as React.InputHTMLAttributes<HTMLInputElement>)
      : undefined;
  const corners = React.useMemo(
    () => ({
      checkboxAtStart: builtInCheckbox && hasFloatingAction,
      floatingAction: hasFloatingAction,
    }),
    [builtInCheckbox, hasFloatingAction],
  );
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
    if (builtInCheckbox && !selectLabel && !root.ownerDocument.getElementById(titleId)) {
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
      <CardCornersContext.Provider value={corners}>
        <CardOrientationContext.Provider value={orientation}>
          <Component
            {...defaults}
            {...rest}
            ref={mergedRef}
            data-selected={selected ? '' : undefined}
            data-appearance={appearance}
            data-size={size}
            data-orientation={orientation}
            className={cn(
              cardClassNames.root,
              'overflow-hidden rounded-md',
              cardAppearanceClasses[appearance].surface,
              cardSizeClasses[size],
              orientation === 'horizontal' && 'flex flex-row',
              // Positions the check glyph / checkbox; plain cards keep their 0.4 positioning.
              (selectable || selected !== undefined || hasFloatingAction) && 'relative',
              selected &&
                cn(
                  'border-primary bg-selected text-selected-foreground ring-1 ring-inset ring-primary',
                  forcedColors.selectedContainer,
                ),
              selectable && 'cursor-pointer',
              selectable && !selected && cardAppearanceClasses[appearance].interactive,
              cardMode && focusRing,
              className,
            )}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onBlur={handleBlur}
          >
            {builtInCheckbox && (
              <input
                {...checkboxProps}
                type="checkbox"
                checked={selected ?? false}
                onChange={composeEventHandlers(checkboxProps?.onChange, () => onSelect())}
                aria-label={checkboxProps?.['aria-label'] ?? selectLabel}
                aria-labelledby={
                  (checkboxProps?.['aria-label'] ?? selectLabel)
                    ? undefined
                    : (checkboxProps?.['aria-labelledby'] ?? titleId)
                }
                className={cn(
                  cardClassNames.checkbox,
                  'absolute top-3 m-0 size-4 cursor-pointer accent-primary',
                  hasFloatingAction ? 'start-3' : 'end-3',
                  focusRing,
                  checkboxProps?.className,
                )}
              />
            )}
            {checkboxMode && checkboxElement}
            {hasFloatingAction &&
              renderSlot(
                floatingAction,
                'span',
                cn(cardClassNames.floatingAction, 'absolute end-3 top-3 inline-flex'),
              )}
            {selected && !checkboxMode && (
              <CheckIcon
                size={12}
                className={cn(cardClassNames.checkmark, 'absolute end-2 top-2 text-primary')}
              />
            )}
            {children}
          </Component>
        </CardOrientationContext.Provider>
      </CardCornersContext.Provider>
    </CardTitleIdContext.Provider>
  );
};
CardRoot.displayName = 'Card';

/** The Card.Header's own props (component-specific props only). */
export interface CardHeaderOwnProps {
  /**
   * Title content displayed in the card header. It also names a selectable card's built-in
   * checkbox (`selectionControl="checkbox"`). Content that renders nothing (`''`, `[]`, a list of
   * nothing) renders no title element; `0` is content.
   */
  title?: React.ReactNode;
  /** Subtitle content displayed below the title (none when it renders nothing, as `title`). */
  subtitle?: React.ReactNode;
  /**
   * An image beside the text, at the start: an `Avatar`, an icon, a logo. A value that renders
   * nothing renders no element.
   */
  image?: Slot<'span'>;
  /**
   * An action beside the text, at the end: a menu button, say. A value that renders nothing
   * renders no element.
   */
  action?: Slot<'span'>;
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
  const { as, title, subtitle, image, action, className, children, ref, ...rest } =
    props as CardHeaderImplProps;
  const Component: React.ElementType = as ?? 'div';
  /** Set only inside a `selectionControl="checkbox"` card: the title names its checkbox. */
  const titleId = React.useContext(CardTitleIdContext);
  // A title or subtitle that renders nothing (`''`, `[]`, a list of nothing) gets no element, so a
  // checkbox card with such a title warns about its missing name; `0` is content.
  const hasTitle = slotRendersContent(title);
  const hasSubtitle = slotRendersContent(subtitle);
  const hasImage = image !== undefined && slotRendersContent(image);
  const hasAction = action !== undefined && slotRendersContent(action);
  const corners = React.useContext(CardCornersContext);
  const text = (
    <>
      {hasTitle && (
        <div
          id={titleId ?? undefined}
          className={cn(cardHeaderClassNames.title, 'text-subtitle-1')}
        >
          {materialiseSlotContent(title)}
        </div>
      )}
      {hasSubtitle && (
        <div className={cn(cardHeaderClassNames.subtitle, 'text-caption-1 text-muted-foreground')}>
          {materialiseSlotContent(subtitle)}
        </div>
      )}
      {children}
    </>
  );
  return (
    // In a checkbox card the header keeps clear of the checkbox in the top end corner.
    <Component
      ref={ref}
      className={cn(
        cardHeaderClassNames.root,
        'p-[var(--wave-card-padding,1rem)]',
        ((titleId && !corners.checkboxAtStart) || corners.floatingAction) && 'pe-10',
        corners.checkboxAtStart && 'ps-10',
        (hasImage || hasAction) &&
          cn(
            'grid items-center gap-x-3',
            hasImage && hasAction
              ? 'grid-cols-[auto_1fr_auto]'
              : hasImage
                ? 'grid-cols-[auto_1fr]'
                : 'grid-cols-[1fr_auto]',
          ),
        className,
      )}
      {...rest}
    >
      {hasImage &&
        renderSlot(
          image,
          'span',
          cn(cardHeaderClassNames.image, 'inline-flex shrink-0 items-center'),
        )}
      {hasImage || hasAction ? <div className={cardHeaderClassNames.text}>{text}</div> : text}
      {hasAction &&
        renderSlot(
          action,
          'span',
          cn(cardHeaderClassNames.action, 'inline-flex shrink-0 items-center'),
        )}
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
  return (
    <Component
      ref={ref}
      className={cn(cardBodyClassNames.root, 'p-[var(--wave-card-padding,1rem)] pt-0', className)}
      {...rest}
    />
  );
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
    <Component
      ref={ref}
      className={cn(
        cardFooterClassNames.root,
        'flex justify-end gap-2 p-[var(--wave-card-padding,1rem)] pt-0',
        className,
      )}
      {...rest}
    />
  );
};
CardFooter.displayName = 'CardFooter';

/**
 * A surface that groups related content, with `Card.Header`, `Card.Preview`, `Card.Body` and
 * `Card.Footer`.
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
 * `CardPreview`, `CardBody` and `CardFooter` there; `Card.Header` etc. work in client files.
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
export const Card = /* @__PURE__ */ Object.assign(CardRoot, {
  Header: CardHeader,
  Preview: CardPreview,
  Body: CardBody,
  Footer: CardFooter,
});
