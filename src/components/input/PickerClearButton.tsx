import * as React from 'react';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { usePreserveFocus } from '../../hooks/usePreserveFocus';

/** Properties of {@link PickerClearButton}: a `<button>`'s, and the element focus falls back to. */
export interface PickerClearButtonProps extends React.ComponentPropsWithRef<'button'> {
  /**
   * The control the button clears (the input or the button of the picker): focus moves to it when
   * the clear button goes away while it has focus. Read when it is needed, so the control may
   * mount or change after the button does.
   */
  fallbackRef: React.RefObject<HTMLElement | null>;
}

/**
 * The clear button of Combobox, Dropdown, DatePicker, TimePicker and SearchBox. The pickers move
 * focus to their control when the user clears the value with this button, but a clear from
 * outside (a parent, a form reset, a timer, Escape in a field of its own) removes the button too,
 * and a button that has keyboard focus takes it to `<body>` with it: this part moves focus to the
 * control instead (`usePreserveFocus`, in the commit that removes the button, as a microtask).
 * Focus that has moved elsewhere by then stays where it is. Internal: the host passes the props
 * of its `clearButton` part and its own `type="button"`.
 */
export function PickerClearButton({ fallbackRef, ref, ...rest }: PickerClearButtonProps) {
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const mergedRef = useMergedRefs<HTMLButtonElement>(buttonRef, ref);
  usePreserveFocus(buttonRef, () => fallbackRef.current);
  // The literal marks C-BUTTON-TYPE; the host's part locks the type.
  return <button type="button" {...rest} ref={mergedRef} />;
}
PickerClearButton.displayName = 'PickerClearButton';
