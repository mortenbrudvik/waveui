import { TagPickerRoot } from './TagPicker.root';
import {
  TagPickerButton,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerList,
  TagPickerOptionGroup,
} from './TagPicker.parts';
import { TagPickerOption } from './TagPicker.option';

export type { TagPickerLabels, TagPickerProps, TagPickerSize } from './TagPicker.root';
export type {
  TagPickerButtonProps,
  TagPickerControlProps,
  TagPickerGroupProps,
  TagPickerInputProps,
  TagPickerListProps,
} from './TagPicker.parts';
export type { TagPickerOptionProps } from './TagPicker.option';

/**
 * A multi-select combobox that shows the selected values as removable tags.
 *
 * - **Two forms.** The array form, `<TagPicker options={…} />`, is the parts with their defaults:
 *   `TagPicker.Control` (holding `TagPicker.Group` and `TagPicker.Input`) and `TagPicker.List`.
 *   The parts form replaces only the part you need: your own Tags in `TagPicker.Group` (an
 *   Avatar in each), rich `TagPicker.Option`s in `TagPicker.List`, or `TagPicker.Button`, a
 *   select-only trigger, in place of the Input. Render `TagPicker.Control` and `TagPicker.List`
 *   directly inside TagPicker (a Fragment is fine); without a List the default list is added.
 *   `options` names the values in both forms (`media` and `secondaryContent` show in the default
 *   options, `media` in the default tags too); with a List that has children, its options are
 *   the options, and the options of selected values stay rendered (TagPicker hides them).
 * - **Keyboard.** Typing filters the options (`filter`, by default a case-insensitive match on
 *   `textValue ?? label`); the option whose label equals the typed text becomes active, else the
 *   first match. ArrowDown/ArrowUp move the highlight (`aria-activedescendant`), Enter adds the
 *   active option and keeps the list open (with nothing active, Enter is left to the surrounding
 *   form), Escape closes the list (and then clears the typed text). Backspace in the empty input,
 *   and Left (Right in RTL) with the caret at its start, focus the last tag; Delete, Backspace,
 *   Enter or Space on a remove button remove its tag and focus the next tag, else the input; a
 *   click on one focuses the input. Additions and removals are announced ("Cherry removed, 2
 *   selected"), and so is "No matches" for text that matches no option.
 * - **Free tagging.** With `allowCreate`, text that matches no option label, no selected value
 *   (ignoring case) and no option value ends the list with a create option (`Create "infra"`);
 *   Enter on it or a click adds the text as a tag after `onOptionCreate(text)` and clears the
 *   text.
 * - **End buttons.** A chevron (`expandIcon`, `false` hides it) opens and closes the list without
 *   taking focus; `clearable` adds a clear button, a Tab stop after the input, which removes every
 *   tag. A press on the field's empty area toggles the list.
 * - **One line.** `overflow="count"` keeps the tags on one line while focus is outside the picker
 *   and its list is closed; the tags that do not fit give way to "+N".
 * - **Names.** The tags form a list named "Selected"; the trigger is described by a summary of the
 *   selected labels ("Selected: Apple, Banana"). These built-in texts are English; `labels`
 *   localizes them.
 * - **Routing.** The trigger (`TagPicker.Input` or `TagPicker.Button`) receives `id`,
 *   `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-required`,
 *   `aria-errormessage`, `aria-details`, `tabIndex` and `autoFocus`; the Input also
 *   `onFocus`/`onBlur`/`onKeyDown`/`onKeyUp`, `controlRef` and the text input attributes
 *   `autoComplete`, `autoCapitalize`, `autoCorrect`, `maxLength`, `inputMode`, `spellCheck` and
 *   `enterKeyHint` (with the Button, pass handlers and `ref` on it). `ref`, `className`, `style`,
 *   other `aria-*` attributes and the remaining props stay on the root `<div>`. Inside a `Field`
 *   the trigger is labelled and described by it; the field shows the error look whenever the
 *   trigger ends up `aria-invalid`. With `name`/`required` the values take part in form
 *   submission, validation and reset. Selected values without a matching option show their raw
 *   value.
 * - **Size and appearance**: `size` resolves from its own prop, then the surrounding `Field`'s
 *   `size`, then `WaveProvider inputDefaults.size`, else `'medium'` (a Field or provider `small`
 *   gives `'medium'` too, since TagPicker has no `small`); `appearance` from its own prop, then
 *   `WaveProvider inputDefaults.appearance`, else `'outline'`; both render as `data-size` and
 *   `data-appearance` on the root `<div>`, and the parts take neither. The tags are one Tag size
 *   smaller. The option list keeps its size.
 * - **Server rendering.** The open list renders only in the browser: an open list (`defaultOpen`,
 *   `open`) is closed in the server HTML and opens once the picker has hydrated; the tags of
 *   registered options show their labels in the server HTML.
 *
 * Fluent's `selectedOptions` and `onOptionSelect` are `value` and `onValueChange` (plus
 * `onOptionCreate`). `TagPickerOption` is both the type of an `options` entry and the flat name of
 * `TagPicker.Option`.
 *
 * @example
 * <TagPicker aria-label="Fruits" options={[{ value: 'apple', label: 'Apple' }]} clearable />
 *
 * @example
 * <TagPicker aria-label="People" value={people} onValueChange={setPeople}>
 *   <TagPicker.Control>
 *     <TagPicker.Group>
 *       {people.map((id) => (
 *         <Tag key={id} value={id} media={<Avatar name={nameOf(id)} />} dismissLabel="Remove">
 *           {nameOf(id)}
 *         </Tag>
 *       ))}
 *     </TagPicker.Group>
 *     <TagPicker.Input />
 *   </TagPicker.Control>
 *   <TagPicker.List>
 *     <TagPicker.Option value="katri" label="Katri Athokas" secondaryContent="Designer">
 *       Katri Athokas
 *     </TagPicker.Option>
 *   </TagPicker.List>
 * </TagPicker>
 */
export const TagPicker = /* @__PURE__ */ Object.assign(TagPickerRoot, {
  Control: TagPickerControl,
  Group: TagPickerGroup,
  Input: TagPickerInput,
  Button: TagPickerButton,
  List: TagPickerList,
  Option: TagPickerOption,
  OptionGroup: TagPickerOptionGroup,
});

export {
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerButton,
  TagPickerList,
  // The component (`TagPicker.Option`) and the interface of an `options` entry, one name (D64).
  TagPickerOption,
  TagPickerOptionGroup,
};
