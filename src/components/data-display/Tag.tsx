import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import { mergeProps } from '../../lib/mergeProps';
import { getElementType } from '../../lib/children';
import {
  materialiseSlotContent,
  renderSlot,
  slotRendersContent,
  slotWrapsDefaultContent,
} from '../../lib/slot';
import { focusRing } from '../../lib/styles';
import { DismissIcon } from '../../lib/icons';
import { hasRenderedTextLabel, hasTextLabel, observeTextLabel } from '../../lib/labelInName';
import type { Slot, SlotObject } from '../../lib/slot';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import { useId } from '../../hooks/useId';
import { Button } from '../button/Button';

/**
 * The Tag's own props (the XOwnProps rule of `PolymorphicProps`: component-specific props only).
 * Every other prop comes from the rendered element (`as`, default `span`).
 */
export interface TagOwnProps {
  /**
   * Whether the tag renders a dismiss button. `onDismiss` and `dismissIcon` take effect only with
   * it (a development warning says so when they are passed without it).
   */
  dismissible?: boolean;
  /**
   * Called when the dismiss button is activated (click, Enter or Space). Passing it does not render
   * the dismiss button: set `dismissible` too.
   */
  onDismiss?: () => void;
  /**
   * Content of the dismiss button (an icon). The Tag always renders its own dismiss
   * `<button type="button">`, wired to `onDismiss` and named by `dismissLabel` plus the tag
   * content; this slot only replaces the icon inside it.
   *
   * A `<button>` element or a Wave `Button` passed here is not nested (a button cannot contain a
   * button): its props are merged into the dismiss button (its `onClick` runs first and can call
   * `preventDefault()` to skip `onDismiss`) and a development warning recommends icon content.
   * A slot object with button props (`type`, `disabled`, event handlers, `as: 'button'` or
   * `as: Button`) is the deprecated 0.4 button-object form: all its props except `children`
   * (`className`, `id`, `aria-*`, handlers, …) are merged onto the dismiss button, and a Wave
   * Button's `icon` becomes decorative content — pass icon content and use `onDismiss` instead.
   * The `aria-*` attributes of an icon slot object also go to the dismiss button, because the icon
   * is `aria-hidden`.
   *
   * The dismiss button's name is `dismissLabel` plus the tag content ("Dismiss Cherry"):
   * `aria-label` and `aria-labelledby` on the slot are ignored (development warning). Icon
   * content is decorative (`aria-hidden`). The children of a merged `<button>`/`Button` (or its
   * `dangerouslySetInnerHTML` markup) are rendered as is inside the dismiss button, after the
   * decorative `icon` of a Wave `Button`: when they render a text label (at least two letters or
   * digits outside `aria-hidden`/`hidden` content, text from components such as translations
   * included), that text replaces `dismissLabel` in the name, so the name contains the visible
   * label (WCAG 2.5.3): `<button>Remove</button>` or
   * `<Button icon={<CloseIcon />}>Remove</Button>` on "Cherry" is named "Remove Cherry". An icon or
   * a lone character (`x`, `×`) keeps "Dismiss Cherry". Text hidden only with CSS still counts as
   * the label.
   *
   * When the slot renders no content (`[]`, `<></>`, a childless merged button, a slot object
   * without `children`), the default dismiss icon is shown; a slot object then styles it, e.g.
   * `{ className: 'text-error' }`. A slot object that renders a component or a void element
   * (`{ as: CloseIcon }`, `{ as: 'img', src, alt: '' }`) or sets `dangerouslySetInnerHTML` is the
   * icon itself: no default icon is added. Only takes effect with `dismissible`.
   */
  dismissIcon?: Slot<'span'> | SlotObject<'button'>;
  /**
   * Visually hidden text that names the dismiss button together with the tag content
   * (`aria-labelledby`), e.g. "Dismiss Cherry". Localise it here. A text label rendered by a
   * merged `<button>` slot replaces it (see `dismissIcon`).
   * @default 'Dismiss'
   */
  dismissLabel?: string;
}

/**
 * Props of {@link Tag} rendered as `C` (default `'span'`). `TagProps` without a type argument is
 * the 0.4 name.
 */
export type TagProps<C extends React.ElementType = 'span'> = PolymorphicProps<C, TagOwnProps>;

/** The props the implementation reads, for any `as` (the public typing is `PolymorphicComponent`). */
type TagImplProps = TagOwnProps &
  React.HTMLAttributes<HTMLElement> & {
    as?: React.ElementType;
    ref?: React.Ref<HTMLElement>;
  };

type UnknownProps = Record<string, unknown>;

/** Attributes that only make sense on the dismiss `<button>` itself. */
const BUTTON_ONLY_KEYS: ReadonlySet<string> = new Set([
  'type',
  'disabled',
  'autoFocus',
  'form',
  'formAction',
  'formEncType',
  'formMethod',
  'formNoValidate',
  'formTarget',
  'name',
  'value',
]);

const HANDLER_KEY = /^on[A-Z]/;

/**
 * Naming attributes a slot cannot set: the Tag names its dismiss button itself
 * (`aria-labelledby` = `dismissLabel` + tag content, data-display#10), so these are dropped.
 */
const NAME_KEYS: ReadonlySet<string> = new Set(['aria-label', 'aria-labelledby']);

/** Wave Button props that are not DOM attributes (the rest are merged onto the dismiss button). */
interface WaveButtonSlotProps extends UnknownProps {
  as?: unknown;
  appearance?: unknown;
  size?: unknown;
  icon?: Slot<'span'>;
  children?: React.ReactNode;
  dangerouslySetInnerHTML?: React.HTMLAttributes<HTMLElement>['dangerouslySetInnerHTML'];
}

/** Wave `Button` props of a `{ as: Button, … }` slot object that are not DOM attributes. */
const WAVE_BUTTON_KEYS: ReadonlySet<string> = new Set(['appearance', 'size', 'icon']);

interface ResolvedDismissSlot {
  /** Props merged onto the wired dismiss button (`null`: none). */
  buttonProps: UnknownProps | null;
  /** What renders inside the dismiss button. */
  content: React.ReactNode;
  /** Which development warning the slot needs. */
  warning: 'button-element' | 'button-object' | null;
  /** Whether the slot passed `aria-label`/`aria-labelledby`, which the Tag ignores. */
  ignoredName: boolean;
  /**
   * `true` when the content is rendered as is (a merged `<button>`/`Button`), so a text label in it
   * replaces `dismissLabel` in the name (C-SLOTS naming, WCAG 2.5.3); `false` when the content is
   * decorative (`aria-hidden`).
   */
  contentMayName: boolean;
  /**
   * Whether the literal content contains a text label: the name for the server render and the
   * first client render. After mount the rendered content decides.
   */
  literalTextLabel: boolean;
}

const noop = () => {};

/** `props` without the naming attributes, and whether any was set. */
function withoutName(props: UnknownProps): { props: UnknownProps; ignoredName: boolean } {
  const result: UnknownProps = {};
  let ignoredName = false;
  for (const [key, value] of Object.entries(props)) {
    if (NAME_KEYS.has(key)) {
      if (value !== undefined) ignoredName = true;
    } else {
      result[key] = value;
    }
  }
  return { props: result, ignoredName };
}

const iconClassName = 'inline-flex items-center justify-center';

function isPlainObject(value: unknown): value is UnknownProps {
  if (typeof value !== 'object' || value === null) return false;
  if (React.isValidElement(value) || Symbol.iterator in value) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/** The decorative default dismiss glyph. */
function defaultDismissContent(): React.ReactNode {
  return <DismissIcon size={12} />;
}

/**
 * Splits the dismissIcon slot into dismiss-button props and icon content (C-SLOTS). The icon
 * content is `aria-hidden`, so no attribute that means something to assistive technology stays on
 * it: button-form props go to the dismiss button, and so do the `aria-*` attributes of an icon slot
 * object; the naming attributes are dropped (see {@link NAME_KEYS}).
 *
 * Content that renders nothing (`[]`, `<></>`, a childless merged button, a slot object without
 * `children`) shows the default icon, so the dismiss button is never an empty, invisible Tab stop.
 */
function resolveDismissSlot(slot: TagOwnProps['dismissIcon']): ResolvedDismissSlot {
  if (!slotRendersContent(slot)) {
    return {
      buttonProps: null,
      content: defaultDismissContent(),
      warning: null,
      ignoredName: false,
      contentMayName: false,
      literalTextLabel: false,
    };
  }

  // A `<button>` or a Wave `Button` (also one written in a Server Component, whose type arrives as
  // a lazy reference) is merged into the dismiss button. Its content is rendered as is, after the
  // Button's icon, which is decorative (as in MessageBar and SearchBox); its text label names it.
  const elementType = getElementType(slot as React.ReactNode);
  if (
    React.isValidElement<WaveButtonSlotProps>(slot) &&
    (elementType === 'button' || elementType === Button)
  ) {
    const { children, dangerouslySetInnerHTML: markup, ...elementProps } = slot.props;
    let icon: Slot<'span'> | undefined;
    let slotProps: UnknownProps = elementProps;
    if (elementType === Button) {
      const {
        as: _as,
        appearance: _appearance,
        size: _size,
        icon: buttonIcon,
        ...rest
      } = elementProps;
      icon = buttonIcon;
      slotProps = rest;
    }
    const { props: buttonProps, ignoredName } = withoutName(slotProps);
    const iconNode = slotRendersContent(icon)
      ? renderSlot(icon, 'span', iconClassName, { 'aria-hidden': true })
      : null;
    // A generator is read once by the check; its items are what renders (and names the button).
    // Markup of the merged button (`dangerouslySetInnerHTML`) is its content as well: the dismiss
    // button holds its own name text, so the markup renders in a span inside it.
    const ownContent =
      markup != null ? (
        <span className={iconClassName} dangerouslySetInnerHTML={markup} />
      ) : (
        materialiseSlotContent(children)
      );
    return {
      buttonProps,
      content:
        iconNode || slotRendersContent(ownContent) ? (
          <>
            {iconNode}
            {ownContent}
          </>
        ) : (
          defaultDismissContent()
        ),
      warning: 'button-element',
      ignoredName,
      contentMayName: true,
      literalTextLabel: hasTextLabel(ownContent),
    };
  }

  if (isPlainObject(slot)) {
    // 0.4 rendered the whole object as the dismiss element, so an object with button props
    // describes the button: everything but its content goes to the dismiss button. `as: Button`
    // is that form too (a button cannot contain a button); its icon becomes decorative content.
    const asWaveButton = slot.as === Button;
    const isButtonObject =
      slot.as === 'button' ||
      asWaveButton ||
      Object.keys(slot).some((key) => BUTTON_ONLY_KEYS.has(key) || HANDLER_KEY.test(key));
    const buttonProps: UnknownProps = {};
    const contentProps: UnknownProps = {};
    let ignoredName = false;
    let buttonIcon: unknown;
    for (const [key, value] of Object.entries(slot)) {
      if (key === 'as') {
        if (value !== 'button' && !asWaveButton) contentProps.as = value;
      } else if (asWaveButton && WAVE_BUTTON_KEYS.has(key)) {
        if (key === 'icon') buttonIcon = value;
      } else if (NAME_KEYS.has(key)) {
        if (value !== undefined) ignoredName = true;
      } else if (key === 'children' || key === 'dangerouslySetInnerHTML') {
        // Content, also in the button-object form: the dismiss button holds its own name text.
        contentProps[key] = value;
      } else if (isButtonObject || (key.startsWith('aria-') && key !== 'aria-hidden')) {
        buttonProps[key] = value;
      } else {
        contentProps[key] = value;
      }
    }
    // An object without content styles the default icon, e.g. `{ className: 'text-error' }` (as in
    // MessageBar and SearchBox); a Wave Button's icon comes first, in front of the content.
    if (slotRendersContent(buttonIcon)) {
      contentProps.children = (
        <>
          {renderSlot(buttonIcon as Slot<'span'>, 'span', iconClassName)}
          {materialiseSlotContent(contentProps.children)}
        </>
      );
    } else if (slotWrapsDefaultContent(contentProps.as ?? 'span', contentProps)) {
      contentProps.children = defaultDismissContent();
    }
    return {
      buttonProps: isButtonObject || Object.keys(buttonProps).length > 0 ? buttonProps : null,
      content: renderSlot(contentProps as SlotObject<'span'>, 'span', iconClassName, {
        'aria-hidden': true,
      }),
      warning: isButtonObject ? 'button-object' : null,
      ignoredName,
      contentMayName: false,
      literalTextLabel: false,
    };
  }

  return {
    buttonProps: null,
    content: renderSlot(slot as Slot<'span'>, 'span', iconClassName, { 'aria-hidden': true }),
    warning: null,
    ignoredName: false,
    contentMayName: false,
    literalTextLabel: false,
  };
}

/**
 * A compact label (a "chip") for a keyword, category or filter, optionally dismissible.
 *
 * - The dismiss button is a real `<button type="button">` wired to `onDismiss`. Its accessible
 *   name is `dismissLabel` plus the tag content ("Dismiss Cherry"), so a row of tags has
 *   distinguishable dismiss buttons.
 * - `dismissIcon` replaces only the icon inside that button (see {@link TagOwnProps.dismissIcon}).
 * - Polymorphic: `as="a"` renders a link chip with anchor props type-checked.
 *
 * @example
 * <Tag>React</Tag>
 * <Tag dismissible onDismiss={() => remove('cherry')}>Cherry</Tag>
 * <Tag dismissible dismissLabel="Remove" dismissIcon={<CloseIcon />}>Cherry</Tag>
 */
export const Tag: PolymorphicComponent<'span', TagOwnProps> = (props) => {
  const {
    as,
    dismissible,
    onDismiss,
    dismissIcon,
    dismissLabel = 'Dismiss',
    className,
    children,
    ref,
    ...rest
  } = props as TagImplProps;
  const Component: React.ElementType = as ?? 'span';
  const contentId = useId('tag-content');
  const dismissLabelId = useId('tag-dismiss');
  const dismissTextId = useId('tag-dismiss-text');

  const {
    buttonProps: slotButtonProps,
    content,
    warning,
    ignoredName,
    contentMayName,
    literalTextLabel,
  } = resolveDismissSlot(dismissible ? dismissIcon : undefined);

  // C-SLOTS naming (WCAG 2.5.3 Label in Name): the rendered text label of a merged button replaces
  // `dismissLabel` in the name ("Remove Cherry"). The literal content decides on the server and on
  // the first render; after mount, the rendered content does (text from components, later changes).
  const [labelTarget, setLabelTarget] = React.useState<HTMLSpanElement | null>(null);
  const subscribeToContent = React.useCallback(
    (onChange: () => void) => (labelTarget ? observeTextLabel(labelTarget, onChange) : noop),
    [labelTarget],
  );
  const contentHasTextLabel = React.useSyncExternalStore(
    subscribeToContent,
    () => (labelTarget ? hasRenderedTextLabel(labelTarget) : literalTextLabel),
    () => literalTextLabel,
  );
  const namedByContent = contentMayName && contentHasTextLabel;

  React.useEffect(() => {
    if (warning === 'button-element') {
      warnOnce(
        'Tag:dismissIcon-button',
        'Tag: `dismissIcon` received a button. Its props were merged into the built-in dismiss button (a button cannot contain another button), which is named by its text label (or `dismissLabel`) and the tag content. Pass icon content instead, e.g. `dismissIcon={<CloseIcon />}`, and handle the dismissal in `onDismiss`.',
      );
    } else if (warning === 'button-object') {
      warnDeprecated(
        'Tag',
        'dismissIcon={{ onClick, type, disabled, … }} (button props on the slot object)',
        'onDismiss and icon content in dismissIcon',
        'Its props are merged onto the built-in dismiss button, which is named by `dismissLabel` and the tag content.',
      );
    }
  }, [warning]);

  // `onDismiss`/`dismissIcon` alone render no dismiss button (unlike MessageBar's `onDismiss`).
  // An explicit `dismissible={false}` is a deliberate state, so only a missing flag warns.
  const dismissPropsIgnored =
    dismissible === undefined && (onDismiss !== undefined || dismissIcon !== undefined);
  React.useEffect(() => {
    if (dismissPropsIgnored) {
      warnOnce(
        'Tag:dismiss-without-dismissible',
        'Tag: `onDismiss` and `dismissIcon` take effect only with `dismissible`; no dismiss button was rendered. Add `dismissible` to render it.',
      );
    }
  }, [dismissPropsIgnored]);

  React.useEffect(() => {
    if (ignoredName) {
      warnOnce(
        'Tag:dismissIcon-name',
        'Tag: `aria-label`/`aria-labelledby` on `dismissIcon` are ignored. The dismiss button is named by `dismissLabel` (default "Dismiss") and the tag content, e.g. "Dismiss Cherry"; set `dismissLabel` to change or localise it.',
      );
    }
  }, [ignoredName]);

  const ownButtonProps: UnknownProps = {
    type: 'button',
    className: cn(
      'inline-flex size-5 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-foreground',
      'not-disabled:not-aria-disabled:hover:bg-subtle-pressed',
      'disabled:cursor-not-allowed disabled:opacity-50',
      focusRing,
    ),
    'aria-labelledby': `${namedByContent ? dismissTextId : dismissLabelId} ${contentId}`,
  };
  if (onDismiss) ownButtonProps.onClick = onDismiss;
  const dismissButtonProps = slotButtonProps
    ? mergeProps(ownButtonProps, slotButtonProps)
    : ownButtonProps;

  return (
    <Component
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-muted py-1 ps-3 text-body-1 text-foreground',
        dismissible ? 'pe-1.5' : 'pe-3',
        className,
      )}
      {...rest}
    >
      <span id={contentId} className="inline-flex items-center gap-1">
        {children}
      </span>
      {dismissible && (
        <button
          {...dismissButtonProps}
          type={(dismissButtonProps.type as 'button' | 'submit' | 'reset' | undefined) ?? 'button'}
        >
          <span id={dismissLabelId} className="sr-only">
            {dismissLabel}
          </span>
          {contentMayName ? (
            // The merged button's own content, rendered as is: its text label can name the button.
            // `gap-[inherit]` keeps a gap set on the button between the content items.
            <span
              id={dismissTextId}
              ref={setLabelTarget}
              className="inline-flex items-center justify-center gap-[inherit]"
            >
              {content}
            </span>
          ) : (
            content
          )}
        </button>
      )}
    </Component>
  );
};

Tag.displayName = 'Tag';
