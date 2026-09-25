import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { ChevronDownIcon } from '../../lib/icons';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import type { Slot } from '../../lib/slot';
import { disabledStyles, focusRing } from '../../lib/styles';
import { unwrapButtonGlyph } from '../button/Button.slots';
import { PICKER_ICON_BUTTON_CLASSES } from './pickerStyles';

/**
 * Whether an `expandIcon` value shows the expand button (the rule of optional indicator glyphs):
 * `null` and `undefined` keep the chevron; `false` and any other value that renders nothing
 * (`true`, `''`, an empty array or Fragment) hide the button.
 */
export function showsExpandButton(expandIcon: Slot<'span'> | undefined): boolean {
  return expandIcon == null || slotRendersContent(expandIcon);
}

/** Properties of {@link PickerExpandButton}. */
export interface PickerExpandButtonProps {
  /** The picker's public name, used in the development warning. */
  component: string;
  /** The picker's `expandIcon`; render the button only when {@link showsExpandButton} allows. */
  expandIcon: Slot<'span'> | undefined;
  /** The accessible name of the button. */
  label: string;
  /** Whether the list is shown with options (`aria-expanded`). */
  expanded: boolean;
  /** Id of the listbox, referenced by `aria-controls` while the list is expanded. */
  listboxId: string;
  /** Natively disables the button (a disabled or read-only picker). */
  disabled: boolean;
  /** Opens or closes the list and returns focus to the input. */
  onToggle: () => void;
}

/**
 * The expand button of an editable combobox (Combobox, TimePicker): the APG "open" button at the
 * end of the input. It is not a tab stop (Alt+ArrowDown opens the list from the keyboard) and a
 * press keeps focus in the input. Its glyph is decorative (`aria-hidden`) and turns while the list
 * is expanded. A `<button>` or `Button` element passed as `expandIcon`, or a slot object whose
 * `as` is one, is not nested: its children become the glyph (the chevron when they render
 * nothing), its props are dropped and a one-time development warning names the slot.
 */
export const PickerExpandButton = ({
  component,
  expandIcon,
  label,
  expanded,
  listboxId,
  disabled,
  onToggle,
}: PickerExpandButtonProps) => {
  // The glyph slot rule shared with SplitButton and MenuButton `menuIcon` (C-SLOTS).
  const { glyph: content, button } = unwrapButtonGlyph(expandIcon);
  React.useEffect(() => {
    if (button) {
      warnOnce(
        `${component}:expandIcon-button`,
        `${component}: \`expandIcon\` received ${button}; its children render as the glyph of ` +
          'the built-in expand button and its props were dropped (buttons cannot be nested). ' +
          'Pass icon content instead, e.g. `expandIcon={<MyIcon />}`.',
      );
    }
  }, [button, component]);

  const glyph = content != null && slotRendersContent(content) ? content : <ChevronDownIcon />;

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={expanded ? listboxId : undefined}
      disabled={disabled}
      // Keeps focus in the input: a press must not blur it (a blur commits typed text).
      onMouseDown={(event) => event.preventDefault()}
      onClick={onToggle}
      className={cn(PICKER_ICON_BUTTON_CLASSES, 'end-1', focusRing, disabledStyles)}
    >
      {renderSlot(
        glyph,
        'span',
        cn(
          'inline-flex transition-transform motion-reduce:transition-none',
          expanded && 'rotate-180',
        ),
        { 'aria-hidden': true },
      )}
    </button>
  );
};
PickerExpandButton.displayName = 'PickerExpandButton';
