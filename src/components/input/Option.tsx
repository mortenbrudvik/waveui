import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { hasWarned, isDev, warnOnce } from '../../lib/dev';
import { CheckIcon } from '../../lib/icons';
import { materialiseSlotContent, renderSlot, slotRendersContent, type Slot } from '../../lib/slot';
import { forcedColors } from '../../lib/styles';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useDismiss } from '../../hooks/useDismiss';
import type { DismissReason } from '../../hooks/useDismiss';
import { usePopupPosition } from '../../hooks/usePopupPosition';
import {
  ListboxContext,
  markListboxElement,
  useListboxOption,
  type ListboxContextValue,
  type ListboxStore,
  type UseListboxResult,
} from '../../hooks/useListbox';
import { Portal } from '../portal/Portal';

/* ------------------------------------------------------------------ */
/*  Option                                                             */
/* ------------------------------------------------------------------ */

/**
 * Props of {@link Option}, an option of a listbox (Listbox, Combobox, Dropdown or a custom
 * picker's list).
 */
export interface OptionProps extends Omit<React.LiHTMLAttributes<HTMLLIElement>, 'value'> {
  /** Value associated with this option. Unique within its listbox. */
  value: string;
  /**
   * Text shown in the combobox (Combobox input, Dropdown trigger) when this option is selected.
   * Defaults to `textValue`, then the option's text content, then `value`. Pass it when the
   * children are not plain text (icons, custom components).
   */
  label?: string;
  /** Text matched by typeahead and filtering instead of the label. */
  textValue?: string;
  /**
   * Whether the option is disabled: it stays in the list but can never be selected (a click, Enter
   * and Space do nothing). Keyboard navigation and typeahead skip it, unless the listbox keeps
   * disabled options focusable (`disabledOptionsFocusable`), where they reach it.
   * @default false
   */
  disabled?: boolean;
  /**
   * Replaces the check glyph that marks the option while it is selected (decorative,
   * `aria-hidden`); in a multi-select list the glyph is drawn inside the option's 16px checkbox
   * square. The check is a required indicator, the sign of the selection that does not rely on
   * colour: `null` and `undefined` keep the default glyph, and so does a value that renders
   * nothing (`false`, `''`, an empty array), which also logs a development warning. Unlike
   * `Combobox.expandIcon`, a value that renders nothing does not hide the indicator (Fluent's
   * `checkIcon={null}` removes it).
   * @default a check mark
   */
  checkIcon?: Slot<'span'>;
  /**
   * Hides the option, like a native `<option hidden>`: it is not shown, keyboard navigation and
   * typeahead skip it, and it never becomes the active option. Its label stays known, so a
   * selected hidden option (a placeholder) still shows in the combobox. The options of a hidden
   * `OptionGroup` are hidden the same way.
   * @default false
   */
  hidden?: boolean;
  /** Ref to the option `<li>` element. */
  ref?: React.Ref<HTMLLIElement>;
}

/** Whether options draw the selected check mark (P05-internal; TagPicker lists no selected options). */
const OptionCheckContext = React.createContext(true);
OptionCheckContext.displayName = 'OptionCheckContext';

/*
 * State is exposed as data attributes (C-CLASS): `data-active` (keyboard/pointer highlight),
 * `data-selected`, `data-disabled`. State classes come before the consumer's `className` in `cn()`.
 *
 * Backgrounds (input-pickers#20): one unconditional `bg-(--option-bg)` paints the option, and the
 * hover/selected/active variants only set `--option-bg`. A variant that set `background-color`
 * itself (class + attribute or pseudo-class) would out-specify a consumer's plain `bg-*` class in
 * the cascade even though `cn()` keeps it; instead tailwind-merge replaces `bg-(--option-bg)` with
 * the consumer's class, which is then the only background declaration on the option. A consumer
 * `data-[active]:bg-…` / `data-[selected]:bg-…` restyles a single state (it out-specifies the
 * unconditional reader). The active outline is the focus indicator and stays a state variant.
 *
 * A filtered-out option carries the `hidden` attribute; base.css's scoped `[hidden]` rule hides
 * it over `flex` and over a consumer's display class.
 */
const OPTION_CLASSES = cn(
  'flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 text-body-1 text-foreground',
  'bg-(--option-bg) [--option-bg:transparent]',
  'not-disabled:not-aria-disabled:hover:[--option-bg:var(--wave-subtle-hover)]',
  'data-[selected]:[--option-bg:var(--wave-subtle-selected)]',
  'data-[active]:[--option-bg:var(--wave-subtle-hover)]',
  'data-[active]:outline-2 data-[active]:-outline-offset-2 data-[active]:outline-ring',
  'aria-disabled:cursor-not-allowed aria-disabled:text-muted-foreground',
);

/**
 * The values of the options rendered inside an `OptionGroup`, whatever wraps them (custom
 * components, Fragments, nested groups): each option adds its value from a layout effect.
 */
class OptionGroupMembers {
  private readonly counts = new Map<string, number>();
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  add(value: string): () => void {
    this.counts.set(value, (this.counts.get(value) ?? 0) + 1);
    this.notify();
    return () => {
      const count = (this.counts.get(value) ?? 1) - 1;
      if (count > 0) this.counts.set(value, count);
      else this.counts.delete(value);
      this.notify();
    };
  }

  /** At least one option, and every one of them is hidden (filtered out, or by the consumer). */
  allHidden(store: ListboxStore | undefined): boolean {
    if (store === undefined || this.counts.size === 0) return false;
    for (const value of this.counts.keys()) if (!store.isHidden(value)) return false;
    return true;
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

/** The groups around an option, outermost first (P05-internal). */
const OptionGroupContext = React.createContext<readonly OptionGroupMembers[]>([]);
OptionGroupContext.displayName = 'OptionGroupContext';

/** A group around the option has the consumer's `hidden` attribute (P05-internal). */
const OptionGroupHiddenContext = React.createContext(false);
OptionGroupHiddenContext.displayName = 'OptionGroupHiddenContext';

/** Adds an option's value to every group around it while the option is mounted. */
function useOptionGroupMembership(value: string): void {
  const groups = React.useContext(OptionGroupContext);
  React.useLayoutEffect(() => {
    if (groups.length === 0) return;
    const removes = groups.map((group) => group.add(value));
    return () => {
      for (const remove of removes) remove();
    };
  }, [groups, value]);
}

/**
 * The check column of an option. Single-select: the check glyph, kept in its place but not drawn
 * while the option is not selected, so the option texts line up. Multi-select: a 16px checkbox
 * square in Checkbox's colours, with the glyph inside only while selected; as a leaf indicator it
 * takes `forcedColors.selectedLeaf` while checked. `glyph` is the consumer's `checkIcon` when it
 * renders content, else `undefined` for the default glyph.
 */
function renderCheck(
  glyph: Slot<'span'> | undefined,
  selected: boolean,
  multiselect: boolean,
): React.ReactNode {
  if (!multiselect) {
    const classes = cn('shrink-0', !selected && 'invisible');
    return glyph === undefined ? (
      <CheckIcon className={classes} />
    ) : (
      renderSlot(glyph, 'span', cn('inline-flex', classes), { 'aria-hidden': true })
    );
  }
  return (
    <span
      aria-hidden="true"
      data-wave-option-box=""
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border',
        selected
          ? cn('border-primary bg-primary text-primary-foreground', forcedColors.selectedLeaf)
          : cn('border-stroke-accessible bg-transparent', forcedColors.control),
      )}
    >
      {selected &&
        (glyph === undefined ? (
          <CheckIcon size={12} />
        ) : (
          renderSlot(glyph, 'span', 'inline-flex shrink-0', { 'aria-hidden': true })
        ))}
    </span>
  );
}

function OptionImpl(props: OptionProps) {
  const {
    value,
    label,
    textValue,
    disabled = false,
    hidden = false,
    checkIcon,
    className,
    children,
    onClick,
    onMouseDown,
    onPointerMove,
    ref,
    ...rest
  } = props;
  const showCheck = React.useContext(OptionCheckContext);
  const groupHidden = React.useContext(OptionGroupHiddenContext);
  // A consumer-hidden option is not navigable; optionProps renders `hidden`.
  const { selected, multiselect, optionProps } = useListboxOption<HTMLLIElement>(
    { value, label, textValue, disabled, hidden: hidden || groupHidden },
    ref,
  );
  useOptionGroupMembership(value);
  const {
    ref: optionRef,
    onClick: selectOption,
    // Standalone mode only: the pointer press that focuses the list.
    onMouseDown: pressOption,
    onPointerMove: highlightOption,
    ...optionAttributes
  } = optionProps;

  // The check is a required indicator (C-SLOTS): a `checkIcon` that renders nothing keeps the
  // default glyph and warns once.
  const checkIconRenders = checkIcon != null && slotRendersContent(checkIcon);
  const checkIconEmpty = checkIcon != null && !checkIconRenders;
  React.useEffect(() => {
    if (checkIconEmpty) {
      warnOnce(
        'Option:checkIcon-empty',
        'Option: `checkIcon` renders nothing, so the default check shows: a selected option must show its state. Pass a glyph, or leave it unset.',
      );
    }
  }, [checkIconEmpty]);

  return (
    <li
      data-value={value}
      {...rest}
      {...optionAttributes}
      ref={optionRef}
      onClick={composeEventHandlers(onClick, selectOption)}
      onMouseDown={composeEventHandlers(onMouseDown, pressOption)}
      onPointerMove={composeEventHandlers(onPointerMove, highlightOption)}
      className={cn(
        OPTION_CLASSES,
        // Multi-select: the box carries the state, and `forcedColors.selectedContainer` would draw
        // every selected option like the active one in forced colours.
        selected && !multiselect && forcedColors.selectedContainer,
        className,
      )}
    >
      {showCheck && renderCheck(checkIconRenders ? checkIcon : undefined, selected, multiselect)}
      <span className="min-w-0 flex-1">{children ?? value}</span>
    </li>
  );
}
OptionImpl.displayName = 'Option';

const MemoOption = /* @__PURE__ */ React.memo(OptionImpl);
MemoOption.displayName = 'Option';

/**
 * An option of a listbox: a `Listbox`, `Combobox` or `Dropdown` (and `TagPicker`'s generated
 * list), or a custom picker's list, rendered through `ListboxSurface` or under a
 * `ListboxProvider`. Renders `<li role="option">` with a stable id (`aria-activedescendant`
 * target), `aria-selected`, a check mark while selected (`checkIcon` replaces it; in a
 * multi-select list it sits in a checkbox square) and `data-active`/`data-selected`/
 * `data-disabled` attributes for styling.
 *
 * Options register with the surrounding listbox (in DOM order, groups included), so they can be
 * wrapped, grouped or rendered conditionally. The option is memoized: moving the highlight
 * re-renders only the previously and the newly active option.
 *
 * Styling: `className` comes last. A plain background class (`className="bg-primary"`) replaces
 * the built-in hover, selected and active backgrounds in every state. To restyle one state only,
 * use its data variant (`data-[active]:bg-…`, `data-[selected]:bg-…`). The active option keeps
 * its focus outline.
 *
 * Use it inside a listbox only; it throws in development elsewhere.
 */
export const Option: React.NamedExoticComponent<OptionProps> = /* @__PURE__ */ markListboxElement(
  MemoOption,
  'option',
);

/* ------------------------------------------------------------------ */
/*  OptionGroup                                                        */
/* ------------------------------------------------------------------ */

/**
 * Props of {@link OptionGroup}. `aria-label` and `aria-labelledby` go to the group's
 * `role="group"` list; the other props go to its `<li role="presentation">` item.
 */
export interface OptionGroupProps extends React.LiHTMLAttributes<HTMLLIElement> {
  /**
   * The group's heading, which names the group. Keep it text (an icon next to the text is fine): a
   * label cannot be interactive, since nothing in it is reachable inside a listbox. Without a
   * label no heading renders; name the group with `aria-label` or `aria-labelledby` then. A group
   * without a name logs a development warning.
   */
  label?: React.ReactNode;
  /**
   * Names the group's list in place of the label (the heading still shows). A prop that holds
   * `undefined`, as from a wrapper that forwards it, leaves the label in charge.
   */
  'aria-label'?: string;
  /**
   * Ids of the elements that name the group's list, in place of the label (the heading still
   * shows). A prop that holds `undefined` leaves the label in charge.
   */
  'aria-labelledby'?: string;
  /**
   * Hides the group and every option in it (see `Option`'s `hidden`): keyboard navigation and
   * typeahead skip its options.
   * @default false
   */
  hidden?: boolean;
  /** Ref to the group's `<li role="presentation">` element. */
  ref?: React.Ref<HTMLLIElement>;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/**
 * The text a heading gives the name of its group, for the development check of `OptionGroup`: its
 * text without `aria-hidden` or `hidden` parts, where an element's `aria-label` or an image's `alt`
 * stands for its content.
 */
function nameText(node: Node | null): string {
  if (node === null) return '';
  if (node.nodeType === TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== ELEMENT_NODE) return '';
  const element = node as Element;
  if (element.getAttribute('aria-hidden') === 'true' || element.hasAttribute('hidden')) return '';
  const ownLabel = element.getAttribute('aria-label')?.trim();
  if (ownLabel) return ownLabel;
  if (element.localName === 'img') return element.getAttribute('alt') ?? '';
  let text = '';
  for (const child of Array.from(element.childNodes)) text += nameText(child);
  return text;
}

const UNNAMED_GROUP_WARNING = 'OptionGroup:unnamed';

function OptionGroupImpl({
  label,
  className,
  children,
  hidden,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ref,
  ...rest
}: OptionGroupProps) {
  const labelId = useId('option-group');
  const store = React.useContext(ListboxContext)?.store;
  const parentGroups = React.useContext(OptionGroupContext);
  const hiddenByConsumer = React.useContext(OptionGroupHiddenContext) || !!hidden;
  const [members] = React.useState(() => new OptionGroupMembers());
  const groups = React.useMemo(() => [...parentGroups, members], [parentGroups, members]);
  const subscribe = React.useCallback(
    (listener: () => void) => {
      const unsubscribeMembers = members.subscribe(listener);
      const unsubscribeStore = store?.subscribe(listener);
      return () => {
        unsubscribeMembers();
        unsubscribeStore?.();
      };
    },
    [members, store],
  );
  // Hidden while every option inside it is filtered out or hidden, also options wrapped in a
  // component (the options register with the group; re-read when they do and when the listbox
  // state changes).
  // The server render and the first client render show the group: no option has registered yet.
  const empty = React.useSyncExternalStore(
    subscribe,
    () => members.allHidden(store),
    () => false,
  );

  // The heading renders only for a label that renders content, so the list never points at an
  // empty heading. A consumer name wins over the heading; a prop that holds `undefined` (a wrapper
  // forwarding it) is no name of the consumer's.
  const hasLabel = slotRendersContent(label);
  const labelledBy = ariaLabelledBy ?? (ariaLabel === undefined && hasLabel ? labelId : undefined);

  // C-DEV: a group needs a name. Checked after every commit until the warning fired, since the
  // heading's text can come from a component, from what names the list: the heading's text, a
  // consumer `aria-labelledby` (taken as a name) or `aria-label`.
  const headingRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!isDev || hasWarned(UNNAMED_GROUP_WARNING)) return;
    const labelledByText =
      labelledBy === labelId ? nameText(headingRef.current) : (labelledBy ?? '');
    if (labelledByText.trim() === '' && (ariaLabel ?? '').trim() === '') {
      warnOnce(
        UNNAMED_GROUP_WARNING,
        'OptionGroup: the group has no name. Give it a text `label`, `aria-label` or `aria-labelledby`.',
      );
    }
  });

  return (
    <li
      {...rest}
      ref={ref}
      role="presentation"
      hidden={hidden || empty || undefined}
      className={className}
    >
      {hasLabel && (
        <div
          ref={headingRef}
          id={labelId}
          role="presentation"
          className="px-3 py-1 text-caption-1 font-semibold text-muted-foreground"
        >
          {materialiseSlotContent(label)}
        </div>
      )}
      <ul role="group" aria-label={ariaLabel} aria-labelledby={labelledBy}>
        <OptionGroupHiddenContext.Provider value={hiddenByConsumer}>
          <OptionGroupContext.Provider value={groups}>{children}</OptionGroupContext.Provider>
        </OptionGroupHiddenContext.Provider>
      </ul>
    </li>
  );
}
OptionGroupImpl.displayName = 'OptionGroup';

/**
 * Groups options under an optional heading: `<li role="presentation">` with the heading and a
 * `<ul role="group">` of the options, named by the heading (`label`) or by your `aria-label` or
 * `aria-labelledby`, which win over it. Hidden while a filter (or their own `hidden`) hides all
 * its options, also options wrapped in a component or in nested groups. Use it inside a listbox,
 * as `Option`.
 */
export const OptionGroup: React.FC<OptionGroupProps> = /* @__PURE__ */ markListboxElement(
  OptionGroupImpl,
  'group',
);

/* ------------------------------------------------------------------ */
/*  ListboxProvider                                                    */
/* ------------------------------------------------------------------ */

/** Props of {@link ListboxProvider}. */
export interface ListboxProviderProps {
  /** The context of a listbox: `useListbox(...).context`. */
  value: ListboxContextValue;
  /** The options (`Option`, `OptionGroup` or options of your own on `useListboxOption`). */
  children?: React.ReactNode;
}

/**
 * Provides a listbox's context to its options, for a custom picker that renders its list without
 * `ListboxSurface`: `<ListboxProvider value={listbox.context}><ul {...listbox.getListboxProps()}>…</ul></ListboxProvider>`.
 */
export function ListboxProvider({ value, children }: ListboxProviderProps) {
  return <ListboxContext.Provider value={value}>{children}</ListboxContext.Provider>;
}
ListboxProvider.displayName = 'ListboxProvider';

/* ------------------------------------------------------------------ */
/*  Listbox popup: useListboxPopup and ListboxSurface                  */
/* ------------------------------------------------------------------ */

/** Options of {@link useListboxPopup}. */
export interface UseListboxPopupOptions {
  /**
   * The listbox is open (your open state). While it is, a press outside your picker and its
   * surface, and focus leaving them, dismiss it.
   */
  open: boolean;
  /**
   * The surface is shown (the list, or the empty content of {@link ListboxSurface}): it is
   * positioned, and Escape dismisses it. While the listbox is open with nothing shown (no options
   * to show), Escape is left to an enclosing layer, such as a Dialog around the picker.
   */
  surfaceOpen: boolean;
  /**
   * Called when the popup should close: set your open state to `false`. `reason` is `'escape'`,
   * `'outside-press'` or `'focus-outside'`.
   */
  onDismiss: (reason: DismissReason) => void;
  /** Your picker's root element: presses and focus inside it are not outside the popup. */
  rootRef: React.RefObject<HTMLElement | null>;
  /**
   * The combobox element, which anchors the popup's dismiss layer. Pass the element to
   * `setReference` too (merged into its ref), which places the surface against it.
   */
  anchorRef: React.RefObject<HTMLElement | null>;
}

/**
 * Result of {@link useListboxPopup}. Destructure it: `eslint-plugin-react-hooks` treats an object
 * with a member passed to a `ref` prop as a ref, and rejects reading its other members during
 * render (`react-hooks/refs`).
 */
export interface UseListboxPopupResult {
  /** The popup's dismiss layer: pass it to {@link ListboxSurface}. */
  layerId: string;
  /**
   * Ref callback for the element the surface is placed against: merge it into your combobox's ref.
   */
  setReference: (el: HTMLElement | null) => void;
  /** Ref callback for the surface: pass it to {@link ListboxSurface}. */
  surfaceRef: React.RefCallback<HTMLElement>;
  /** The surface's `data-side`, `data-align` and position style: pass them to {@link ListboxSurface}. */
  floatingProps: { 'data-side': string; 'data-align': string; style: React.CSSProperties };
}

/**
 * Dismissal and positioning of a custom picker's listbox popup, for {@link ListboxSurface}. The
 * popup is dismissed by Escape, by a press outside your picker and its surface, and by focus
 * leaving them (`onDismiss` says which). The surface opens below the anchor and as wide as it,
 * flips above it when there is no room below, and is limited to the space available; its
 * `data-side` and `data-align` attributes give the final placement.
 *
 * While the listbox is open with nothing to show (`surfaceOpen` is `false`), Escape is left to an
 * enclosing layer, such as a Dialog around the picker. Let your combobox's key handler leave it
 * too: on such an Escape, set your open state to `false` without calling `listbox.onKeyDown`,
 * which handles Escape (and prevents its default) whenever the listbox is open.
 *
 * @example
 * const expanded = open && listbox.items.length > 0;
 * const { layerId, setReference, surfaceRef, floatingProps } = useListboxPopup({
 *   open,
 *   surfaceOpen: expanded,
 *   onDismiss: () => setOpen(false),
 *   rootRef,
 *   anchorRef: buttonRef,
 * });
 * const buttonMergedRef = useMergedRefs(buttonRef, setReference);
 */
export function useListboxPopup(options: UseListboxPopupOptions): UseListboxPopupResult {
  const { open, surfaceOpen, onDismiss, rootRef, anchorRef } = options;
  const surfaceElementRef = React.useRef<HTMLElement | null>(null);
  const { setReference, setFloating, floatingProps } = usePopupPosition({
    open: surfaceOpen,
    side: 'bottom',
    align: 'start',
    matchReferenceWidth: true,
    fitViewport: true,
  });
  const { layerId } = useDismiss({
    open,
    onDismiss: (reason) => onDismiss(reason),
    refs: [rootRef, surfaceElementRef],
    anchorRef,
    kind: 'listbox',
    escape: surfaceOpen,
    focusOutside: true,
  });
  const surfaceRef = useMergedRefs<HTMLElement>(surfaceElementRef, setFloating);
  return { layerId, setReference, surfaceRef, floatingProps };
}

/**
 * Props of {@link ListboxSurface}. The options of one listbox live in one list at a time, and this
 * surface renders that list: render every option of the listbox inside it, never in a second list
 * of your own, not even for an exit animation.
 */
export interface ListboxSurfaceProps {
  /** The listbox: the result of `useListbox` in select-only or editable mode. */
  listbox: UseListboxResult;
  /** `layerId` from {@link useListboxPopup}: the surface joins the popup's dismiss layer. */
  layerId: string;
  /** `surfaceRef` from {@link useListboxPopup}. */
  surfaceRef: React.RefCallback<HTMLElement>;
  /** `floatingProps` from {@link useListboxPopup}: the surface's placement. */
  floatingProps: UseListboxPopupResult['floatingProps'];
  /** The listbox is open (your open state). `emptyContent` shows only while it is. */
  open: boolean;
  /**
   * The list is shown: the listbox is open and has options to show (`open &&
   * listbox.items.length > 0`). The list then renders in the surface, and otherwise `hidden`, in
   * place inside your picker.
   */
  expanded: boolean;
  /**
   * Shown in the surface while the listbox is open but not expanded, such as a "No matches"
   * message. Nothing shows while it is `undefined` or `null`.
   */
  emptyContent?: React.ReactNode;
  /** Names the list. Name it with this or `aria-labelledby`, usually your picker's label. */
  'aria-label'?: string;
  /** Ids of the elements that name the list, usually your picker's label. */
  'aria-labelledby'?: string;
  /**
   * Options draw a check while selected (in a multi-select list, a checkbox square). Turn it off
   * for a list that never shows selected options, such as the suggestions of a tag picker.
   * @default true
   */
  showCheck?: boolean;
  /**
   * Classes merged last onto the list: they replace the list's own classes they conflict with,
   * its maximum height included.
   */
  listClassName?: string;
  /**
   * Classes merged last onto the surface, the popup around the list: they replace its own
   * classes they conflict with.
   */
  surfaceClassName?: string;
  /** The options (`Option`, `OptionGroup` or options of your own on `useListboxOption`). */
  children?: React.ReactNode;
}

function preventMouseDown(event: React.MouseEvent) {
  event.preventDefault();
}

/**
 * The option list of a custom picker and the popup it opens in: a `<ul role="listbox">` with the
 * options (spread from `listbox.getListboxProps()`), rendered `hidden` in place inside your
 * picker while the list is not shown, so the options register and their ids exist from the first
 * render, and in a portaled surface placed by {@link useListboxPopup} while it is, never in both.
 * While the listbox is open with nothing to show, the surface shows `emptyContent` instead, if
 * any. A press on the surface keeps focus on your combobox. It provides the listbox's context to
 * the options, so it needs no {@link ListboxProvider}.
 *
 * @example
 * <ListboxSurface
 *   listbox={listbox}
 *   layerId={layerId}
 *   surfaceRef={surfaceRef}
 *   floatingProps={floatingProps}
 *   open={open}
 *   expanded={expanded}
 *   aria-labelledby={labelId}
 * >
 *   <Option value="georgia">Georgia</Option>
 * </ListboxSurface>
 */
export function ListboxSurface(props: ListboxSurfaceProps) {
  const {
    listbox,
    layerId,
    surfaceRef,
    floatingProps,
    open,
    expanded,
    emptyContent,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    showCheck = true,
    listClassName,
    surfaceClassName,
    children,
  } = props;

  const list = (
    <OptionCheckContext.Provider value={showCheck}>
      <ListboxProvider value={listbox.context}>
        <ul
          {...listbox.getListboxProps()}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          hidden={!expanded || undefined}
          className={cn('min-h-0 max-h-60 overflow-auto', listClassName)}
        >
          {children}
        </ul>
      </ListboxProvider>
    </OptionCheckContext.Provider>
  );

  // A closed listbox never leaves a surface behind: the text typed before closing survives it.
  const showEmpty = open && !expanded && emptyContent !== undefined && emptyContent !== null;
  if (!expanded && !showEmpty) return list;

  return (
    <>
      {!expanded && list}
      <Portal layerId={layerId}>
        <div
          ref={surfaceRef}
          {...floatingProps}
          data-wave-listbox-surface=""
          onMouseDown={preventMouseDown}
          className={cn(
            'flex flex-col overflow-hidden rounded border border-border bg-background py-1 text-foreground shadow-4',
            surfaceClassName,
          )}
        >
          {expanded ? list : emptyContent}
        </div>
      </Portal>
    </>
  );
}
ListboxSurface.displayName = 'ListboxSurface';
