import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { DismissIcon } from '../../lib/icons';
import { mergeProps } from '../../lib/mergeProps';
import { VOID_ELEMENTS, renderSlot, resolveSlot } from '../../lib/slot';
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
  /** Called when the dismiss button is activated. Passing it renders the dismiss button. */
  onDismiss?: () => void;
  /**
   * Custom status icon, rendered decoratively (`aria-hidden="true"`, a slot object can override
   * it) in the status color. `null` renders no icon.
   */
  icon?: Slot<'span'>;
  /**
   * Content of the dismiss button (replaces the default dismiss icon). It always renders **inside**
   * the built-in `<button type="button" aria-label="Dismiss">`, which calls `onDismiss`; passing it
   * shows the dismiss button even without `onDismiss`, and `null` hides the button. The content is
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

// C-SLOTS naming predicate. Local copy of the rule SearchBox (P02) and Tag (P08) apply; it moves
// to the shared F2 helper `src/lib/labelInName.ts` when that lands (spec revision 2.5).

/** A letter or a digit. */
const LABEL_CHARACTER = /[\p{L}\p{N}]/gu;

/** Letters and digits a text label needs: a lone character (`X`, `×`, `+`) is a symbol. */
const MIN_LABEL_CHARACTERS = 2;

/** Elements whose text is never a visible label (SVG `<title>`/`<desc>`, scripts, styles). */
const NON_LABEL_ELEMENTS: ReadonlySet<string> = new Set([
  'title',
  'desc',
  'style',
  'script',
  'template',
]);

function countLabelCharacters(text: string): number {
  return text.match(LABEL_CHARACTER)?.length ?? 0;
}

/**
 * Letters and digits in the literal strings and numbers of `node`, outside `aria-hidden`/`hidden`
 * elements (counting stops at {@link MIN_LABEL_CHARACTERS}). Text rendered by components, and
 * one-shot iterators (which reading would consume), are found by the DOM check after mount.
 */
function countLiteralLabelCharacters(node: unknown): number {
  if (typeof node === 'string') return countLabelCharacters(node);
  if (typeof node === 'number' || typeof node === 'bigint') {
    return countLabelCharacters(String(node));
  }
  if (typeof node !== 'object' || node === null) return 0;
  if (React.isValidElement<UnknownProps>(node)) {
    const { props } = node;
    const ariaHidden = props['aria-hidden'];
    if (ariaHidden === true || ariaHidden === 'true' || props.hidden) return 0;
    if (typeof node.type === 'string' && NON_LABEL_ELEMENTS.has(node.type)) return 0;
    return countLiteralLabelCharacters(props.children);
  }
  if (!(Symbol.iterator in node)) return 0;
  const iterable = node as Iterable<unknown>;
  if (!Array.isArray(iterable) && (iterable[Symbol.iterator]() as unknown) === iterable) return 0;
  let count = 0;
  for (const item of iterable) {
    count += countLiteralLabelCharacters(item);
    if (count >= MIN_LABEL_CHARACTERS) break;
  }
  return count;
}

/** Whether the literal `node` has a text label (see {@link countLiteralLabelCharacters}). */
function hasTextLabel(node: unknown): boolean {
  return countLiteralLabelCharacters(node) >= MIN_LABEL_CHARACTERS;
}

/**
 * Whether the rendered `root` contains a text label: at least two letters or digits in text outside
 * `aria-hidden` and `hidden` subtrees (visually hidden text included, since it names the button
 * too). Text hidden only by CSS is not detected and counts as a label (documented on `dismiss`).
 */
function hasRenderedTextLabel(root: Element): boolean {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
        const element = node as Element;
        return element.getAttribute('aria-hidden') === 'true' ||
          element.hasAttribute('hidden') ||
          NON_LABEL_ELEMENTS.has(element.localName)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_SKIP;
      },
    },
  );
  let count = 0;
  while (walker.nextNode()) {
    count += countLabelCharacters(walker.currentNode.nodeValue ?? '');
    if (count >= MIN_LABEL_CHARACTERS) return true;
  }
  return false;
}

/** Re-checks the name whenever the content changes (e.g. a translation loads). */
const LABEL_MUTATIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['aria-hidden', 'hidden'],
};

function observeTextLabel(root: Element, onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(root, LABEL_MUTATIONS);
  return () => observer.disconnect();
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
 * Splits the `dismiss` slot into props for the wired dismiss button and the content rendered
 * inside it (C-SLOTS dismiss semantics). `null` means: no dismiss button.
 */
function resolveDismiss(dismiss: MessageBarProps['dismiss']): DismissParts | null {
  if (dismiss === undefined) {
    return {
      buttonProps: {},
      content: defaultDismissContent(),
      contentMayName: false,
      literalTextLabel: false,
      warning: null,
    };
  }
  if (dismiss === null || typeof dismiss === 'boolean') return null;

  // A merged `<button>`/`Button` keeps its content accessible (as in 0.4): a text label names the
  // button, anything else (an icon, a lone character such as `X` or `×`) gets the default name.
  if (React.isValidElement<UnknownProps>(dismiss) && isButtonType(dismiss.type)) {
    const buttonProps: UnknownProps = {};
    for (const [key, value] of Object.entries(dismiss.props)) {
      if (key !== 'children' && !BUTTON_COMPONENT_KEYS.has(key)) buttonProps[key] = value;
    }
    const children = dismiss.props.children as React.ReactNode;
    // Wave Button's icon becomes decorative content in front of its children.
    const iconNode =
      dismiss.type === Button
        ? renderSlot(dismiss.props.icon as Slot<'span'>, 'span', dismissContentClassName, {
            'aria-hidden': true,
          })
        : null;
    const content =
      iconNode || children != null ? (
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
  if (!resolved) return null;
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
      if (key === 'icon') {
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
  // object without children styles the default icon (e.g. `{ className: 'text-error' }`).
  const ContentTag: React.ElementType = asButton ? 'span' : Component;
  const elementProps = {
    'aria-hidden': true,
    ...contentProps,
    className: cn(dismissContentClassName, contentProps.className as string | undefined),
  };
  const isVoid = typeof ContentTag === 'string' && VOID_ELEMENTS.has(ContentTag);
  const inner =
    iconNode || children != null ? (
      <>
        {iconNode}
        {children}
      </>
    ) : (
      defaultDismissContent()
    );
  return {
    buttonProps,
    content: isVoid
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

  const showDismiss = dismiss !== undefined || onDismiss !== undefined;
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
