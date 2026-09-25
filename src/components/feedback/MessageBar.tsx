import * as React from 'react';
import { isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { DismissIcon } from '../../lib/icons';
import { hasRenderedTextLabel, hasTextLabel, observeTextLabel } from '../../lib/labelInName';
import { mergeProps } from '../../lib/mergeProps';
import {
  VOID_ELEMENTS,
  materialiseSlotContent,
  renderSlot,
  resolveSlot,
  slotRendersContent,
} from '../../lib/slot';
import { focusRing } from '../../lib/styles';
import type { Status, Slot, SlotObject } from '../../lib/types';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { Button } from '../button/Button';
import {
  STATUS_BORDER,
  STATUS_ICON_COLOR,
  StatusIcon,
  StatusText,
  getStatusLabel,
} from './MessageBar.status';

/** Properties for the MessageBar component. */
export interface MessageBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Status level controlling the color, icon, status text and role of the message bar.
   * `warning` and `error` render `role="alert"`, `info` and `success` `role="status"` (a consumer
   * `role` wins).
   * @default 'info'
   */
  status?: Status;
  /**
   * Visually hidden text read before the message so screen-reader users hear the severity
   * (`'Info:'`, `'Success:'`, `'Warning:'`, `'Error:'` by default). Pass a translation for other
   * languages, or `''` when the message text already states the severity.
   */
  statusLabel?: string;
  /**
   * Called when the dismiss button is activated. Passing it renders the dismiss button (unless
   * `dismiss` is `null`).
   */
  onDismiss?: () => void;
  /**
   * Custom status icon, rendered decoratively (`aria-hidden="true"`, a slot object can override
   * it) in the status color. `null` renders no icon.
   */
  icon?: Slot<'span'>;
  /**
   * Content of the dismiss button (replaces the default dismiss icon). It always renders **inside**
   * the built-in `<button type="button" aria-label="Dismiss">`, which calls `onDismiss`; passing
   * content shows the dismiss button even without `onDismiss`. `null` is the only value that hides
   * the button. A boolean counts as no slot, so the conditional idiom
   * `dismiss={useBrandIcon && <BrandCloseIcon />}` keeps the default button: the default icon with
   * `onDismiss`, no button without it. Content that renders nothing (`''`, or an array or Fragment
   * of only `null`, `false`, `true` and `''`, also as the children of a slot object or a merged
   * button) keeps the default icon, so the button is never empty; a slot object that renders a
   * component or a void element (`{ as: CloseIcon }`, `{ as: 'img', src, alt: '' }`) or sets
   * `dangerouslySetInnerHTML` is the icon itself. The content is
   * decorative (`aria-hidden`), so the button keeps the name "Dismiss": when the content is
   * visible text, pass a slot object whose `aria-label` matches it
   * (`{ children: 'Close', 'aria-label': 'Close' }`) so the name contains the visible label. An
   * `aria-label`, `aria-labelledby` or `title` on a slot object names the button instead of
   * "Dismiss".
   *
   * A `<button>` element or a Wave `Button` passed here is not nested: its props are merged into
   * the built-in button (its `onClick` runs first and can call `preventDefault()` to cancel
   * `onDismiss`; its `aria-label` and an explicit `type` win over the defaults) and its content is
   * used as is, with a development warning. When the rendered content has a text label (at least
   * two letters or digits: `<button>Close</button>`, or text rendered by a component such as a
   * translation), that text names the button, as in 0.4. An icon, a lone character (`X`, `×`,
   * `+`: a symbol, not a label) and text that is `aria-hidden` or `hidden` keep the name
   * "Dismiss". Text hidden only with CSS still counts as the label: a responsive label such as
   * `<span className="hidden sm:inline">Close</span>` drops the default name, so the button has
   * no name wherever that text is not displayed. Give such a button an explicit `aria-label`
   * (`<button aria-label="Close">…</button>`). An `aria-label`, `aria-labelledby` or `title` on
   * the element names the button.
   *
   * The 0.4 button-object form (`{ as: 'button', onClick, … }` or an object with button props) is
   * **deprecated**: its button props (`type` included), `className` and `style` are merged the
   * same way. Pass icon content instead, e.g. `dismiss={<CloseIcon />}`.
   */
  dismiss?: Slot<'span'> | SlotObject<'button'>;
  /** Message content to display. */
  children: React.ReactNode;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

const tintClasses: Record<Status, string> = {
  info: 'bg-info-tint',
  success: 'bg-success-tint',
  warning: 'bg-warning-tint',
  error: 'bg-error-tint',
};

type UnknownProps = Record<string, unknown>;

/** Name of the dismiss button when nothing else names it. */
const DEFAULT_DISMISS_LABEL = 'Dismiss';

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
  'popoverTarget',
  'popoverTargetAction',
]);

/**
 * Attributes that name the dismiss button. On a slot object they go to the button (its content is
 * decorative); on the merged button, any of them replaces the default `aria-label`.
 */
const NAMING_KEYS: ReadonlySet<string> = new Set(['aria-label', 'aria-labelledby', 'title']);

const HANDLER_KEY = /^on[A-Z]/;

/** Wave `Button` props that do not belong on a native `<button>` (its `icon` becomes content). */
const BUTTON_COMPONENT_KEYS: ReadonlySet<string> = new Set(['as', 'appearance', 'size', 'icon']);

const dismissContentClassName = 'inline-flex items-center justify-center';

interface DismissParts {
  /** Props merged onto the wired dismiss button. */
  buttonProps: UnknownProps;
  /** What renders inside the dismiss button. */
  content: React.ReactNode;
  /**
   * `true` when the content is rendered as is (a merged `<button>`/`Button`), so a text label in it
   * names the button (C-SLOTS naming, WCAG 2.5.3 Label in Name); `false` when the content is
   * decorative (`aria-hidden`).
   */
  contentMayName: boolean;
  /**
   * Whether the content's literal children contain a text label. Used for the server render and
   * the first client render; after mount, the rendered button's text decides (see
   * {@link hasRenderedTextLabel}).
   */
  literalTextLabel: boolean;
  /** Which development warning the slot needs. */
  warning: 'button-element' | 'button-object' | null;
}

const noop = () => {};

/** The decorative default dismiss glyph. */
function defaultDismissContent(): React.ReactNode {
  return <DismissIcon />;
}

function isButtonType(type: unknown): boolean {
  return type === 'button' || type === Button;
}

/**
 * Whether a slot object's element shows the default dismiss icon inside it: when its children
 * render nothing and its element can hold children, so `{ className: 'text-error' }` styles the
 * default icon. A void tag (`img`) or a component (an icon that draws its own glyph) is the icon
 * itself, and `dangerouslySetInnerHTML` is content of its own.
 */
function wrapsDefaultIcon(tag: unknown, props: UnknownProps): boolean {
  if (typeof tag !== 'string' || VOID_ELEMENTS.has(tag)) return false;
  return props.dangerouslySetInnerHTML == null && !slotRendersContent(props.children);
}

/** The dismiss button without a slot: the default icon and name. */
function defaultDismiss(): DismissParts {
  return {
    buttonProps: {},
    content: defaultDismissContent(),
    contentMayName: false,
    literalTextLabel: false,
    warning: null,
  };
}

/**
 * Splits the `dismiss` slot into props for the wired dismiss button and the content rendered
 * inside it (C-SLOTS dismiss semantics). `null` means: no dismiss button. A boolean is no slot
 * (the default dismiss button), and content that renders nothing keeps the default icon.
 */
function resolveDismiss(dismiss: MessageBarProps['dismiss']): DismissParts | null {
  if (dismiss === null) return null;
  if (dismiss === undefined || typeof dismiss === 'boolean') return defaultDismiss();

  // A merged `<button>`/`Button` keeps its content accessible (as in 0.4): a text label names the
  // button, anything else (an icon, a lone character such as `X` or `×`) gets the default name.
  // The type is compared through `isElementOfType`, so a Button written in a Server Component
  // (a lazy client reference) is merged too.
  const element = dismiss as React.ReactNode;
  if (isElementOfType<UnknownProps>(element, 'button', Button)) {
    const buttonProps: UnknownProps = {};
    for (const [key, value] of Object.entries(element.props)) {
      if (key !== 'children' && !BUTTON_COMPONENT_KEYS.has(key)) buttonProps[key] = value;
    }
    // A generator is read once by the check; its items are what renders (and names the button).
    const children = materialiseSlotContent(element.props.children);
    // Wave Button's icon becomes decorative content in front of its children.
    const icon = element.props.icon as Slot<'span'>;
    const iconNode =
      isElementOfType(element, Button) && slotRendersContent(icon)
        ? renderSlot(icon, 'span', dismissContentClassName, { 'aria-hidden': true })
        : null;
    const content =
      iconNode || slotRendersContent(children) ? (
        <>
          {iconNode}
          {children}
        </>
      ) : (
        defaultDismissContent()
      );
    return {
      buttonProps,
      content,
      contentMayName: true,
      literalTextLabel: hasTextLabel(children),
      warning: 'button-element',
    };
  }

  // Everything else is classified by the slot system (F2): shorthand content resolves to the
  // default `span` with no attributes; a slot object resolves to its element and attributes.
  const resolved = resolveSlot(dismiss as Slot<'span'>, 'span');
  if (!resolved) return defaultDismiss();
  const { Component, props, children } = resolved;
  const asButton = isButtonType(Component);
  const isButtonObject =
    asButton ||
    Object.keys(props).some((key) => BUTTON_ONLY_KEYS.has(key) || HANDLER_KEY.test(key));
  const buttonProps: UnknownProps = {};
  const contentProps: UnknownProps = {};
  let iconNode: React.ReactNode = null;
  for (const [key, value] of Object.entries(props)) {
    if (Component === Button && BUTTON_COMPONENT_KEYS.has(key)) {
      if (key === 'icon' && slotRendersContent(value)) {
        iconNode = renderSlot(value as Slot<'span'>, 'span', dismissContentClassName, {
          'aria-hidden': true,
        });
      }
    } else if (
      BUTTON_ONLY_KEYS.has(key) ||
      HANDLER_KEY.test(key) ||
      NAMING_KEYS.has(key) ||
      // 0.4 rendered the object as the button itself: its className, style and ref stay there.
      (isButtonObject && (key === 'className' || key === 'style' || key === 'ref'))
    ) {
      buttonProps[key] = value;
    } else {
      contentProps[key] = value;
    }
  }

  // The content element: the object's own element, or a span for the button-object form. An
  // object whose children render nothing styles the default icon
  // (e.g. `{ className: 'text-error' }`), unless its element is the icon itself.
  const ContentTag: React.ElementType = asButton ? 'span' : Component;
  const elementProps = {
    'aria-hidden': true,
    ...contentProps,
    className: cn(dismissContentClassName, contentProps.className as string | undefined),
  };
  let inner: React.ReactNode = null;
  if (iconNode || slotRendersContent(children)) {
    inner = (
      <>
        {iconNode}
        {children}
      </>
    );
  } else if (wrapsDefaultIcon(ContentTag, { ...contentProps, children })) {
    inner = defaultDismissContent();
  }
  return {
    buttonProps,
    content:
      inner === null
        ? React.createElement(ContentTag, elementProps)
        : React.createElement(ContentTag, elementProps, inner),
    contentMayName: false,
    literalTextLabel: false,
    warning: isButtonObject ? 'button-object' : null,
  };
}

/**
 * An inline message that tells the user about the state of a page or task: a status icon, a
 * visually hidden status label ("Warning:"), the message and an optional dismiss button.
 *
 * - The status sets the tint, the logical start border, the icon and the role (`alert` for
 *   `warning`/`error`, `status` otherwise). Screen readers hear the severity through `statusLabel`.
 * - The dismiss button is always the MessageBar's own `<button>` wired to `onDismiss`
 *   (`type="button"` unless a merged button slot sets its own `type`); the `dismiss` slot only
 *   replaces its content (see {@link MessageBarProps.dismiss}).
 *
 * @example
 * <MessageBar status="warning" onDismiss={() => setVisible(false)}>
 *   Your subscription expires in 3 days.
 * </MessageBar>
 */
export const MessageBar = ({
  status = 'info',
  statusLabel,
  onDismiss,
  icon,
  dismiss,
  children,
  className,
  ref,
  ...rest
}: MessageBarProps) => {
  const iconClassName = cn('mt-0.5 inline-flex shrink-0', STATUS_ICON_COLOR[status]);
  const renderedIcon =
    icon !== undefined ? (
      renderSlot(icon, 'span', iconClassName, { 'aria-hidden': true })
    ) : (
      <span aria-hidden="true" className={iconClassName}>
        <StatusIcon status={status} size={20} />
      </span>
    );

  // A boolean `dismiss` is no slot (`dismiss={cond && <CloseIcon />}`): only `onDismiss` shows it.
  const showDismiss =
    onDismiss !== undefined || (dismiss !== undefined && typeof dismiss !== 'boolean');
  const dismissParts = showDismiss ? resolveDismiss(dismiss) : null;
  const dismissWarning = dismissParts?.warning ?? null;
  React.useEffect(() => {
    if (dismissWarning === 'button-element') {
      warnOnce(
        'MessageBar:dismiss-button-element',
        'MessageBar: `dismiss` received a button element; its props were merged into the built-in dismiss button (buttons cannot be nested). Pass icon content instead, e.g. `dismiss={<CloseIcon />}`, and use `onDismiss`.',
      );
    } else if (dismissWarning === 'button-object') {
      warnOnce(
        'MessageBar:dismiss-button-object',
        'MessageBar: the button-object form of `dismiss` is deprecated and will be removed in 1.0; its button props were merged into the built-in dismiss button. Pass icon content instead, e.g. `dismiss={<CloseIcon />}`, and use `onDismiss`.',
      );
    }
  }, [dismissWarning]);

  // The slot's ref joins ours through a stable merged ref (never a new callback per render).
  const { ref: slotRef, ...slotButtonProps } = dismissParts?.buttonProps ?? {};
  const hasOwnName = Object.keys(slotButtonProps).some(
    (key) => NAMING_KEYS.has(key) && slotButtonProps[key] != null,
  );

  // C-SLOTS naming (WCAG 2.5.3 Label in Name): a merged button's content names it when it renders
  // a text label (at least two letters or digits; a lone `X` or `×` is a glyph), and the default
  // `aria-label` would hide that label. The literal children decide on the server and on the first
  // render; after mount, the rendered button's text does (text from components, e.g. translations,
  // and later changes).
  const checksContent = dismissParts !== null && dismissParts.contentMayName && !hasOwnName;
  const literalTextLabel = dismissParts?.literalTextLabel ?? false;
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
  const dismissRef = useMergedRefs<HTMLButtonElement>(
    slotRef as React.Ref<HTMLButtonElement> | undefined,
    checksContent ? setLabelTarget : undefined,
  );

  let renderedDismiss: React.ReactNode = null;
  if (dismissParts) {
    const buttonProps = mergeProps(
      {
        'aria-label': hasOwnName || namedByContent ? undefined : DEFAULT_DISMISS_LABEL,
        onClick: () => onDismiss?.(),
        className: cn(
          'ms-auto inline-flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-1 text-muted-foreground',
          'not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:hover:text-foreground',
          'not-disabled:not-aria-disabled:active:bg-subtle-pressed',
          focusRing,
          'disabled:cursor-not-allowed disabled:opacity-50',
        ),
      },
      slotButtonProps,
    ) as React.ComponentPropsWithoutRef<'button'>;
    renderedDismiss = (
      // `type` is "button" unless the slot sets one (`null`, from JavaScript callers, means the
      // default too, so the button never submits an enclosing form by accident).
      <button {...buttonProps} ref={dismissRef} type={buttonProps.type ?? 'button'}>
        {dismissParts.content}
      </button>
    );
  }

  return (
    <div
      ref={ref}
      role={status === 'error' || status === 'warning' ? 'alert' : 'status'}
      {...rest}
      className={cn(
        'flex items-start gap-3 rounded border-s-4 px-4 py-3 text-foreground',
        tintClasses[status],
        STATUS_BORDER[status],
        className,
      )}
    >
      {renderedIcon}
      <div className="min-w-0 flex-1 text-body-1">
        <StatusText label={getStatusLabel(status, statusLabel)} />
        {children}
      </div>
      {renderedDismiss}
    </div>
  );
};

MessageBar.displayName = 'MessageBar';
