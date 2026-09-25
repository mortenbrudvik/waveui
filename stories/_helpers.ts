/**
 * Shared Storybook `argTypes` for the Wave prop vocabulary (C-NAMING): `size`, `appearance`,
 * `orientation` and the Badge `appearance`/`color` values.
 *
 * Each entry is checked with `satisfies ArgTypes`, and each `options` list with `satisfies` against
 * the library type it documents, so a value that is not part of the vocabulary fails the dev type
 * check (`tsconfig.dev.json`). Spread them into a story's `argTypes`:
 *
 * @example
 * const meta = {
 *   title: 'Components/Button/Button',
 *   component: Button,
 *   argTypes: { ...appearanceArgType, ...sizeArgType },
 * } satisfies Meta<typeof Button>;
 */
import type { ArgTypes } from '@storybook/react';
import type { Appearance, BadgeAppearance, BadgeColor, Orientation, Size } from '../src';

const sizes = [
  'extra-small',
  'small',
  'medium',
  'large',
  'extra-large',
] as const satisfies readonly Size[];
const appearances = [
  'primary',
  'outline',
  'subtle',
  'transparent',
] as const satisfies readonly Appearance[];
const orientations = ['horizontal', 'vertical'] as const satisfies readonly Orientation[];
const badgeAppearances = [
  'filled',
  'tint',
  'outline',
] as const satisfies readonly BadgeAppearance[];
const badgeColors = [
  'brand',
  'success',
  'warning',
  'danger',
  'important',
  'informative',
  'severe',
  'subtle',
] as const satisfies readonly BadgeColor[];

/** `size` (`Size`): extra-small … extra-large. */
export const sizeArgType = {
  size: { control: 'select', options: sizes },
} satisfies ArgTypes;

/** `appearance` (`Appearance`) of buttons: primary, outline, subtle, transparent. */
export const appearanceArgType = {
  appearance: { control: 'select', options: appearances },
} satisfies ArgTypes;

/** `orientation` (`Orientation`): horizontal or vertical (Divider, RadioGroup, Stack, Stepper, TabList, Toolbar, …). */
export const orientationArgType = {
  orientation: { control: 'inline-radio', options: orientations },
} satisfies ArgTypes;

/** Badge `appearance` (`BadgeAppearance`): filled, tint, outline. */
export const badgeAppearanceArgType = {
  appearance: { control: 'select', options: badgeAppearances },
} satisfies ArgTypes;

/** Badge `color` (`BadgeColor`). */
export const badgeColorArgType = {
  color: { control: 'select', options: badgeColors },
} satisfies ArgTypes;
