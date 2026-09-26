import type { CoreSize, InputAppearance, Size } from '../../lib/types';
import { useFieldContext } from '../../hooks/useFieldControl';
import { useWaveTheme } from '../provider/WaveProvider';

const CORE_SIZES: readonly CoreSize[] = ['small', 'medium', 'large'];

/** Options of {@link useInputLook}. */
export interface InputLookOptions<S extends Size> {
  /**
   * The sizes the control supports; a Field or provider size outside them is skipped.
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
 * `outline`). `undefined` props fall through like absent ones.
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
  const resolvedSize =
    size ??
    (fits(field?.size) ? field.size : undefined) ??
    (fits(inputDefaults.size) ? inputDefaults.size : undefined) ??
    options.defaultSize ??
    ('medium' as S);
  return { size: resolvedSize, appearance: appearance ?? inputDefaults.appearance ?? 'outline' };
}
