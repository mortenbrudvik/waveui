import * as React from 'react';
import { isElementOfType } from './children';
import { wcn } from './cn';
import { warnOnce } from './dev';

/**
 * The props a {@link SlotRenderFunction} of a slot object receives, as typed: the attributes that
 * every HTML element has and `data-*` attributes, whatever the slot's element, so one function
 * fits each slot (and each member of a slot union such as `Slot<'span'> | SlotObject<'button'>`)
 * and its props spread onto any tag. The `ref` and the element's own attributes (an image's `src`)
 * arrive too, untyped, and spread with them.
 */
export type SlotRenderProps = React.HTMLAttributes<HTMLElement> & {
  [dataAttribute: `data-${string}`]: unknown;
};

/**
 * A render function as the `children` of a slot object (the escape hatch of Fluent UI's slots,
 * `children: (Component, props) => ReactNode`): it renders the slot in place of the slot's element.
 *
 * - `Component` is the element type the slot renders: the object's `as`, else the slot's default
 *   element (`'span'` for most slots).
 * - `props` are every prop that element receives: the component's default attributes (the
 *   `aria-hidden` of an icon), the object's own attributes, the merged `className`, the object's
 *   `ref`, what the component adds when it renders the element (the backdrop's press handler and
 *   presence attributes), and `children` where the component puts content inside the element:
 *   the default glyph of a dismiss, clear or close slot, since a render function is no content of
 *   its own. Never `as`.
 * - What it returns renders where the element would have. `(Component, props) => <Component
 *   {...props} />` renders what the object without the function renders; dropping `props` drops
 *   the component's wiring (its classes, `aria-hidden`, handlers, `ref`).
 *
 * Annotate a function of your own with the bare type (`const icon: SlotRenderFunction = …`), which
 * fits every slot: a type argument makes another function type, which a slot does not take.
 *
 * In the slots that render inside a component's own button (dismiss, clear, close and glyph slots)
 * that button stays and the function renders the content inside it:
 * - a function that renders nothing at the check below leaves the default glyph, with the
 *   object's other attributes (an empty dismiss button is never left);
 * - a slot object whose `as` names a button (a `<button>` or a Wave `Button`) is merged into the
 *   component's button or unwrapped, as the slot's rules say, with their warning: the function
 *   then renders the content, a span (in the dismiss and close slots it receives `'span'` and no
 *   props), so no button ever nests in a button.
 *
 * It must be pure and call no hooks: one render can call it more than once (StrictMode, and the
 * check whether the slot renders anything, which calls it with the object's `as`, else `'span'`,
 * and the object's own attributes). A function that renders nothing at that check is a slot that
 * renders nothing for the rules that read it: an optional indicator is left out, a required
 * indicator keeps its default glyph (with a development warning), a status icon shows none.
 *
 * A render function is code, which cannot cross from a Server Component into WaveUI's client
 * components (functions are not serializable): write the slot in a client component.
 *
 * @example
 * <Button icon={{ children: (Component, props) => <Component {...props}><MyIcon /></Component> }}>
 *   Save
 * </Button>
 *
 * @typeParam Props - The props of the slot's element; slot objects take the default,
 *   {@link SlotRenderProps}.
 */
export type SlotRenderFunction<Props = SlotRenderProps> = (
  Component: React.ElementType<Props>,
  props: Omit<Props, 'as'>,
) => React.ReactNode;

/**
 * Object form of a Slot: full control over the rendered element.
 *
 * - `as` renders a different element or component than the slot's default (any element type).
 * - Every attribute of the default element `T` is accepted and forwarded (`{ src, alt }` for an
 *   `'img'` slot, `aria-label`/`title`/handlers for a `'span'` slot), plus `data-*` attributes.
 * - `className` is merged after the component's base classes, so it wins conflicts.
 * - `children` is the content of the element, or a {@link SlotRenderFunction} that renders the
 *   slot in place of the element.
 *
 * @typeParam T - The slot's default element type.
 */
export type SlotObject<T extends React.ElementType = 'span'> = {
  /** Render a different element or component instead of the slot's default. */
  as?: React.ElementType;
  /**
   * Content to render inside the slot element (ignored for void elements such as `img`), or a
   * {@link SlotRenderFunction} that renders the slot in place of the element, its `props` typed
   * as {@link SlotRenderProps}.
   */
  children?: React.ReactNode | SlotRenderFunction;
  /** Class name(s) merged after the component's base classes (yours win). */
  className?: string;
  /** Inline styles for the slot element. */
  style?: React.CSSProperties;
  /** Ref to the rendered slot element. */
  ref?: React.Ref<unknown>;
  /** Any `data-*` attribute. */
  [dataAttribute: `data-${string}`]: unknown;
} & Omit<React.ComponentPropsWithoutRef<T>, 'children' | 'className' | 'style'>;

/**
 * Slot definition — a customisable sub-element of a component. Accepts:
 *
 * - any `React.ReactNode` as shorthand content (string, number, bigint, element, promise, or any
 *   iterable of nodes such as an array, a `Set` or a generator), rendered **inside** the slot's
 *   default element; `null`, `undefined`, `false` and `true` render nothing;
 * - a {@link SlotObject} (`{ as, className, children, ...attributes }`) for full control.
 *
 * An attributes object typed by an interface (`React.ImgHTMLAttributes<…>`) has no implicit
 * `data-*` index signature, so it is not assignable as is: spread it into a literal,
 * `image={{ ...imgProps }}`.
 *
 * @typeParam T - The slot's default element type.
 */
export type Slot<T extends React.ElementType = 'span'> = SlotObject<T> | React.ReactNode;

/** The normalized output of {@link resolveSlot}, ready for rendering. */
export interface ResolvedSlot {
  /** The element type to render (e.g., 'span', 'div', or a component). */
  Component: React.ElementType;
  /** Merged props including className and any extra HTML attributes. */
  props: Record<string, unknown>;
  /** The content to render inside the element. */
  children: React.ReactNode;
}

/**
 * HTML void elements: they can never have children. A slot whose default tag is one of these
 * renders a ReactElement slot as-is (instead of wrapping it) and never receives shorthand children.
 */
export const VOID_ELEMENTS: ReadonlySet<string> = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

type UnknownProps = Record<string, unknown>;

/** The prop that carries a render function and its element type to {@link SlotRender}. */
const RENDER_KEY = '$slot';

/** The props of {@link SlotRender}: the element's props and the render function with its type. */
interface SlotHostProps {
  [RENDER_KEY]: [
    render: (type: unknown, props: UnknownProps) => React.ReactNode,
    type: React.ElementType,
  ];
  [prop: string]: unknown;
}

/**
 * The element type that {@link resolveSlot} gives a slot object whose `children` are a render
 * function: it renders what the function returns for the slot's element type and the props it
 * receives, those of the resolved slot and whatever its renderer adds (`children` included).
 */
const SlotRender = ({ [RENDER_KEY]: [render, type], ...props }: SlotHostProps) =>
  render(type, props);

/**
 * A slot object is a plain object that is not a React element or another React internal object
 * (`$$typeof`: elements, portals, lazy nodes), not an iterable (arrays, Sets, generators) and not
 * a thenable. Everything else is content and renders as children of the default element.
 */
function isSlotObject(value: unknown): value is UnknownProps {
  if (
    typeof value !== 'object' ||
    value === null ||
    '$$typeof' in value ||
    Symbol.iterator in value ||
    typeof (value as { then?: unknown }).then === 'function'
  ) {
    return false;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  return !proto || proto === Object.prototype || !Object.getPrototypeOf(proto);
}

/**
 * One-shot iterators (generators) are materialised into an array once and cached, so React never
 * enumerates a generator (it warns about that) and a second render of the same props (StrictMode)
 * sees the same items. Re-iterable collections (Set, custom iterables) are passed through.
 */
const materialisedIterators = new WeakMap<object, React.ReactNode[]>();

/** Whether `value` is a one-shot iterator (a generator): iterating it returns itself. */
function isOneShotIterator(value: object): boolean {
  return (
    Symbol.iterator in value &&
    ((value as Iterable<unknown>)[Symbol.iterator]() as unknown) === value
  );
}

/**
 * Whether React would render anything for `node`: `null`, `undefined`, booleans and `''` render
 * nothing, and so does a Fragment, array or other iterable (Set, generator) whose content, at any
 * depth, is all of those. Dropping such content from a void element is silent (a conditional
 * `children: cond && x`, or a list mapped to nothing). A top-level generator is read through
 * {@link materialiseSlotContent} (materialised once, so checking it does not consume it); a
 * generator nested in a collection or a Fragment is rendered by React as it is, so it is not read
 * and counts as content. A slot object whose `children` are a render function counts by what the
 * function returns (see {@link slotRendersContent}), checked as nested content.
 */
function rendersContent(node: unknown, visiting: Set<object>, nested?: boolean): boolean {
  if (node === undefined || node === null || typeof node === 'boolean' || node === '') {
    return false;
  }
  if (isSlotObject(node) && typeof node.children === 'function') {
    return rendersContent(
      SlotRender(resolveSlot(node as Slot)!.props as SlotHostProps),
      visiting,
      true,
    );
  }
  if (typeof node !== 'object') return true;
  if (React.isValidElement(node)) {
    if (!isElementOfType<{ children?: React.ReactNode }>(node, React.Fragment)) return true;
    return rendersContent(node.props.children, visiting, true);
  }
  if (!(Symbol.iterator in node)) return true;
  if (nested && isOneShotIterator(node)) return true;
  // A collection that contains itself adds nothing beyond what is already being checked.
  if (visiting.has(node)) return false;
  visiting.add(node);
  try {
    for (const item of materialiseSlotContent(node) as Iterable<unknown>) {
      if (rendersContent(item, visiting, true)) return true;
    }
    return false;
  } finally {
    visiting.delete(node);
  }
}

/**
 * Whether a slot value renders any content — the one "renders nothing" rule of the library, for
 * slots and any other content a component shows or leaves out (labels, titles, dismiss content).
 *
 * `false` for `null`, `undefined`, booleans and `''`, and for a Fragment, array, `Set`, generator
 * or other iterable whose content, at any depth, is only those (`<></>`, `[null, '']`,
 * `<>{false}</>`); a Fragment is recognised by its unwrapped type, also when it is a client
 * reference written in a Server Component. `true` for everything else: text, numbers (including
 * `0`), other React elements (the helper cannot know what a component renders), slot objects
 * (they always render their element), promises, and a generator nested in a collection or a
 * Fragment (not read, so React still renders its items).
 *
 * A slot object whose `children` are a {@link SlotRenderFunction} renders content when what the
 * function returns does: it is called once with the object's `as` (else `'span'`) and its other
 * attributes, so `{ children: () => null }` renders nothing. Such an object is checked wherever
 * it is, an item of a collection included (`[{ children: fn }]`); a function given bare, or as an
 * item of a collection itself (`[fn]`), is not called and counts as content.
 *
 * A top-level generator is materialised once and cached, so checking it does not consume it:
 * render the checked value through `renderSlot`/`resolveSlot`, or, when you render it yourself,
 * through {@link materialiseSlotContent}. Never warns. Call it during render: a client reference
 * whose code is still loading suspends the caller, as rendering it would.
 *
 * Components use it to fall back when a slot is effectively empty, e.g. Avatar shows the initials
 * unless `icon && slotRendersContent(icon)`.
 *
 * @param slot A slot value or any React node.
 */
export function slotRendersContent(slot: unknown): boolean {
  return rendersContent(slot, new Set());
}

/**
 * The content to render for a value that {@link slotRendersContent} checked, for a component that
 * renders it itself rather than through `renderSlot`/`resolveSlot`: a top-level generator is
 * replaced by its materialised items (the same array on every call, so a second render sees the
 * same items and React never enumerates the generator); every other value is returned as given.
 *
 * @example
 * const hasAction = slotRendersContent(action);
 * return hasAction ? <span className="ms-auto">{materialiseSlotContent(action)}</span> : null;
 *
 * @param content A slot value or any React node.
 */
export function materialiseSlotContent(content: unknown): React.ReactNode {
  if (typeof content === 'object' && content !== null && isOneShotIterator(content)) {
    let cached = materialisedIterators.get(content);
    if (!cached) {
      materialisedIterators.set(
        content,
        (cached = Array.from(content as Iterable<React.ReactNode>)),
      );
    }
    return cached;
  }
  return content as React.ReactNode;
}

/**
 * Whether a slot object's element wraps the component's default content, the rule of the dismiss
 * and clear slots (Tag `dismissIcon`, MessageBar `dismiss`, SearchBox `dismiss`): a slot object
 * without content of its own (`{ className: 'text-error' }`) styles the default icon.
 *
 * `true` when the element is an intrinsic tag that can hold children (not a void tag such as
 * `img`), it sets no `dangerouslySetInnerHTML` and its `children` render nothing
 * ({@link slotRendersContent}). A component (an icon that draws its own glyph), a void tag and
 * markup of its own are the content themselves: `false`.
 *
 * A render function is no content of its own: for the element that {@link resolveSlot} resolves
 * an object with one to, the answer is that for the element type the function receives, so the
 * function receives the default content as its `children` prop. Unresolved `children` that are a
 * function are not called and count as content: resolve the object first, or leave them out of
 * `props` (Tag's `dismissIcon` does).
 *
 * @param type  The element type the slot object renders (its `as`, else the slot's default tag),
 *              or the `Component` that `resolveSlot` resolved it to.
 * @param props The slot object's props, or the resolved props; `children` and
 *              `dangerouslySetInnerHTML` are read.
 */
export function slotWrapsDefaultContent(
  type: unknown,
  props: { children?: unknown; dangerouslySetInnerHTML?: unknown },
): boolean {
  type = (props as Partial<SlotHostProps>)[RENDER_KEY]?.[1] ?? type;
  if (typeof type !== 'string' || VOID_ELEMENTS.has(type)) return false;
  return props.dangerouslySetInnerHTML == null && !slotRendersContent(props.children);
}

/**
 * The rules of the slots that render inside a component's own button (the dismiss, clear and close
 * slots) for a slot object with a {@link SlotRenderFunction}, applied to what {@link resolveSlot}
 * resolved it to; any other `resolved` is returned as given:
 * - when `isButton` accepts the element type the function receives (the object's `as` names a
 *   button), the triple has that type, the object's attributes and, as its children, what the
 *   function returns for `'span'` and no props, and the component treats it as it treats such an
 *   object with content, so nothing nests a button: the close slots (`closeButton` of Dialog,
 *   Drawer and NavDrawer, TeachingPopover's `dismissButton`) merge it into their own button, while
 *   the `dismiss` slots of MessageBar and SearchBox unwrap it (the children are the content, the
 *   attributes are dropped, with one development warning), as Tag's `dismissIcon` unwraps such an
 *   object through its own path;
 * - when the function renders nothing (called with the type and the object's attributes), the
 *   triple has the type and the attributes and no children: the object without the function,
 *   which keeps the default glyph inside its element;
 * - otherwise the function renders the content element, `resolved` as given.
 *
 * @param resolved The slot as `resolveSlot` resolved it.
 * @param isButton Whether an element type is a button (`'button'`, Wave's `Button`).
 */
export function resolveWiredSlot(
  resolved: ResolvedSlot | null,
  isButton: (type: unknown) => boolean,
): ResolvedSlot | null {
  const render = (resolved?.props as Partial<SlotHostProps> | undefined)?.[RENDER_KEY];
  if (!render) return resolved;
  const [fn, type] = render;
  const { [RENDER_KEY]: _render, ...props } = resolved!.props;
  if (isButton(type)) return { Component: type, props, children: fn('span', {}) };
  return rendersContent(fn(type, props), new Set(), true)
    ? resolved
    : { Component: type, props, children: undefined };
}

/** `wcn(base, own)`, or `undefined` when there are no classes, so no empty `class=""` renders. */
function mergeClassName(baseClassName: string | undefined, className: unknown): string | undefined {
  return wcn(baseClassName, className as string | undefined) || undefined;
}

/**
 * Resolves a Slot value into a `{ Component, props, children }` triple.
 *
 * - `null`, `undefined`, `false` and `true` resolve to `null` (render nothing).
 * - A slot object resolves to `Component = as ?? defaultAs`,
 *   `props = { ...defaultProps, ...attributes, className: cn(baseClassName, className) }` and its
 *   `children` (a generator materialised into an array once, as for shorthand content). When the
 *   element is void its `children` are always dropped, with a development warning only if they
 *   would have rendered (not for `null`, `undefined`, booleans or `''`, nor for a Fragment,
 *   array, Set or generator made only of those, at any depth).
 * - A slot object whose `children` are a {@link SlotRenderFunction} resolves to an internal
 *   element type that renders the function's result, with those props (they also carry the
 *   function and the element type it receives) and no `children`: render it as you would the
 *   element, adding your own props and content, and the function receives all of them.
 * - With a **void** default tag (`area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`,
 *   `link`, `meta`, `param`, `source`, `track`, `wbr`) a ReactElement slot resolves to the
 *   element itself (its type and props, `defaultProps` underneath, className merged). A Fragment
 *   and shorthand content resolve to `null` with a development warning (none for content that
 *   renders nothing) — the component decides what a string means (Avatar treats it as `src`).
 * - Any other value (string, number, element, array, Set, generator, promise) becomes the children
 *   of `defaultAs` with `{ ...defaultProps, className: baseClassName }`.
 * - `props.className` is `undefined` (never `''`) when there are no classes, so no empty `class`
 *   attribute renders; it always replaces a `className` in `defaultProps`.
 *
 * @param slot           The slot value from component props.
 * @param defaultAs      The default element type (e.g., 'span', 'div'). Defaults to 'span'.
 * @param baseClassName  Base classes; the slot's own className is merged after them and wins.
 * @param defaultProps   Default attributes (e.g. `{ 'aria-hidden': true }` for icon slots) that
 *                       the slot's own props override.
 */
export function resolveSlot<T extends React.ElementType = 'span'>(
  slot: Slot<T> | undefined | null,
  defaultAs?: T,
  baseClassName?: string,
  defaultProps?: Record<string, unknown>,
): ResolvedSlot | null {
  if (slot === null || slot === undefined || typeof slot === 'boolean') {
    return null;
  }

  const tag: React.ElementType = defaultAs ?? 'span';
  const defaults: UnknownProps = defaultProps ?? {};

  if (isSlotObject(slot)) {
    const { as: slotAs, children, className, ...rest } = slot;
    let Component = (slotAs as React.ElementType | undefined) ?? tag;
    const props: UnknownProps = {
      ...defaults,
      ...rest,
      className: mergeClassName(baseClassName, className),
    };
    let content = materialiseSlotContent(children);
    if (typeof children === 'function') {
      // The function renders the slot in place of its element (SlotRender).
      props[RENDER_KEY] = [children, Component];
      Component = SlotRender;
      content = undefined;
    } else if (VOID_ELEMENTS.has(Component as string)) {
      // A void element never receives children (React throws for any non-null value, even
      // `false` or `[]`); warn only when the dropped children would have rendered something.
      if (slotRendersContent(content)) {
        warnOnce(
          `slot:void-children:${Component as string}`,
          `A slot rendered as <${Component as string}> cannot have children; its \`children\` were ignored.`,
        );
      }
      content = undefined;
    }
    return { Component, props, children: content };
  }

  if (VOID_ELEMENTS.has(tag as string)) {
    if (React.isValidElement(slot)) {
      if (slot.type !== React.Fragment) {
        const { children, className, ...elementProps } = slot.props as UnknownProps;
        return {
          Component: slot.type as React.ElementType,
          props: {
            ...defaults,
            ...elementProps,
            className: mergeClassName(baseClassName, className),
          },
          children: children as React.ReactNode,
        };
      }
      // An empty Fragment (`<></>`) renders nothing: an empty slot, no warning.
      if (slotRendersContent(slot)) {
        warnOnce(
          `slot:void-fragment:${tag as string}`,
          `A Fragment cannot stand in for <${tag as string}> (a void element): it cannot take the slot's className or attributes. Pass the element itself or an object slot instead; the slot was not rendered.`,
        );
      }
    } else if (slotRendersContent(slot)) {
      warnOnce(
        `slot:void-content:${tag as string}`,
        `Slot content cannot be rendered inside <${tag as string}> (a void element). Pass an element or an object slot instead; the slot was not rendered.`,
      );
    }
    return null;
  }

  return {
    Component: tag,
    props: {
      ...defaults,
      className: baseClassName || undefined,
    },
    children: materialiseSlotContent(slot),
  };
}

/**
 * Renders a slot (see {@link resolveSlot} for the rules). Returns `null` when the slot is empty.
 *
 * @param slot           The slot value from component props.
 * @param defaultAs      The default element type (e.g., 'span', 'div'). Defaults to 'span'.
 * @param baseClassName  Base classes; the slot's own className is merged after them and wins.
 * @param defaultProps   Default attributes that the slot's own props override, e.g.
 *                       `renderSlot(icon, 'span', 'shrink-0', { 'aria-hidden': true })`.
 * @returns A React element, or `null` if the slot is empty.
 */
export function renderSlot<T extends React.ElementType = 'span'>(
  slot: Slot<T> | undefined | null,
  defaultAs?: React.ElementType,
  baseClassName?: string,
  defaultProps?: Record<string, unknown>,
): React.ReactElement | null {
  const resolved = resolveSlot<React.ElementType>(
    slot as Slot<React.ElementType>,
    defaultAs,
    baseClassName,
    defaultProps,
  );
  if (!resolved) return null;

  const { Component, props, children } = resolved;
  return React.createElement(Component, props, ...(children === undefined ? [] : [children]));
}
