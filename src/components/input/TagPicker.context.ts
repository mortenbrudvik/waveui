import * as React from 'react';
import { reportMissingContext } from '../../lib/dev';
import type { CoreSize, InputAppearance, TagAppearance, TagSize } from '../../lib/types';
import type { UseListboxPopupResult } from './Option';
import type { UseListboxResult } from '../../hooks/useListbox';
import type { Slot } from '../../lib/slot';
import type { TagPickerOption } from './TagPicker.option';
import type { TagPickerSize } from './TagPicker.root';

/*
 * The contexts of TagPicker's parts: the root's state (TagPickerContext) and the field the
 * trigger draws in (TagPickerControlContext). Module-only (never exported from a barrel); it
 * imports no component.
 */

/** Which part is the combobox: the text field (`TagPicker.Input`) or a button (`TagPicker.Button`). */
export type TagPickerTriggerKind = 'input' | 'button';

/** The built-in texts, resolved (every member set). */
export interface ResolvedTagPickerLabels {
  remove: (label: string) => string;
  selected: string;
  create: (text: string) => string;
  clear: string;
  expand: string;
  overflowCount: (count: number) => string;
  noMatches: string;
}

/** The attributes the root routes to its trigger part, whichever it is (C-ROUTING). */
export interface TagPickerTriggerProps {
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** The root's and the Field's description (the part joins its own first and the summary last). */
  'aria-describedby'?: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
  'aria-required'?: React.AriaAttributes['aria-required'];
  'aria-errormessage'?: string;
  'aria-details'?: string;
  tabIndex?: number;
  autoFocus?: boolean;
}

/** The root's props that reach `TagPicker.Input` only (its `<input>`). */
export interface TagPickerInputOnlyProps {
  autoComplete?: string;
  autoCapitalize?: string;
  autoCorrect?: string;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  spellCheck?: React.HTMLAttributes<HTMLInputElement>['spellCheck'];
  enterKeyHint?: React.InputHTMLAttributes<HTMLInputElement>['enterKeyHint'];
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>;
  controlRef?: React.Ref<HTMLInputElement>;
}

/** What TagPicker gives its parts. */
export interface TagPickerContextValue {
  /** The resolved size and appearance (the root's `data-size` and `data-appearance`). */
  size: TagPickerSize;
  appearance: InputAppearance;
  /** The size of the end buttons' box and glyph: medium, else large. */
  coreSize: CoreSize;
  /** The tags' size and appearance for the picker's look (D54). */
  tagSize: TagSize;
  tagAppearance: TagAppearance;
  disabled: boolean;
  readOnly: boolean;
  /** Neither disabled nor read-only. */
  interactive: boolean;
  /** Whether the field shows the error look. */
  invalidLook: boolean;
  /** The selected values, in order. */
  selected: readonly string[];
  /** The label of a value: its option's, else the raw value. */
  labelOf: (value: string) => string;
  /** The `options` entry of a value (its label, `media` and `secondaryContent`). */
  entryOf: (value: string) => TagPickerOption | undefined;
  labels: ResolvedTagPickerLabels;
  placeholder: string;
  options: readonly TagPickerOption[];
  /** Whether the default tags warn for selected values without an option (D58's 0.10 configuration). */
  warnsUnknownValues: boolean;
  /** Whether the listbox is in data mode (no `TagPicker.List` children). */
  dataMode: boolean;
  listbox: UseListboxResult;
  /** The popup (open state, list shown with options or the create option). */
  open: boolean;
  expanded: boolean;
  /** The typed text (always `''` while locked). */
  query: string;
  /** The popup surface shows: the list, or "No matches" for typed text. */
  surfaceOpen: boolean;
  /** The create option: shown, its text, its reserved value and its name. */
  showCreate: boolean;
  createText: string;
  createValue: string;
  /** The "No matches" row of the popup, while the open list has text and nothing to show. */
  emptyContent: boolean;
  layerId: string;
  surfaceRef: UseListboxPopupResult['surfaceRef'];
  floatingProps: UseListboxPopupResult['floatingProps'];
  /** The listbox's name: TagPicker's (the List's own pair replaces it). */
  listLabel: { 'aria-label'?: string; 'aria-labelledby'?: string };
  triggerProps: TagPickerTriggerProps;
  inputProps: TagPickerInputOnlyProps;
  /** The summary's id while tags exist (it describes the trigger). */
  summaryId: string | undefined;
  /** The trigger element (the Input or the Button). */
  triggerRef: React.RefObject<HTMLElement | null>;
  /** Places the popup against the Control (as wide as the field): merged into its ref. */
  setReference: (element: HTMLElement | null) => void;
  /** The control element, the tag list and the "+N" chip (the single-line layout measures them). */
  controlRef: React.RefObject<HTMLDivElement | null>;
  groupRef: React.RefObject<HTMLDivElement | null>;
  chipRef: React.RefObject<HTMLSpanElement | null>;
  /** Registers a trigger part from its layout effect; returns the remover. */
  registerTrigger: (kind: TagPickerTriggerKind) => () => void;
  /** Registers a List part from its layout effect; returns the remover. */
  registerList: () => () => void;
  triggerKind: TagPickerTriggerKind;
  setOpen: (open: boolean) => void;
  /** Opens a closed list, closes an open one. */
  toggleOpen: () => void;
  focusTrigger: () => void;
  /** Removes a tag (a dismissal of the tag list, D56); announced. */
  removeTag: (value: string) => void;
  /** Removes every tag, clears the text, closes the list and focuses the trigger (D61). */
  clear: () => void;
  /** A user edit of the input's text: the query, the exact-match ranking and the open state. */
  editText: (text: string) => void;
  /** Focuses the last focusable control of the tag list; `false` when there is none. */
  focusLastTagControl: () => boolean;
  /** The root's `expandIcon` and `clearable`. */
  expandIcon: Slot<'span'> | undefined;
  clearable: boolean;
  /** The single-line layout: the mode, whether it is collapsed, the hidden values and the count. */
  overflow: 'wrap' | 'count';
  collapsed: boolean;
  hiddenValues: ReadonlySet<string> | undefined;
}

/** Internal: read with {@link useTagPickerContext}. `null` outside a TagPicker. */
export const TagPickerContext = React.createContext<TagPickerContextValue | null>(null);
TagPickerContext.displayName = 'TagPickerContext';

/** What `TagPicker.Control` gives its trigger part. */
export interface TagPickerControlContextValue {
  /** Registers the trigger with the root (the kind decides the listbox mode). */
  registerTrigger: (kind: TagPickerTriggerKind) => () => void;
}

/** Internal: read with {@link useTagPickerControlContext}. `null` outside a TagPicker.Control. */
export const TagPickerControlContext = React.createContext<TagPickerControlContextValue | null>(
  null,
);
TagPickerControlContext.displayName = 'TagPickerControlContext';

/**
 * TagPicker's context for one of its parts. Outside a TagPicker it throws in development
 * (`[WaveUI] TagPicker.Control must be used within TagPicker`) and logs once in production,
 * returning `null`: the part then renders nothing.
 *
 * @param part The part's dotted name (`'TagPicker.Control'`).
 */
export function useTagPickerContext(part: string): TagPickerContextValue | null {
  const context = React.useContext(TagPickerContext);
  if (!context) reportMissingContext(part, 'TagPicker');
  return context;
}

/**
 * The context of the field a trigger part draws in, for a part inside a TagPicker (`inPicker`).
 * Outside a TagPicker.Control it throws in development
 * (`[WaveUI] TagPicker.Input must be used within TagPicker.Control`) and logs once in production,
 * returning `null`: the part then renders nothing. Outside a TagPicker the root's check has
 * reported already, so nothing more is reported.
 *
 * @param part     The part's dotted name (`'TagPicker.Input'`).
 * @param inPicker Whether the part has TagPicker's context.
 */
export function useTagPickerControlContext(
  part: string,
  inPicker: boolean,
): TagPickerControlContextValue | null {
  const context = React.useContext(TagPickerControlContext);
  if (!context && inPicker) reportMissingContext(part, 'TagPicker.Control');
  return context;
}
