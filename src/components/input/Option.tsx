import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { CheckIcon } from '../../lib/icons';
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
  type ListboxStore,
  type UseListboxResult,
} from '../../hooks/useListbox';
import { Portal } from '../portal/Portal';

/* ------------------------------------------------------------------ */
/*  Option                                                             */
/* ------------------------------------------------------------------ */

/** Properties for the Option component used within Combobox and Dropdown. */
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
   * Whether the option is disabled: it stays visible but is skipped by keyboard navigation and
   * cannot be selected.
   * @default false
   */
  disabled?: boolean;
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
 * `[&[hidden]]:hidden`: a filtered-out option carries the `hidden` attribute, but without Preflight
 * (Wave ships none) the author `display: flex` would override the user-agent
 * `[hidden] { display: none }` rule and leave it visible. The attribute variant (class + attribute
 * specificity) wins over any display utility, a consumer's included.
 */
const HIDDEN_WINS = '[&[hidden]]:hidden';

const OPTION_CLASSES = cn(
  'flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 text-body-1 text-foreground',
  HIDDEN_WINS,
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

  /** At least one option, and a filter hides every one of them. */
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

const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? React.useLayoutEffect : React.useEffect;

/** Adds an option's value to every group around it while the option is mounted. */
function useOptionGroupMembership(value: string): void {
  const groups = React.useContext(OptionGroupContext);
  useIsomorphicLayoutEffect(() => {
    if (groups.length === 0) return;
    const removes = groups.map((group) => group.add(value));
    return () => {
      for (const remove of removes) remove();
    };
  }, [groups, value]);
}

function OptionImpl(props: OptionProps) {
  const {
    value,
    label,
    textValue,
    disabled = false,
    className,
    children,
    onClick,
    onPointerMove,
    ref,
    ...rest
  } = props;
  const showCheck = React.useContext(OptionCheckContext);
  const { selected, optionProps } = useListboxOption<HTMLLIElement>(
    { value, label, textValue, disabled },
    ref,
  );
  useOptionGroupMembership(value);
  const {
    ref: optionRef,
    onClick: selectOption,
    onPointerMove: highlightOption,
    ...optionAttributes
  } = optionProps;

  return (
    <li
      data-value={value}
      {...rest}
      {...optionAttributes}
      ref={optionRef}
      onClick={composeEventHandlers(onClick, selectOption)}
      onPointerMove={composeEventHandlers(onPointerMove, highlightOption)}
      className={cn(OPTION_CLASSES, selected && forcedColors.selectedContainer, className)}
    >
      {showCheck && <CheckIcon className={cn('shrink-0', !selected && 'invisible')} />}
      <span className="min-w-0 flex-1">{children ?? value}</span>
    </li>
  );
}
OptionImpl.displayName = 'Option';

const MemoOption = /* @__PURE__ */ React.memo(OptionImpl);
MemoOption.displayName = 'Option';

/**
 * An option of a `Combobox`, `Dropdown` (and `TagPicker`'s generated list). Renders
 * `<li role="option">` with a stable id (`aria-activedescendant` target), `aria-selected`, a check
 * mark while selected and `data-active`/`data-selected`/`data-disabled` attributes for styling.
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
 * Use it inside a `Combobox` or `Dropdown` only; it throws in development elsewhere.
 */
export const Option: React.NamedExoticComponent<OptionProps> = /* @__PURE__ */ markListboxElement(
  MemoOption,
  'option',
);

/* ------------------------------------------------------------------ */
/*  OptionGroup                                                        */
/* ------------------------------------------------------------------ */

/** Properties for the OptionGroup component used to group options. */
export interface OptionGroupProps extends React.LiHTMLAttributes<HTMLLIElement> {
  /** Heading label for the option group (names the group). */
  label: string;
  /** Ref to the group's `<li role="presentation">` element. */
  ref?: React.Ref<HTMLLIElement>;
}

function OptionGroupImpl({ label, className, children, hidden, ref, ...rest }: OptionGroupProps) {
  const labelId = useId('option-group');
  const store = React.useContext(ListboxContext)?.store;
  const parentGroups = React.useContext(OptionGroupContext);
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
  // Hidden while a filter hides every option inside it, also options wrapped in a component (the
  // options register with the group; re-read when they do and when the listbox state changes).
  // The server render and the first client render show the group: no option has registered yet.
  const empty = React.useSyncExternalStore(
    subscribe,
    () => members.allHidden(store),
    () => false,
  );

  return (
    <li
      {...rest}
      ref={ref}
      role="presentation"
      hidden={hidden || empty || undefined}
      className={cn(HIDDEN_WINS, className)}
    >
      <div
        id={labelId}
        role="presentation"
        className="px-3 py-1 text-caption-1 font-semibold text-muted-foreground"
      >
        {label}
      </div>
      <ul role="group" aria-labelledby={labelId}>
        <OptionGroupContext.Provider value={groups}>{children}</OptionGroupContext.Provider>
      </ul>
    </li>
  );
}
OptionGroupImpl.displayName = 'OptionGroup';

/**
 * Groups options under a heading: `<li role="presentation">` with the heading and a
 * `<ul role="group" aria-labelledby>` of the options. Hidden while a filter hides all its options,
 * also options wrapped in a component or in nested groups.
 */
export const OptionGroup: React.FC<OptionGroupProps> = /* @__PURE__ */ markListboxElement(
  OptionGroupImpl,
  'group',
);

/* ------------------------------------------------------------------ */
/*  Listbox popup (P05-internal, shared by Combobox, Dropdown, TagPicker) */
/* ------------------------------------------------------------------ */

/** Options of {@link useListboxPopup}. */
export interface UseListboxPopupOptions {
  /** The listbox is open (dismiss layer registered: outside press, focus outside). */
  open: boolean;
  /**
   * The portaled surface is shown: positioning runs and the layer takes Escape. While the listbox
   * is open with nothing shown (no options), Escape is left to an enclosing layer (overlays#1).
   */
  surfaceOpen: boolean;
  /** Close the listbox. */
  onDismiss: (reason: DismissReason) => void;
  /** The component root: presses and focus inside it are not "outside". */
  rootRef: React.RefObject<HTMLElement | null>;
  /** The combobox element (the layer's anchor). */
  anchorRef: React.RefObject<HTMLElement | null>;
}

/** Result of {@link useListboxPopup}. Destructure it (react-hooks/refs). */
export interface ListboxPopup {
  /** The dismiss layer id (pass to {@link ListboxSurface}). */
  layerId: string;
  /** Ref callback for the element the surface is positioned against. */
  setReference: (el: HTMLElement | null) => void;
  /** Ref callback for the surface. */
  surfaceRef: React.RefCallback<HTMLElement>;
  /** `data-side`, `data-align` and the position style for the surface. */
  floatingProps: { 'data-side': string; 'data-align': string; style: React.CSSProperties };
}

/**
 * Dismissal and positioning of a listbox surface (C-POPUPS, spec §5.4): `useDismiss` (Escape,
 * outside press, focus outside; `kind: 'listbox'`) and `usePopupPosition` (bottom-start, flip,
 * shift, the anchor's width, limited to the available space).
 */
export function useListboxPopup(options: UseListboxPopupOptions): ListboxPopup {
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

/** Props of {@link ListboxSurface}. */
export interface ListboxSurfaceProps {
  /** The listbox (from `useListbox`). */
  listbox: UseListboxResult;
  /** From {@link useListboxPopup}. */
  layerId: string;
  surfaceRef: React.RefCallback<HTMLElement>;
  floatingProps: ListboxPopup['floatingProps'];
  /** The listbox is open: `emptyContent` is shown only while it is (input-pickers#21). */
  open: boolean;
  /** The listbox is displayed: the list renders in the portaled surface. */
  expanded: boolean;
  /** While open but not expanded, show the surface with this content (e.g. "No matches"). */
  emptyContent?: React.ReactNode;
  /** Accessible name of the listbox. */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** Options draw a check mark while selected. @default true */
  showCheck?: boolean;
  children?: React.ReactNode;
}

function preventMouseDown(event: React.MouseEvent) {
  event.preventDefault();
}

/**
 * Renders the option list in a single container at a time (spec §2.5, §5.5): inline and `hidden`
 * inside the component root while closed (registration and ids exist from the first client
 * commit), and in a `Portal` surface while expanded — never both.
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
    children,
  } = props;

  const list = (
    <OptionCheckContext.Provider value={showCheck}>
      <ListboxContext.Provider value={listbox.context}>
        <ul
          {...listbox.getListboxProps()}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          hidden={!expanded || undefined}
          className="min-h-0 max-h-60 overflow-auto"
        >
          {children}
        </ul>
      </ListboxContext.Provider>
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
          className="flex flex-col overflow-hidden rounded border border-border bg-background py-1 text-foreground shadow-4"
        >
          {expanded ? list : emptyContent}
        </div>
      </Portal>
    </>
  );
}
ListboxSurface.displayName = 'ListboxSurface';
