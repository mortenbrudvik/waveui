import * as React from 'react';
import { joinIds } from '../../lib/aria';
import { isElementOfType } from '../../lib/children';
import { messageBarClassNames } from '../../lib/classNames';
import { wcn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { DismissIcon } from '../../lib/icons';
import { hasRenderedTextLabel, hasTextLabel, observeTextLabel } from '../../lib/labelInName';
import { mergeProps } from '../../lib/mergeProps';
import {
  materialiseSlotContent,
  renderSlot,
  resolveSlot,
  resolveWiredSlot,
  slotRendersContent,
  slotWrapsDefaultContent,
} from '../../lib/slot';
import { HIDDEN_PART_LOCKS, mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { focusRing } from '../../lib/styles';
import type { Status, Slot } from '../../lib/types';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { Button } from '../button/Button';
import { useMessageBarReflow } from './MessageBar.reflow';
import { MessageBarContext, type MessageBarContextValue } from './MessageBar.context';
import {
  BUTTON_OWN_PROP_KEYS,
  MERGED_DISABLED_FOCUSABLE_PROPS,
  mergedAriaDisabledClasses,
  placeButtonIcon,
} from '../button/Button.slots';
import {
  STATUS_BORDER,
  STATUS_ICON_COLOR,
  StatusIcon,
  StatusText,
  getStatusLabel,
} from './MessageBar.status';
import {
  ACTIONS_PLACEMENT,
  CONTENT_PLACEMENT,
  EXTRA_TITLE_PLACEMENT,
  MessageBarActions,
  MessageBarPartContext,
  MessageBarTitle,
  partitionMessageBarChildren,
  useTitlePlacement,
} from './MessageBar.parts';
import { useAppClassName } from '../../hooks/useAppClassName';

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
   * it) in the status color. Only `undefined` keeps the default status icon; `null`, or anything that
   * renders nothing (`false`, `''`), shows no icon.
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
   * `onDismiss`; its `aria-label` and an explicit `type` win over the defaults) and its content
   * (children, or `dangerouslySetInnerHTML` markup) is used as is, with a development warning.
   * A Wave `Button`'s own props are not attributes: its `icon` becomes decorative content before
   * its children (after them with `iconPosition="after"`), `disabledFocusable` makes the dismiss
   * button unavailable but focusable as on the Button (`onDismiss` is not called), and
   * `appearance` and `size` are ignored.
   * When the rendered content has a text label (at least two letters or digits:
   * `<button>Close</button>`, or text rendered by a component such as a translation), that text
   * names the button, as in 0.4. An icon, a lone character (`X`, `×`,
   * `+`: a symbol, not a label) and text that is `aria-hidden` or `hidden` keep the name
   * "Dismiss". Text hidden only with CSS still counts as the label: a responsive label such as
   * `<span className="hidden sm:inline">Close</span>` drops the default name, so the button has
   * no name wherever that text is not displayed. Give such a button an explicit `aria-label`
   * (`<button aria-label="Close">…</button>`). An `aria-label`, `aria-labelledby` or `title` on
   * the element names the button.
   *
   * A slot object is the content element, not the button: its attributes, `className`, `style`,
   * `ref` and event handlers included, go to that element (only the naming attributes above reach
   * the button), so handle the press in `onDismiss`. A slot object whose `as` is a `<button>` or a
   * Wave `Button` cannot render inside the button: its children render as the content (the
   * default icon when it has none) and its props are dropped, with a development warning.
   *
   * `slotProps.dismissButton` reaches the same button; its attributes replace those of a merged
   * button (see there).
   */
  dismiss?: Slot<'span'>;
  /**
   * How the text and the actions share the bar. `'singleline'`: the actions sit on the text's row
   * (the text wraps inside its column; it is never cut off). `'multiline'`: the actions get a row of
   * their own under the text. `'auto'`: the actions stay on the text's row while the text fits on
   * one line, measured after mount (the server renders one row), and move below it otherwise; a bar
   * without `MessageBar.Actions` is `'multiline'`, the 0.7 look. The root renders the layout in use
   * as `data-layout` (`singleline` or `multiline`). Fluent's `layout`.
   * @default 'auto'
   */
  layout?: 'auto' | 'singleline' | 'multiline';
  /**
   * The message: body text, with the parts `MessageBar.Title` and `MessageBar.Actions` as direct
   * children (see the component docs).
   */
  children: React.ReactNode;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Props for the element the bar draws around your message and for its Dismiss button, by part,
   * merged into each part's own (Fluent UI writes the text as a `MessageBarBody` and the Dismiss
   * button as the `containerAction` slot of its `MessageBarActions`): your classes after the
   * part's (yours win a conflict), your styles over its styles, your handlers before its handlers,
   * your ids added to its `aria-labelledby` and `aria-describedby`, and your ref beside its ref.
   * Every attribute the bar sets on a part is locked and keeps the bar's value; you add the
   * attributes it does not set. A part takes no `children`: your children fill the text column,
   * and `dismiss` fills the Dismiss button. `icon` is a slot of its own.
   */
  slotProps?: {
    /**
     * The text column `<div>` (stable class `wave-message-bar__body`): the visually hidden status
     * text, the title and your message, in that order. With `layout="auto"` and actions the bar
     * measures this element to choose its layout, also while you pass a ref; while it measures one
     * row the column keeps its text on one line, so a class of yours that sets how the text wraps
     * replaces that, and the actions then stay on the text's row. It carries no handler of the bar:
     * an event on it bubbles as one on your message does. Locked, unset: `hidden`, `inert` and
     * `aria-hidden`, so the message stays announced and the links in it reachable, and `role` and
     * `aria-live`, so the column adds no role or live region of its own (the bar's role says how
     * the message is announced).
     */
    body?: SlotPart<'div'>;
    /**
     * The Dismiss `<button>`, rendered while the bar has `onDismiss` or `dismiss` content (stable
     * class `wave-message-bar__dismiss-button`; `dismiss` fills its content). A `<button>` or
     * `Button` passed as `dismiss` reaches this button too: its
     * attributes are the defaults these props replace (yours win), its classes come before yours
     * and its handlers run after yours. Locked, at the values the bar and that button give
     * together: `type`, `disabled`, `tabIndex`, `hidden`, `aria-hidden`, `inert`, `role`,
     * `contentEditable`, the name (`aria-label`, "Dismiss" unless `dismiss` names the button, and
     * `aria-labelledby`, to which your ids are added, and which then names it), `aria-disabled`,
     * `data-disabled`, `data-disabled-focusable`, the markers a roving container reads
     * (`data-roving-container`, `data-roving-disabled`, `data-roving-value`), so the button keeps
     * its place in the arrow order of a toolbar it sits in, and the click: your `onClick` runs
     * first, and `preventDefault()` in it skips the component's handling of the event, the merged
     * button's `onClick` and `onDismiss` included. While a merged `Button` with
     * `disabledFocusable` makes the button unavailable but focusable, your `onClick` is not called.
     * `title` is not locked: where `dismiss` names the button only by a `title` (the button then
     * has no "Dismiss"), a `title` of yours replaces that name, and an empty one leaves the
     * button nameless.
     */
    dismissButton?: SlotPart<'button'>;
  };
}

const tintClasses: Record<Status, string> = {
  info: 'wave:bg-info-tint',
  success: 'wave:bg-success-tint',
  warning: 'wave:bg-warning-tint',
  error: 'wave:bg-error-tint',
};

type UnknownProps = Record<string, unknown>;

/** Name of the dismiss button when nothing else names it. */
const DEFAULT_DISMISS_LABEL = 'Dismiss';

/**
 * Attributes that name the dismiss button. On a slot object they go to the button (its content is
 * decorative); on the merged button, any of them replaces the default `aria-label`.
 */
const NAMING_KEYS: ReadonlySet<string> = new Set(['aria-label', 'aria-labelledby', 'title']);

/**
 * The Dismiss button's attributes that `slotProps.dismissButton` cannot change, at the values the
 * bar and a merged `dismiss` button give together (each key present, so it stays unset while
 * neither sets it): its type, tab stop, visibility, role, editing, name and disabled state, the
 * markers a roving container reads, and its click. The merged button's other attributes are the
 * part's defaults.
 */
const DISMISS_LOCKS = {
  type: undefined,
  disabled: undefined,
  tabIndex: undefined,
  hidden: undefined,
  'aria-hidden': undefined,
  inert: undefined,
  role: undefined,
  contentEditable: undefined,
  'aria-label': undefined,
  'aria-labelledby': undefined,
  'aria-disabled': undefined,
  'data-disabled': undefined,
  'data-disabled-focusable': undefined,
  'data-roving-container': undefined,
  'data-roving-disabled': undefined,
  'data-roving-value': undefined,
  onClick: undefined,
};

/** The handlers a part does not receive while its button activates nothing (`blockHandlers`). */
const BLOCK_CLICK = ['onClick'] as const;

const dismissContentClassName = 'wave:inline-flex wave:items-center wave:justify-center';

/** Live-region roles: a title is read as the start of their content, never as their name. */
const LIVE_REGION_ROLES: ReadonlySet<string> = new Set([
  'alert',
  'status',
  'log',
  'marquee',
  'timer',
]);

/** Roles that take no name. */
const UNNAMED_ROLES: ReadonlySet<string> = new Set(['none', 'presentation', 'generic']);

/** The first token of a `role` value (a list of fallback roles is read by its first). */
function firstRoleToken(role: string | undefined): string | undefined {
  return role?.trim().split(/\s+/)[0] || undefined;
}

/** Whether a title names a bar with this role (spec D16: a non-live role, such as region or group). */
function isNamedByTitle(role: string | undefined): boolean {
  const token = firstRoleToken(role);
  return token !== undefined && !LIVE_REGION_ROLES.has(token) && !UNNAMED_ROLES.has(token);
}

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
  /**
   * Whether a merged Wave `Button` set `disabledFocusable`: the dismiss button is then unavailable
   * but focusable, as the Button would be.
   */
  disabledFocusable: boolean;
  /**
   * Which development warning the slot needs: a `<button>`/`Button` element merged, or a slot
   * object whose `as` is a button unwrapped.
   */
  warning: 'button-element' | 'button-slot-object' | null;
}

const noop = () => {};

/**
 * The decorative default dismiss glyph. It carries the dismiss icon part class when it is the
 * dismiss button's own content, not when the element of a slot object wraps it.
 */
function defaultDismissContent(className?: string): React.ReactNode {
  return <DismissIcon className={className} />;
}

function isButtonType(type: unknown): boolean {
  return type === 'button' || type === Button;
}

/** The dismiss button without a slot: the default icon and name. */
function defaultDismiss(): DismissParts {
  return {
    buttonProps: {},
    content: defaultDismissContent(messageBarClassNames.dismissIcon),
    contentMayName: false,
    literalTextLabel: false,
    disabledFocusable: false,
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
      if (
        key !== 'children' &&
        key !== 'dangerouslySetInnerHTML' &&
        !BUTTON_OWN_PROP_KEYS.has(key)
      ) {
        buttonProps[key] = value;
      }
    }
    const isWaveButton = isElementOfType(element, Button);
    // A generator is read once by the check; its items are what renders (and names the button).
    // Markup of the merged button (`dangerouslySetInnerHTML`) is its content as well, rendered in
    // a span inside the dismiss button (the button itself also holds the icon).
    const markup = element.props.dangerouslySetInnerHTML as
      React.HTMLAttributes<HTMLElement>['dangerouslySetInnerHTML'] | undefined;
    const children =
      markup != null ? (
        <span className={dismissContentClassName} dangerouslySetInnerHTML={markup} />
      ) : (
        materialiseSlotContent(element.props.children)
      );
    // Wave Button's icon becomes decorative content before its children (after them with
    // `iconPosition="after"`).
    const icon = element.props.icon as Slot<'span'>;
    const iconNode =
      isWaveButton && slotRendersContent(icon)
        ? renderSlot(icon, 'span', wcn(messageBarClassNames.dismissIcon, dismissContentClassName), {
            'aria-hidden': true,
          })
        : null;
    const content =
      iconNode || slotRendersContent(children)
        ? placeButtonIcon(iconNode, children, element.props.iconPosition)
        : defaultDismissContent(messageBarClassNames.dismissIcon);
    return {
      buttonProps,
      content,
      contentMayName: true,
      literalTextLabel: hasTextLabel(children),
      disabledFocusable: isWaveButton && Boolean(element.props.disabledFocusable),
      warning: 'button-element',
    };
  }

  // Everything else is classified by the slot system (F2): shorthand content resolves to the
  // default `span` with no attributes; a slot object resolves to its element and attributes.
  // A render function is resolved with a button `as` (it renders the content), or dropped when it
  // renders nothing.
  const resolved = resolveWiredSlot(resolveSlot(dismiss as Slot<'span'>, 'span'), isButtonType);
  if (!resolved) return defaultDismiss();
  const { children } = resolved;
  // A slot object whose `as` is a button cannot render inside the dismiss button: it is
  // unwrapped, so its children are the content of a span and its props are dropped.
  const unwrapped = isButtonType(resolved.Component);
  const Component: React.ElementType = unwrapped ? 'span' : resolved.Component;
  const buttonProps: UnknownProps = {};
  const contentProps: UnknownProps = {};
  for (const [key, value] of Object.entries(unwrapped ? {} : resolved.props)) {
    // The content is decorative: a naming attribute names the dismiss button instead.
    (NAMING_KEYS.has(key) ? buttonProps : contentProps)[key] = value;
  }

  // The content element: the object's own element. An object whose children render nothing
  // styles the default icon (e.g. `{ className: 'text-error' }`), unless its element is the icon
  // itself.
  const elementProps = {
    'aria-hidden': true,
    ...contentProps,
    className: wcn(
      messageBarClassNames.dismissIcon,
      dismissContentClassName,
      contentProps.className as string | undefined,
    ),
  };
  let inner: React.ReactNode = null;
  if (slotRendersContent(children)) {
    inner = children;
  } else if (slotWrapsDefaultContent(Component, { ...contentProps, children })) {
    inner = defaultDismissContent();
  }
  return {
    buttonProps,
    content:
      inner === null
        ? React.createElement(Component, elementProps)
        : React.createElement(Component, elementProps, inner),
    contentMayName: false,
    literalTextLabel: false,
    disabledFocusable: false,
    warning: unwrapped ? 'button-slot-object' : null,
  };
}

// The MessageBar root, documented on the exported `MessageBar` const.
const MessageBarRoot = ({
  status = 'info',
  statusLabel,
  onDismiss,
  icon,
  dismiss,
  layout = 'auto',
  children,
  className,
  slotProps,
  ref,
  ...rest
}: MessageBarProps) => {
  const appClassName = useAppClassName(messageBarClassNames.root);

  const iconClassName = wcn(
    messageBarClassNames.icon,
    'wave:mt-0.5 wave:inline-flex wave:shrink-0',
    STATUS_ICON_COLOR[status],
  );
  const renderedIcon =
    icon !== undefined ? (
      slotRendersContent(icon) ? (
        renderSlot(icon, 'span', iconClassName, { 'aria-hidden': true })
      ) : null
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
    } else if (dismissWarning === 'button-slot-object') {
      warnOnce(
        'MessageBar:dismiss-button-slot-object',
        'MessageBar: `dismiss` received a slot object that renders a button; its children render inside the built-in dismiss button and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. `dismiss={<CloseIcon />}`, and use `onDismiss`.',
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
  const dismissPart = slotProps?.dismissButton;
  const dismissRef = useMergedRefs<HTMLButtonElement>(
    slotRef as React.Ref<HTMLButtonElement> | undefined,
    checksContent ? setLabelTarget : undefined,
    dismissPart?.ref,
  );

  let renderedDismiss: React.ReactNode = null;
  if (dismissParts) {
    const buttonProps: UnknownProps = mergeProps(
      {
        'aria-label': hasOwnName || namedByContent ? undefined : DEFAULT_DISMISS_LABEL,
        onClick: () => onDismiss?.(),
        className: wcn(
          messageBarClassNames.dismissButton,
          'wave:ms-auto wave:inline-flex wave:shrink-0 wave:cursor-pointer wave:items-center wave:justify-center wave:rounded wave:border-none wave:bg-transparent wave:p-1 wave:text-muted-foreground',
          'wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:not-disabled:not-aria-disabled:hover:text-foreground',
          'wave:not-disabled:not-aria-disabled:active:bg-subtle-pressed',
          focusRing,
          'wave:disabled:cursor-not-allowed wave:disabled:opacity-50',
          mergedAriaDisabledClasses,
        ),
      },
      slotButtonProps,
    );
    // `type` is "button" unless the slot sets one (`null`, from JavaScript callers, means the
    // default too, so the button never submits an enclosing form by accident). A merged
    // `disabledFocusable` Button makes it unavailable but focusable (last: it wins).
    buttonProps.type ??= 'button';
    if (dismissParts.disabledFocusable) Object.assign(buttonProps, MERGED_DISABLED_FOCUSABLE_PROPS);
    // The part (merged only when given): the attributes a merged `dismiss` button adds are its
    // defaults, so it replaces them; the bar's wiring, sorted by DISMISS_LOCKS, stays locked at
    // the values the two give together. Unavailable but focusable, the button calls no click
    // handler, the part's included.
    let dismissProps = buttonProps;
    if (dismissPart) {
      const { className: dismissClassName, style: dismissStyle, ...attributes } = buttonProps;
      const locked: UnknownProps = { ...DISMISS_LOCKS };
      const defaults: UnknownProps = {};
      for (const [key, value] of Object.entries(attributes)) {
        (Object.hasOwn(locked, key) ? locked : defaults)[key] = value;
      }
      dismissProps = mergeSlotProps(dismissPart, {
        className: dismissClassName as string | undefined,
        style: dismissStyle as React.CSSProperties | undefined,
        defaults,
        locked,
        blockHandlers: dismissParts.disabledFocusable ? BLOCK_CLICK : undefined,
      });
    }
    renderedDismiss = (
      // The literal marks C-BUTTON-TYPE; the props hold the resolved type, which wins.
      <button type="button" {...dismissProps} ref={dismissRef}>
        {dismissParts.content}
      </button>
    );
  }

  // Parts (D15): a static scan of the direct children (Fragments flattened, Server Component
  // references included), so the title and the actions are placed in the server HTML too.
  const { title, ownTitleId, actions, body } = partitionMessageBarChildren(children);
  const generatedTitleId = useId('wave-message-bar-title');
  const titlePlacement = useTitlePlacement(ownTitleId, generatedTitleId);
  const titleId = titlePlacement.titleId;

  // Labelling (D16). The role the bar renders: the consumer's when the prop is given (it is spread
  // after the default, as in 0.7), else the status role. A live bar is read once, title included,
  // and gets no name; a bar with a non-live role is named by the severity text and the title.
  const defaultRole = status === 'error' || status === 'warning' ? 'alert' : 'status';
  const role = 'role' in rest ? rest.role : defaultRole;
  // A prop that holds `undefined` (a wrapper forwarding it) is no name of the consumer's.
  const ownName = rest['aria-label'] !== undefined || rest['aria-labelledby'] !== undefined;
  const statusText = getStatusLabel(status, statusLabel);
  const statusTextId = useId('wave-message-bar-status');
  const namedByTitle = title !== undefined && !ownName && isNamedByTitle(role);
  // Written after the spread, so a forwarded `aria-labelledby={undefined}` cannot remove it.
  const labelledBy = ownName
    ? rest['aria-labelledby']
    : namedByTitle
      ? joinIds(statusText ? statusTextId : undefined, titleId)
      : undefined;
  const missingRegionName = firstRoleToken(role) === 'region' && title === undefined && !ownName;
  React.useEffect(() => {
    if (missingRegionName) {
      warnOnce(
        'MessageBar:region-name',
        'MessageBar: a bar with role="region" is a landmark only when it has a name. Add a MessageBar.Title, or pass aria-label or aria-labelledby.',
      );
    }
  }, [missingRegionName]);

  // Layout (D17): one DOM order in every layout (icon, text, actions, Dismiss), so a layout change
  // never moves a focused element; only classes change. Without actions the bar keeps 0.7's markup.
  const hasActions = actions.length > 0;
  // `'auto'` with actions measures its text (MessageBar.reflow.ts); the elements it reads are held
  // in state through callback refs, attached only while it measures (no extra render otherwise).
  const measuring = layout === 'auto' && hasActions;
  const [rootElement, setRootElement] = React.useState<HTMLDivElement | null>(null);
  const [textElement, setTextElement] = React.useState<HTMLDivElement | null>(null);
  const rootRef = useMergedRefs<HTMLDivElement>(ref, measuring ? setRootElement : undefined);
  const measuredLayout = useMessageBarReflow(rootElement, textElement, measuring);
  const resolvedLayout: 'singleline' | 'multiline' =
    layout === 'auto' ? (hasActions ? measuredLayout : 'multiline') : layout;
  // While it measures one row, the text column does not wrap, so text that does not fit overflows
  // the column (never cut off) and the measurement sees it.
  const unwrapped = measuring && resolvedLayout === 'singleline';
  // What `useMessageBarContext` reads anywhere in the bar (C-MEMO).
  const contextValue = React.useMemo<MessageBarContextValue>(
    () => ({ status, layout: resolvedLayout }),
    [status, resolvedLayout],
  );

  // The text column: the severity text, the title (and a space, so the two never run together),
  // then the body in its order. The reflow measures it through the state its ref sets, which a
  // part's ref joins (never detaching it); the part merges only when given.
  const bodyPart = slotProps?.body;
  const bodyRef = useMergedRefs<HTMLDivElement>(
    measuring ? setTextElement : undefined,
    bodyPart?.ref,
  );
  const bodyClassName = wcn(
    messageBarClassNames.body,
    'wave:min-w-0 wave:flex-1 wave:text-body-1',
    unwrapped && 'wave:whitespace-nowrap',
  );
  const text = (
    <div
      className={bodyClassName}
      {...(bodyPart &&
        mergeSlotProps(bodyPart, {
          className: bodyClassName,
          // The bar's role says how the message is announced: no role or live region of its own.
          locked: { role: undefined, 'aria-live': undefined, ...HIDDEN_PART_LOCKS },
        }))}
      ref={bodyRef}
    >
      <StatusText id={namedByTitle && statusText ? statusTextId : undefined} label={statusText} />
      {title && (
        <MessageBarPartContext.Provider value={titlePlacement}>
          {title.element}
        </MessageBarPartContext.Provider>
      )}
      {title && ' '}
      {body.map(({ key, node, extraTitle }) =>
        extraTitle ? (
          <MessageBarPartContext.Provider key={key} value={EXTRA_TITLE_PLACEMENT}>
            {node}
          </MessageBarPartContext.Provider>
        ) : (
          <React.Fragment key={key}>{node}</React.Fragment>
        ),
      )}
    </div>
  );

  return (
    <div
      ref={rootRef}
      role={defaultRole}
      data-layout={resolvedLayout}
      {...rest}
      aria-labelledby={labelledBy}
      className={wcn(
        messageBarClassNames.root,
        'wave:flex wave:items-start wave:gap-3 wave:rounded wave:border-s-4 wave:px-4 wave:py-3 wave:text-foreground',
        tintClasses[status],
        STATUS_BORDER[status],
        appClassName,
        className,
      )}
    >
      <MessageBarContext.Provider value={contextValue}>
        <MessageBarPartContext.Provider value={CONTENT_PLACEMENT}>
          {renderedIcon}
          {hasActions ? (
            // A layout wrapper (not a part): the text column and the actions, in this DOM order.
            <div
              className={wcn(
                'wave:flex wave:min-w-0 wave:flex-1 wave:gap-x-3 wave:gap-y-2',
                resolvedLayout === 'multiline' ? 'wave:flex-col' : 'wave:items-start',
              )}
            >
              {text}
              <MessageBarPartContext.Provider value={ACTIONS_PLACEMENT}>
                {actions.map(({ key, element }) => (
                  <React.Fragment key={key}>{element}</React.Fragment>
                ))}
              </MessageBarPartContext.Provider>
            </div>
          ) : (
            text
          )}
          {renderedDismiss}
        </MessageBarPartContext.Provider>
      </MessageBarContext.Provider>
    </div>
  );
};
MessageBarRoot.displayName = 'MessageBar';

/**
 * An inline message that tells the user about the state of a page or task: a status icon, a
 * visually hidden status label ("Warning:"), an optional title, the message, optional actions and
 * an optional dismiss button.
 *
 * - The status sets the tint, the logical start border, the icon and the role (`alert` for
 *   `warning`/`error`, `status` otherwise). Screen readers hear the severity through `statusLabel`.
 * - Parts, as direct children: `MessageBar.Title` (a semibold lead-in, read first after the
 *   severity) and `MessageBar.Actions` (buttons after the text on one row, or below it with
 *   `layout="multiline"`). The built-in Dismiss button stays the bar's own.
 * - With its default roles the bar is a live region and the title is read as the start of its
 *   content; give the bar `role="region"` (a notice that stays on the page) and the title names it.
 * - The dismiss button is always the MessageBar's own `<button>` wired to `onDismiss`
 *   (`type="button"` unless a merged button slot sets its own `type`); the `dismiss` slot only
 *   replaces its content (see {@link MessageBarProps.dismiss}).
 * - Content of your own anywhere in the bar (an action that follows it, for example) reads the
 *   bar's status and the layout it renders, after `layout="auto"` has measured, through
 *   `useMessageBarContext`.
 *
 * React Server Components cannot dot into a client module: import the flat names
 * `MessageBarTitle` and `MessageBarActions` there; `MessageBar.Title` and `MessageBar.Actions`
 * work in client files.
 *
 * @example
 * <MessageBar status="warning" onDismiss={() => setVisible(false)}>
 *   <MessageBar.Title>Update available</MessageBar.Title>
 *   A new version is ready to install.
 *   <MessageBar.Actions>
 *     <Button size="small">Update now</Button>
 *   </MessageBar.Actions>
 * </MessageBar>
 */
export const MessageBar = /* @__PURE__ */ Object.assign(MessageBarRoot, {
  Title: MessageBarTitle,
  Actions: MessageBarActions,
});

export { MessageBarTitle, MessageBarActions };
export type { MessageBarTitleProps, MessageBarActionsProps } from './MessageBar.parts';
export { useMessageBarContext } from './MessageBar.context';
export type { MessageBarContextValue } from './MessageBar.context';
