import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { warnOnce } from '../../lib/dev';
import { slotRendersContent } from '../../lib/slot';
import { useEventCallback } from '../../hooks/useEventCallback';
import {
  ListboxOptionPositionContext,
  type ListboxItem,
  type ListboxOptionPosition,
} from '../../hooks/useListbox';
import type { VirtualWindow } from '../../hooks/useVirtualWindow';
import { Option, OptionGroup, type ListboxOptionRenderState } from './Option';

/*
 * Data mode of Listbox, Combobox and Dropdown (`items`, `renderOption`): the options rendered from
 * the shown items of `useListbox` (its `items`, in order), each keyed by its value and told its
 * position among them, all of them or, with a `virtualWindow`, the window's. Module-only.
 */

/** A `renderOption` prop of Listbox, Combobox or Dropdown. */
type RenderOption = (item: ListboxItem, state: ListboxOptionRenderState) => React.ReactNode;

/** What every option of a data-mode list is drawn from, besides its item. */
export interface ListboxItemsState {
  /** The selected values. */
  selected: ReadonlySet<string>;
  /** The active option's value (`useListbox(...).activeValue`). */
  activeValue: string | null;
  /** The consumer's `renderOption`, else the default `Option`. */
  renderOption: RenderOption | undefined;
}

interface DataOptionProps {
  item: ListboxItem;
  index: number;
  setSize: number;
  /** The window's item size, in a windowed list: the option's height. */
  itemSize: number | undefined;
  selected: boolean;
  active: boolean;
  renderOption: RenderOption | undefined;
}

/*
 * One option, memoized on its item, position and state: moving the highlight renders the old and
 * the new active option only (with a stable `renderOption`). The position context reaches the
 * option `renderOption` returns, through `useListboxOption`.
 */
function DataOptionImpl({
  item,
  index,
  setSize,
  itemSize,
  selected,
  active,
  renderOption,
}: DataOptionProps) {
  const position = React.useMemo<ListboxOptionPosition>(
    () => (itemSize === undefined ? { index, setSize } : { index, setSize, itemSize }),
    [index, setSize, itemSize],
  );
  return (
    <ListboxOptionPositionContext.Provider value={position}>
      {renderOption ? (
        renderOption(item, { selected, active, index })
      ) : (
        <Option
          value={item.value}
          label={item.label}
          textValue={item.textValue}
          disabled={item.disabled}
        >
          {item.label}
        </Option>
      )}
    </ListboxOptionPositionContext.Provider>
  );
}
DataOptionImpl.displayName = 'ListboxDataOption';

const DataOption = /* @__PURE__ */ React.memo(DataOptionImpl);
DataOption.displayName = 'ListboxDataOption';

/** The option of the shown item at `index`, under `key`, `itemSize` tall in a windowed list. */
function dataOption(
  items: readonly ListboxItem[],
  index: number,
  state: ListboxItemsState,
  key: string,
  itemSize?: number,
): React.ReactElement {
  const item = items[index];
  return (
    <DataOption
      key={key}
      item={item}
      index={index}
      setSize={items.length}
      itemSize={itemSize}
      selected={state.selected.has(item.value)}
      active={state.activeValue === item.value}
      renderOption={state.renderOption}
    />
  );
}

/**
 * The option of the shown item at `index` (`items` is `useListbox(...).items`, the shown items in
 * order), keyed by its value so its element, and its id, follow the value. Its position is `index`
 * among `items.length` options.
 */
export function renderListboxItem(
  items: readonly ListboxItem[],
  index: number,
  state: ListboxItemsState,
): React.ReactElement {
  return dataOption(items, index, state, items[index].value);
}

/** The options of every shown item, in order (see {@link renderListboxItem}). */
export function renderListboxItems(
  items: readonly ListboxItem[],
  state: ListboxItemsState,
): React.ReactElement[] {
  return items.map((_, index) => renderListboxItem(items, index, state));
}

const NO_KEPT_INDEXES: readonly number[] = [];

/**
 * An element that stands in for the options of a windowed list that are not rendered: as tall as
 * they are, out of the accessibility tree, and never shrunk by the column layout of a Listbox.
 */
function ListboxSpacer({ size, className }: { size: number; className: string }) {
  return (
    <li
      aria-hidden="true"
      role="presentation"
      data-virtual-spacer=""
      className={className}
      style={{ height: size, flexShrink: 0 }}
    />
  );
}
ListboxSpacer.displayName = 'ListboxSpacer';

/**
 * The window of a windowed data-mode list: `virtualWindow.layout` over the shown items, with the
 * active option kept rendered outside the window (so `aria-activedescendant` always names an
 * element), each option `itemSize` tall, and a spacer, carrying `spacerClassName`, for every run
 * of options that is not rendered. The layout only returns indexes below `items.length`. Option
 * keys and spacer keys start differently, so no value can collide with a spacer.
 */
export function renderListboxWindow(
  items: readonly ListboxItem[],
  virtualWindow: VirtualWindow,
  state: ListboxItemsState,
  spacerClassName: string,
): React.ReactElement[] {
  const { activeValue } = state;
  const activeIndex =
    activeValue === null ? -1 : items.findIndex((item) => item.value === activeValue);
  const keep = activeIndex === -1 ? NO_KEPT_INDEXES : [activeIndex];
  return virtualWindow
    .layout(items.length, { keep })
    .map((entry) =>
      entry.kind === 'item' ? (
        dataOption(
          items,
          entry.index,
          state,
          `option:${items[entry.index].value}`,
          virtualWindow.itemSize,
        )
      ) : (
        <ListboxSpacer key={`spacer:${entry.key}`} size={entry.size} className={spacerClassName} />
      ),
    );
}

/**
 * Scrolls a windowed popup list to its active option, else to its first selected one, centred,
 * from the commit that shows the list. That commit mounts a new list element (a closed list is
 * another element, without options), which the window attaches only in the next commit: it keeps
 * the request until then.
 */
export function useShownListScroll(
  shown: boolean,
  virtualWindow: VirtualWindow | undefined,
  items: readonly ListboxItem[],
  activeValue: string | null,
  selectedValues: readonly string[],
): void {
  const scroll = useEventCallback(() => {
    if (!virtualWindow) return;
    let index = activeValue === null ? -1 : items.findIndex((item) => item.value === activeValue);
    if (index === -1) {
      const selected = new Set(selectedValues);
      index = items.findIndex((item) => selected.has(item.value));
    }
    if (index !== -1) virtualWindow.scrollToIndex(index, { align: 'center' });
  });
  React.useLayoutEffect(() => {
    if (shown) scroll();
  }, [shown, scroll]);
}

/**
 * Development warning, once, when a data-mode list also has children that render something: the
 * options render from `items` and the children are ignored (C-DEV, from an effect).
 */
export function useItemsAndChildrenWarning(
  component: 'Listbox' | 'Combobox' | 'Dropdown',
  items: readonly ListboxItem[] | undefined,
  children: React.ReactNode,
): void {
  const both = items !== undefined && slotRendersContent(children);
  React.useEffect(() => {
    if (!both) return;
    warnOnce(
      `${component}:items-and-children`,
      `${component}: \`items\` and option children were both passed. The options render from ` +
        '`items` and the children are ignored: pass one of them.',
    );
  }, [both, component]);
}

/** The props of a data-mode list that {@link useDataModeWarnings} checks. */
interface DataModeProps {
  items: readonly ListboxItem[] | undefined;
  renderOption: RenderOption | undefined;
  virtualWindow: VirtualWindow | undefined;
  children: React.ReactNode;
}

/**
 * Development warnings, each once and from an effect (C-DEV), for the data-mode props that do
 * nothing: `renderOption` without `items`, a `virtualWindow` without `items`, and a
 * `virtualWindow` beside `OptionGroup` children (a window renders a flat list), which says more
 * than the warning about `items` and replaces it.
 */
export function useDataModeWarnings(
  component: 'Listbox' | 'Combobox' | 'Dropdown',
  { items, renderOption, virtualWindow, children }: DataModeProps,
): void {
  const renderOptionIgnored = renderOption !== undefined && items === undefined;
  const windowGroups =
    virtualWindow !== undefined &&
    flattenChildren(children).some(({ node }) => isElementOfType(node, OptionGroup));
  const windowIgnored = virtualWindow !== undefined && items === undefined && !windowGroups;
  React.useEffect(() => {
    if (!renderOptionIgnored) return;
    warnOnce(
      `${component}:render-option-without-items`,
      `${component}: \`renderOption\` is ignored without \`items\`: it draws the options of data ` +
        'mode only. Pass the options as `items`, or leave `renderOption` out.',
    );
  }, [renderOptionIgnored, component]);
  React.useEffect(() => {
    if (!windowIgnored) return;
    warnOnce(
      `${component}:virtual-window-requires-items`,
      `${component}: \`virtualWindow\` is ignored without \`items\`: only the options of data ` +
        'mode are windowed, so every option child is rendered. Pass the options as `items`.',
    );
  }, [windowIgnored, component]);
  React.useEffect(() => {
    if (!windowGroups) return;
    warnOnce(
      `${component}:virtual-window-groups`,
      `${component}: option groups cannot be windowed: \`virtualWindow\` renders the flat list ` +
        'of `items` only, and `OptionGroup` children are not windowed. Pass the options as ' +
        '`items`, without groups.',
    );
  }, [windowGroups, component]);
}
