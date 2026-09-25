import { useEffect } from 'react';
import type * as React from 'react';
import { useEventCallback } from './useEventCallback';

/**
 * The form a control belongs to: the form whose id is `formId` (the component's `form` prop), else
 * the control element's own `form` attribute, else the closest ancestor `<form>`. A `form` id that
 * matches no form means "no form" (like the native `form` attribute), not the ancestor form.
 */
function findForm(control: HTMLElement, formId: string | undefined): HTMLFormElement | null {
  const id = formId ?? control.getAttribute('form') ?? undefined;
  if (id !== undefined) {
    const root = control.getRootNode();
    const scope: Pick<Document, 'getElementById'> =
      'getElementById' in root && typeof root.getElementById === 'function'
        ? (root as Document | ShadowRoot)
        : control.ownerDocument;
    const el = scope.getElementById(id);
    return el instanceof HTMLFormElement ? el : null;
  }
  return control.closest('form');
}

/**
 * Resets a value control with its form (C-FORMS, spec §2.5). When the form the control belongs to
 * fires `reset` and no handler cancelled it, `onReset` is called — restore the control's default
 * value there. The form is found **from the control element** (its `form` id, else the closest
 * `<form>`), so uncontrolled controls reset even without a `name`/`HiddenInput`.
 *
 * The listener sits on the control's root node (document or shadow root) and runs in the bubble
 * phase, after the form's own and React's `onReset` handlers, so a reset they cancel is ignored.
 * `onReset` runs synchronously in the `reset` event; the latest callback is always used.
 *
 * @param controlRef The focusable control element (or the component root inside the form).
 * @param onReset    Restores the default value.
 * @param form       The component's `form` prop (id of a form elsewhere in the document).
 *
 * @example
 * useFormReset(buttonRef, () => setValue(defaultValue ?? ''), form);
 */
export function useFormReset(
  controlRef: React.RefObject<HTMLElement | null>,
  onReset: () => void,
  form?: string,
): void {
  const handleReset = useEventCallback(onReset);

  useEffect(() => {
    const control = controlRef.current;
    const root: Node | null =
      control?.getRootNode() ?? (typeof document !== 'undefined' ? document : null);
    if (!root) return;
    const listener = (event: Event) => {
      if (event.defaultPrevented) return;
      const current = controlRef.current;
      if (!current || event.target !== findForm(current, form)) return;
      handleReset();
    };
    root.addEventListener('reset', listener);
    return () => root.removeEventListener('reset', listener);
  }, [controlRef, form, handleReset]);
}
