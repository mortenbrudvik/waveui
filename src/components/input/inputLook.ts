import type { CoreSize, InputAppearance, Size } from '../../lib/types';
import { useFieldContext } from '../../hooks/useFieldControl';
import { useWaveTheme } from '../provider/WaveProvider';

const CORE_SIZES: readonly CoreSize[] = ['small', 'medium', 'large'];
const APPEARANCES: readonly string[] = [
  'outline',
  'underline',
  'filled-darker',
  'filled-lighter',
] satisfies readonly InputAppearance[];

/** Options of {@link useInputLook}. */
export interface InputLookOptions<S extends Size> {
  /**
   * The sizes the control supports; an own, Field or provider size outside them is skipped.
   * @default the three core sizes (`small`, `medium`, `large`)
   */
  sizes?: readonly S[];
  /**
   * The size when nothing else applies. Pass it when `sizes` leaves out `medium`: the fallback is
   * not checked against `sizes`.
   * @default 'medium'
   */
  defaultSize?: S;
}

/**
 * The size and appearance a text control or picker renders (Phase 4 D6): its own props, then the
 * surrounding Field's `size`, then `WaveProvider inputDefaults`, then the defaults (`medium`,
 * `outline`). `undefined` props fall through like absent ones, and so do values outside the
 * unions (from untyped code: plain JS, CMS config, an untyped `inputDefaults`): an own or provider
 * size outside `sizes`, or an appearance other than the four, is skipped, so the returned values
 * (and the `data-size`/`data-appearance` attributes built from them) are always supported ones.
 *
 * @internal Not exported from the package.
 */
export function useInputLook<S extends Size = CoreSize>(
  size: S | undefined,
  appearance: InputAppearance | undefined,
  options: InputLookOptions<S> = {},
): { size: S; appearance: InputAppearance } {
  const field = useFieldContext();
  const { inputDefaults } = useWaveTheme();
  const sizes = (options.sizes ?? CORE_SIZES) as readonly Size[];
  const fits = (candidate: Size | undefined): candidate is S =>
    candidate !== undefined && sizes.includes(candidate);
  const isAppearance = (candidate: unknown): candidate is InputAppearance =>
    typeof candidate === 'string' && APPEARANCES.includes(candidate);
  const resolvedSize =
    (fits(size) ? size : undefined) ??
    (fits(field?.size) ? field.size : undefined) ??
    (fits(inputDefaults.size) ? inputDefaults.size : undefined) ??
    options.defaultSize ??
    ('medium' as S);
  const resolvedAppearance =
    (isAppearance(appearance) ? appearance : undefined) ??
    (isAppearance(inputDefaults.appearance) ? inputDefaults.appearance : undefined) ??
    'outline';
  return { size: resolvedSize, appearance: resolvedAppearance };
}

/**
 * The numeric legacy form of `size` on Input and Select (the native attribute, deprecated in
 * favour of `htmlSize`): a number, or a string of digits only, which untyped code wrote HTML style
 * before 0.9 (`size="20"`). `undefined` for anything else, which `useInputLook` then resolves as a
 * design size.
 *
 * @internal Not exported from the package.
 */
export function legacyNativeSize(size: unknown): number | undefined {
  if (typeof size === 'number') return size;
  return typeof size === 'string' && /^\d+$/.test(size) ? Number(size) : undefined;
}
