/**
 * Helpers of the option-group tests (Listbox, Combobox and Dropdown with `items` that have a
 * `group`, windowed or not): a data set of groups, the stubs of a listbox whose content is a
 * column of rows inside group elements, and readers of the rendered structure.
 */
import { vi } from 'vitest';
import type { ListboxItem } from '../../../hooks/useListbox';
import { installWindowStubs } from './windowHarness';

export const GROUP_COUNT = 100;
export const PER_GROUP = 50;

/** 100 groups of 50 items: `Group 0` … `Group 99`, values `g0-0` … `g99-49`. */
export const GROUPED_ITEMS: readonly ListboxItem[] = Array.from(
  { length: GROUP_COUNT * PER_GROUP },
  (_, i) => {
    const group = Math.floor(i / PER_GROUP);
    return { value: `g${group}-${i % PER_GROUP}`, label: `Item ${i}`, group: `Group ${group}` };
  },
);

/** A small list: two groups around an ungrouped option, and a disabled option. */
export const SMALL_ITEMS: readonly ListboxItem[] = [
  { value: 'apple', label: 'Apple', group: 'Fruit' },
  { value: 'banana', label: 'Banana', group: 'Fruit', disabled: true },
  { value: 'cherry', label: 'Cherry', group: 'Fruit' },
  { value: 'water', label: 'Water' },
  { value: 'carrot', label: 'Carrot', group: 'Vegetables' },
  { value: 'leek', label: 'Leek', group: 'Vegetables' },
];

/**
 * Stubs for one test (undo them with `vi.restoreAllMocks()`): the animation frames of the window
 * and the geometry of a listbox (`clientHeight` 250, `scrollHeight` the sum of the inline heights
 * of its rows and spacers, wherever they sit: rows are inside group elements).
 */
export function installGroupStubs(): void {
  installWindowStubs();
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
    if (this.getAttribute('role') !== 'listbox') return 0;
    let height = 0;
    this.querySelectorAll<HTMLElement>(
      '[role="option"], [data-group-header], [data-virtual-spacer]',
    ).forEach((row) => {
      height += Number.parseFloat(row.style.height) || 0;
    });
    return height;
  });
}

/** The group elements of `list` (`<ul role="group">`), in DOM order. */
export function groupLists(list: Element): HTMLElement[] {
  return Array.from(list.querySelectorAll<HTMLElement>('[role="group"]'));
}

/** The names of the group lists of `list`, in DOM order. */
export function groupNames(list: Element): (string | null)[] {
  return groupLists(list).map((group) => group.getAttribute('aria-label'));
}

/** The text of the group headers rendered in `list`, in DOM order. */
export function headerTexts(list: Element): string[] {
  return Array.from(list.querySelectorAll('[data-group-header]'), (el) => el.textContent ?? '');
}

/** The labels of the options rendered in `list`, in DOM order. */
export function optionLabels(list: Element): string[] {
  return Array.from(list.querySelectorAll('[role="option"]'), (el) => el.textContent ?? '');
}

/** The option the list or combobox `aria-activedescendant` points at, in `root`. */
export function activeOptionOf(owner: Element): HTMLElement | null {
  const id = owner.getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}
