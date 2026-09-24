import * as React from 'react';
import { joinIds } from '../lib/aria';
import { useId } from './useId';

/**
 * What a `Field` tells the control inside it (spec §2.5, §5.1). `Field` (P02) provides it; every
 * library input reads it through {@link useFieldControl}.
 */
export interface FieldContextValue {
  /** The id the Field's `<label htmlFor>` points at. */
  controlId: string;
  /** The id of the Field's `<label>`, used for `aria-labelledby` on non-labelable controls. */
  labelId: string | undefined;
  /** The id of the rendered hint, if any. */
  hintId: string | undefined;
  /** The id of the rendered error message, if any. */
  errorId: string | undefined;
  /** Whether the Field is in an error state. */
  invalid: boolean;
  /** Whether the Field is required. */
  required: boolean;
  /** Field renders the error message itself; controls with their own `error` must not repeat it. */
  hasErrorMessage: boolean;
  /**
   * Field already gave `controlId` to its first child, a label-for merge target (component,
   * labelable element, custom element), whether Field merged it or it was the child's own id; a
   * control that receives no `id` prop is then not that child (it is nested inside it, e.g.
   * `Field > Tooltip > Input`, or a later sibling) and must not reuse `controlId`.
   * {@link useFieldControl} gives such a control its own id and names it through
   * `aria-labelledby`. Absent or `false`: a control without an `id` uses `controlId`, subject to
   * `controlIdClaim`.
   */
  controlIdAssigned?: boolean;
  /**
   * Hands `controlId` to one control when `controlIdAssigned` is not set — Field left its first
   * child alone (a plain `<div>`, a Fragment), so every library control inside reads this context.
   * The first control without an `id` of its own takes `controlId`; the others get their own id
   * and are named through `aria-labelledby`, so no id is duplicated. `Field` provides one
   * ({@link createFieldControlIdClaim}). Absent: every control without an `id` uses `controlId`.
   */
  controlIdClaim?: FieldControlIdClaim;
}

/**
 * Decides which control inside a `Field` takes the Field's `controlId` (the id its
 * `<label htmlFor>` points at) when several library controls without an `id` of their own read
 * the same context. Create one per Field with {@link createFieldControlIdClaim} and pass it as
 * {@link FieldContextValue.controlIdClaim}; {@link useFieldControl} calls the methods.
 *
 * - The first control to render takes `controlId`: on the first render (and on the server, so
 *   hydration matches) that is the first one in document order. It keeps it across re-renders.
 * - When the holder unmounts or stops wanting `controlId` (it gets an `id` of its own), the
 *   subscribers are notified, re-render, and the first of them takes `controlId` over.
 * - A render that claimed `controlId` but never committed (a discarded concurrent render) does not
 *   keep it: a mounted control that renders without `controlId` frees it.
 */
export interface FieldControlIdClaim {
  /**
   * During render, with the control's stable token (its `useId`): gives `controlId` to `token`
   * when no control holds it, and returns whether `token` holds it. Idempotent per token, so
   * StrictMode double renders and later re-renders agree.
   */
  claim(token: string): boolean;
  /**
   * From a layout effect while the control wants `controlId`: marks `token` mounted. The returned
   * cleanup frees `controlId` when `token` holds it and notifies the subscribers.
   */
  mount(token: string): () => void;
  /**
   * From a layout effect of the control that rendered with `controlId`: takes it again after a
   * StrictMode effect replay freed it; if another control took it meanwhile, notifies the
   * subscribers so both re-render and agree.
   */
  hold(token: string): void;
  /**
   * From a passive effect of a mounted control that rendered without `controlId`: frees
   * `controlId` when its holder is not mounted (its render was discarded) and notifies the
   * subscribers.
   */
  releaseStale(): void;
  /** Subscribes to changes of the holder (for `useSyncExternalStore`); returns the unsubscribe. */
  subscribe(onChange: () => void): () => void;
  /** A number that changes whenever the subscribers are notified (the store snapshot). */
  getVersion(): number;
}

class FieldControlIdClaimStore implements FieldControlIdClaim {
  private holder: string | undefined = undefined;
  private readonly mounted = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private version = 0;

  claim = (token: string): boolean => {
    if (this.holder === undefined) this.holder = token;
    return this.holder === token;
  };

  mount = (token: string): (() => void) => {
    this.mounted.add(token);
    return () => {
      this.mounted.delete(token);
      if (this.holder === token) this.free();
    };
  };

  hold = (token: string): void => {
    if (this.holder === undefined) this.holder = token;
    else if (this.holder !== token) this.notify();
  };

  releaseStale = (): void => {
    if (this.holder !== undefined && !this.mounted.has(this.holder)) this.free();
  };

  subscribe = (onChange: () => void): (() => void) => {
    this.listeners.add(onChange);
    return () => {
      this.listeners.delete(onChange);
    };
  };

  getVersion = (): number => this.version;

  private free(): void {
    this.holder = undefined;
    this.notify();
  }

  private notify(): void {
    this.version += 1;
    for (const listener of Array.from(this.listeners)) listener();
  }
}

/**
 * Creates the {@link FieldControlIdClaim} a Field puts into its context (one per Field instance,
 * e.g. `const [claim] = useState(createFieldControlIdClaim)`).
 */
export function createFieldControlIdClaim(): FieldControlIdClaim {
  return new FieldControlIdClaimStore();
}

const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? React.useLayoutEffect : React.useEffect;

const subscribeNothing = (): (() => void) => () => {};
const noVersion = (): number => 0;

/**
 * Context provided by `Field`. `null` outside a Field (controls then use only their own props).
 */
export const FieldContext: React.Context<FieldContextValue | null> =
  React.createContext<FieldContextValue | null>(null);
FieldContext.displayName = 'FieldContext';

/** The surrounding Field's context value, or `null` when the control is not inside a Field. */
export function useFieldContext(): FieldContextValue | null {
  return React.useContext(FieldContext);
}

/** The labelling/validation props a control receives from its consumer and from its Field. */
export interface FieldControlProps {
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
  'aria-required'?: React.AriaAttributes['aria-required'];
  required?: boolean;
}

/** Options of {@link useFieldControl}. */
export interface UseFieldControlOptions {
  /**
   * Whether the focusable element can be the target of `<label htmlFor>` (`<input>`, `<button>`,
   * `<select>`, `<textarea>`). Non-labelable controls (`role="radiogroup"`/`role="group"` divs)
   * are named with `aria-labelledby` instead.
   * @default true
   */
  labelable?: boolean;
  /**
   * Whether the focusable element is a native form control (Input, Select, Textarea, Slider,
   * SpinButton's input), so the Field's `required` becomes the native `required` attribute and
   * constraint validation runs. Controls built on buttons or divs validate through `HiddenInput`.
   * @default false
   */
  nativeRequired?: boolean;
}

/**
 * Merges a control's own labelling props with its surrounding `Field` (spec §2.5). Spread the
 * result onto the **focusable element** (C-ROUTING). Consumer values are merged, never overwritten,
 * and only defined keys are returned, so spreading never clears an attribute.
 *
 * - `id`: the consumer's id; else, when the Field already gave `controlId` to its first child
 *   (`controlIdAssigned`) — so this control is nested inside that child or a later sibling — a
 *   generated id of its own; else the Field's `controlId`, which only one control takes when the
 *   Field provides a `controlIdClaim` (several controls inside a plain `<div>`: the first one
 *   takes it, the others get a generated id of their own). The first child itself receives
 *   `controlId` as its `id` prop from Field, so it keeps it.
 * - `aria-labelledby`: when the consumer set an `aria-label`, only the consumer's
 *   `aria-labelledby`; otherwise, when the control is not labelable **or** its id is not the
 *   Field's `controlId` (it carries its own id, or is not the Field's first child, so
 *   `<label htmlFor>` does not reach it), the consumer's ids plus the Field's `labelId`.
 * - `aria-describedby`: the consumer's ids, then the Field's error and hint ids (deduplicated).
 * - `aria-invalid` / `aria-required`: the consumer's value, else `true` when the Field is
 *   invalid/required (`aria-required`: not when the consumer passes `required={false}`).
 * - `required`: only with `nativeRequired` — the consumer's value, else the Field's `required`.
 * - `aria-label`: passed through.
 *
 * @example
 * const fieldProps = useFieldControl({ id, 'aria-label': ariaLabel, 'aria-labelledby': labelledBy,
 *   'aria-describedby': describedBy, 'aria-invalid': ariaInvalid, 'aria-required': ariaRequired });
 * return <button role="switch" {...fieldProps} />;
 */
export function useFieldControl(
  props: FieldControlProps,
  options: UseFieldControlOptions = {},
): FieldControlProps {
  const field = useFieldContext();
  // Always called (stable hook order); used only when the Field's controlId is taken. It is also
  // the control's token in the Field's controlIdClaim.
  const fallbackId = useId('field-control');
  const { labelable = true, nativeRequired = false } = options;

  // A control without an id of its own wants the Field's controlId unless Field gave it to its
  // first child. With a claim, only the first such control takes it.
  const wantsControlId = field !== null && props.id === undefined && !field.controlIdAssigned;
  const claim = wantsControlId ? field.controlIdClaim : undefined;
  // Re-render when the controlId is freed, so the next control takes it over.
  React.useSyncExternalStore(
    claim ? claim.subscribe : subscribeNothing,
    claim ? claim.getVersion : noVersion,
    claim ? claim.getVersion : noVersion,
  );
  const holdsControlId = wantsControlId && (claim ? claim.claim(fallbackId) : true);
  useIsomorphicLayoutEffect(() => claim?.mount(fallbackId), [claim, fallbackId]);
  useIsomorphicLayoutEffect(() => {
    if (claim && holdsControlId) claim.hold(fallbackId);
  }, [claim, holdsControlId, fallbackId]);
  // After every commit (all layout effects of the commit, and so every mount, have run): a
  // control rendered without controlId frees one held by a render that never committed.
  React.useEffect(() => {
    if (claim && !holdsControlId) claim.releaseStale();
  });

  const id =
    props.id ?? (field === null ? undefined : holdsControlId ? field.controlId : fallbackId);

  let labelledBy = props['aria-labelledby'];
  if (field && props['aria-label'] === undefined && (!labelable || id !== field.controlId)) {
    labelledBy = joinIds(labelledBy, field.labelId);
  }

  const describedBy = field
    ? joinIds(props['aria-describedby'], field.errorId, field.hintId)
    : props['aria-describedby'];
  const invalid = props['aria-invalid'] ?? (field?.invalid || undefined);
  // A consumer `required={false}` (native controls pass `required`) also keeps the Field's
  // required state out of aria-required, so the announced state matches native validation.
  const ariaRequired =
    props['aria-required'] ?? (props.required === false ? undefined : field?.required || undefined);
  const required = nativeRequired ? (props.required ?? (field?.required || undefined)) : undefined;

  const result: FieldControlProps = {};
  if (id !== undefined) result.id = id;
  if (props['aria-label'] !== undefined) result['aria-label'] = props['aria-label'];
  if (labelledBy !== undefined) result['aria-labelledby'] = labelledBy;
  if (describedBy !== undefined) result['aria-describedby'] = describedBy;
  if (invalid !== undefined) result['aria-invalid'] = invalid;
  if (ariaRequired !== undefined) result['aria-required'] = ariaRequired;
  if (required !== undefined) result.required = required;
  return result;
}
