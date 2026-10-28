import * as React from 'react';
import { warnOnce } from '../../lib/dev';
import { slotRendersContent } from '../../lib/slot';
import {
  ListboxOptionPositionContext,
  type ListboxItem,
  type ListboxOptionPosition,
} from '../../hooks/useListbox';
import { Option, type ListboxOptionRenderState } from './Option';

/*
 * Data mode of Listbox, Combobox and Dropdown (`items`, `renderOption`): the options rendered from
 * the shown items of `useListbox` (its `items`, in order), each keyed by its value and told its
 * position among them. Module-only.
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
  selected: boolean;
  active: boolean;
  renderOption: RenderOption | undefined;
}

/*
 * One option, memoized on its item, position and state: moving the highlight renders the old and
 * the new active option only (with a stable `renderOption`). The position context reaches the
 * option `renderOption` returns, through `useListboxOption`.
 */
function DataOptionImpl({ item, index, setSize, selected, active, renderOption }: DataOptionProps) {
  const position = React.useMemo<ListboxOptionPosition>(
    () => ({ index, setSize }),
    [index, setSize],
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

/**
 * The option of the shown item at `index` (`items` is `useListbox(...).items`, the shown items in
 * order), keyed by its value so its element, and its id, follow the value. Its position is `index`
 * among `items.length` options. A windowed list renders the indexes of its window with it.
 */
export function renderListboxItem(
  items: readonly ListboxItem[],
  index: number,
  state: ListboxItemsState,
): React.ReactElement {
  const item = items[index];
  return (
    <DataOption
      key={item.value}
      item={item}
      index={index}
      setSize={items.length}
      selected={state.selected.has(item.value)}
      active={state.activeValue === item.value}
      renderOption={state.renderOption}
    />
  );
}

/** The options of every shown item, in order (see {@link renderListboxItem}). */
export function renderListboxItems(
  items: readonly ListboxItem[],
  state: ListboxItemsState,
): React.ReactElement[] {
  return items.map((_, index) => renderListboxItem(items, index, state));
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
