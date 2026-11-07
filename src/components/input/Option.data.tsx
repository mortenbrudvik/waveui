import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { warnOnce } from '../../lib/dev';
import {
  getListboxRows,
  splitGroupNames,
  type ListboxGroup,
  type ListboxRows,
  type ListboxScrollTarget,
} from '../../lib/listboxRows';
import { optionGroupClassNames } from '../../lib/classNames';
import { slotRendersContent } from '../../lib/slot';
import { wcn } from '../../lib/cn';
import type { VirtualEntry } from '../../lib/virtual';
import { useEventCallback } from '../../hooks/useEventCallback';
import {
  ListboxOptionPositionContext,
  type ListboxItem,
  type ListboxOptionPosition,
} from '../../hooks/useListbox';
import type { VirtualWindow } from '../../hooks/useVirtualWindow';
import {
  Option,
  OptionGroup,
  type ListboxGroupRenderState,
  type ListboxOptionRenderState,
} from './Option';

/*
 * Data mode of Listbox, Combobox and Dropdown (`items`, `renderOption`): the options rendered from
 * the shown items of `useListbox` (its `items`, in order), each keyed by its value and told its
 * position among them, all of them or, with a `virtualWindow`, the window's. Module-only.
 */

/** A `renderOption` prop of Listbox, Combobox or Dropdown. */
type RenderOption = (item: ListboxItem, state: ListboxOptionRenderState) => React.ReactNode;

/** A `renderGroup` prop of Listbox, Combobox or Dropdown. */
type RenderGroup = (group: string, state: ListboxGroupRenderState) => React.ReactNode;

/** What every option of a data-mode list is drawn from, besides its item. */
export interface ListboxItemsState {
  /** The selected values. */
  selected: ReadonlySet<string>;
  /** The active option's value (`useListbox(...).activeValue`). */
  activeValue: string | null;
  /** The consumer's `renderOption`, else the default `Option`. */
  renderOption: RenderOption | undefined;
  /** The consumer's `renderGroup`, else the group's name as text. */
  renderGroup?: RenderGroup | undefined;
}

interface DataOptionProps {
  item: ListboxItem;
  index: number;
  setSize: number;
  /** `aria-posinset`, for an option of a group (else `index + 1`). */
  posInSet: number | undefined;
  /** The option's row in a window that counts group headers, else `index`. */
  rowIndex: number | undefined;
  /** The window's item size, in a windowed list: the option's height. */
  itemSize: number | undefined;
  /** The window's `itemProps`, in a list whose window measures its rows (no fixed height). */
  itemProps: VirtualWindow['itemProps'];
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
  posInSet,
  rowIndex,
  itemSize,
  itemProps,
  selected,
  active,
  renderOption,
}: DataOptionProps) {
  const position = React.useMemo<ListboxOptionPosition>(() => {
    const own: ListboxOptionPosition = { index, setSize };
    if (posInSet !== undefined) own.posInSet = posInSet;
    if (rowIndex !== undefined) own.rowIndex = rowIndex;
    if (itemProps) own.itemProps = itemProps;
    else if (itemSize !== undefined) own.itemSize = itemSize;
    return own;
  }, [index, setSize, posInSet, rowIndex, itemSize, itemProps]);
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
  itemProps?: VirtualWindow['itemProps'],
  rows?: ListboxRows,
): React.ReactElement {
  const item = items[index];
  return (
    <DataOption
      key={key}
      item={item}
      index={index}
      setSize={rows ? rows.setSize[index] : items.length}
      posInSet={rows?.posInSet[index]}
      rowIndex={rows?.rowOfItem[index]}
      itemSize={itemSize}
      itemProps={itemProps}
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
  const rows = getListboxRows(items);
  if (rows) {
    const entries: VirtualEntry[] = rows.rows.map((_, index) => ({ kind: 'item', index }));
    return renderGroupedRows(items, rows, entries, state, '');
  }
  return items.map((_, index) => renderListboxItem(items, index, state));
}

/*
 * The header of a group: a row of the list that is no option. It is out of the accessibility tree
 * (`aria-hidden`): the group's list names itself with the group's name, so the name is the same
 * whether or not the header is rendered (a window renders the header only while it is in range).
 */
interface GroupHeaderProps {
  name: string;
  ordinal: number;
  size: number;
  rowIndex: number;
  itemSize: number | undefined;
  itemProps: VirtualWindow['itemProps'];
  renderGroup: RenderGroup | undefined;
}

function GroupHeaderImpl({
  name,
  ordinal,
  size,
  rowIndex,
  itemSize,
  itemProps,
  renderGroup,
}: GroupHeaderProps) {
  // Rows of a window are exactly `itemSize` tall, or carry the window's attributes and measure.
  const windowed: React.CSSProperties | undefined = itemProps
    ? { boxSizing: 'border-box', flexShrink: 0 }
    : itemSize !== undefined
      ? { height: itemSize, boxSizing: 'border-box', flexShrink: 0 }
      : undefined;
  return (
    <div
      {...(itemProps ? itemProps(rowIndex) : undefined)}
      aria-hidden="true"
      data-group-header=""
      className={wcn(
        optionGroupClassNames.label,
        'wave:flex wave:items-center wave:px-3 wave:py-1 wave:text-caption-1 wave:font-semibold wave:text-muted-foreground',
      )}
      style={windowed}
    >
      {renderGroup ? renderGroup(name, { index: ordinal, size }) : name}
    </div>
  );
}
GroupHeaderImpl.displayName = 'ListboxGroupHeader';

const GroupHeader = /* @__PURE__ */ React.memo(GroupHeaderImpl);
GroupHeader.displayName = 'ListboxGroupHeader';

/** The rendered rows of one group, between two spacers or two other groups. */
interface GroupRun {
  group: ListboxGroup;
  header: React.ReactElement | null;
  options: React.ReactElement[];
}

/*
 * A group is `<li role="presentation">` with its header and a `<ul role="group">` of its options,
 * named by the group's name: the structure of `OptionGroup`, which ARIA needs (a group owns its
 * options). A window renders part of a group, so each run of rendered rows of a group gets its own
 * element, named by `aria-label` and not by the header, which may not be rendered. A group rendered
 * in two runs (its rows around a spacer: the window, and the active option kept beside it) keeps
 * one key per run.
 */
function groupElement(run: GroupRun, occurrence: number): React.ReactElement {
  return (
    <li
      key={`group:${run.group.ordinal}:${occurrence}`}
      role="presentation"
      className={optionGroupClassNames.root}
      style={{ flexShrink: 0 }}
    >
      {run.header}
      {run.options.length > 0 && (
        <ul
          role="group"
          aria-label={run.group.name}
          className={wcn(optionGroupClassNames.list, 'wave:m-0 wave:list-none wave:p-0')}
        >
          {run.options}
        </ul>
      )}
    </li>
  );
}

/**
 * The entries of a list with groups (`rows`, from `getListboxRows`; an entry's index is a row):
 * ungrouped options and spacers directly in the list, and a group element for each run of
 * rendered rows of a group.
 */
function renderGroupedRows(
  items: readonly ListboxItem[],
  rows: ListboxRows,
  entries: readonly VirtualEntry[],
  state: ListboxItemsState,
  spacerClassName: string,
  virtualWindow?: VirtualWindow,
): React.ReactElement[] {
  const out: React.ReactElement[] = [];
  const occurrences = new Map<number, number>();
  let run: GroupRun | null = null;
  const flush = () => {
    if (!run) return;
    const occurrence = occurrences.get(run.group.ordinal) ?? 0;
    occurrences.set(run.group.ordinal, occurrence + 1);
    out.push(groupElement(run, occurrence));
    run = null;
  };
  for (const entry of entries) {
    if (entry.kind === 'spacer') {
      flush();
      out.push(
        <ListboxSpacer key={`spacer:${entry.key}`} size={entry.size} className={spacerClassName} />,
      );
      continue;
    }
    const row = rows.rows[entry.index];
    if (row.kind === 'header') {
      flush();
      run = {
        group: row.group,
        options: [],
        header: (
          <GroupHeader
            key={`header:${row.group.ordinal}`}
            name={row.group.name}
            ordinal={row.group.ordinal}
            size={row.group.size}
            rowIndex={entry.index}
            itemSize={virtualWindow?.itemSize}
            itemProps={virtualWindow?.itemProps}
            renderGroup={state.renderGroup}
          />
        ),
      };
      continue;
    }
    const option = dataOption(
      items,
      row.item,
      state,
      virtualWindow ? `option:${items[row.item].value}` : items[row.item].value,
      virtualWindow?.itemSize,
      virtualWindow?.itemProps,
      rows,
    );
    if (row.group === null) {
      flush();
      out.push(option);
      continue;
    }
    if (run?.group !== row.group) {
      flush();
      run = { group: row.group, header: null, options: [] };
    }
    run.options.push(option);
  }
  flush();
  return out;
}

/**
 * Scrolls a windowed list to the option at `index` (among the shown items), as `useListbox`'s
 * `onScrollToItem` asks: the option's row, and first the header row above it when the option
 * opens a group, so the header shows with it. `target` is absent in a list without groups.
 */
export function scrollWindowToItem(
  virtualWindow: VirtualWindow,
  index: number,
  target?: ListboxScrollTarget,
): void {
  if (target?.headerRow !== undefined) {
    virtualWindow.scrollToIndex(target.headerRow, { align: 'auto' });
  }
  virtualWindow.scrollToIndex(target ? target.row : index, { align: 'auto' });
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
  const rows = getListboxRows(items);
  if (rows) {
    // The window counts rows: the group headers are rows of their own.
    const keepRow = activeIndex === -1 ? NO_KEPT_INDEXES : [rows.rowOfItem[activeIndex]];
    return renderGroupedRows(
      items,
      rows,
      virtualWindow.layout(rows.rows.length, { keep: keepRow }),
      state,
      spacerClassName,
      virtualWindow,
    );
  }
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
          virtualWindow.itemProps,
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
 * the last request until then. Call it after `useListbox`, so this request comes after the active
 * option's own (`onScrollToItem`, from `useListbox`'s layout effect) and replaces it.
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
    if (index !== -1) {
      // A window of groups counts rows, and the headers are rows.
      const rows = getListboxRows(items);
      virtualWindow.scrollToIndex(rows ? rows.rowOfItem[index] : index, { align: 'center' });
    }
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
  renderGroup?: RenderGroup | undefined;
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
  { items, renderOption, renderGroup, virtualWindow, children }: DataModeProps,
): void {
  const renderOptionIgnored = renderOption !== undefined && items === undefined;
  const renderGroupIgnored = renderGroup !== undefined && items === undefined;
  const splitGroupsKey = React.useMemo(
    () => (items ? splitGroupNames(items).join(', ') : ''),
    [items],
  );
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
    if (!renderGroupIgnored) return;
    warnOnce(
      `${component}:render-group-without-items`,
      `${component}: \`renderGroup\` is ignored without \`items\`: it draws the group headers of ` +
        'data mode only. Pass the options as `items` with a `group`, or draw the groups with ' +
        '`OptionGroup`.',
    );
  }, [renderGroupIgnored, component]);
  React.useEffect(() => {
    if (splitGroupsKey === '') return;
    warnOnce(
      `${component}:group-not-adjacent`,
      `${component}: the items of a group are not adjacent (${splitGroupsKey}): a group name that ` +
        'comes back after other items starts another group, with a header of its own. Order the ' +
        '`items` so that the items of a group follow each other.',
    );
  }, [splitGroupsKey, component]);
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
      `${component}: \`OptionGroup\` children cannot be windowed: \`virtualWindow\` renders the ` +
        'options of `items` only. Pass the options as `items`, with a `group` on each item that ' +
        'belongs to one (and `renderGroup` for its header).',
    );
  }, [windowGroups, component]);
}
