// @mortenbrudvik/waveui: the public entry point.
//
// This module imports no CSS. Import the precompiled stylesheet once in your app and wrap it in
// <WaveProvider> (the stylesheet scopes its base styles and native-element reset to it):
//   import '@mortenbrudvik/waveui/styles';
// Tailwind CSS 4 projects instead add `@import '@mortenbrudvik/waveui/tailwind';` to their own CSS
// entry, and never import './styles' as well.

// Utilities
export { cn } from './lib/cn';
export type * from './lib/types';
export { resolveSlot, renderSlot } from './lib/slot';
export type { Slot, SlotObject, ResolvedSlot } from './lib/slot';
export { composeEventHandlers } from './lib/composeEventHandlers';
export { mergeRefs } from './lib/mergeRefs';

// Hooks
export { useControllable } from './hooks/useControllable';
export type { SetValue } from './hooks/useControllable';
export { useId } from './hooks/useId';
export { useEventCallback } from './hooks/useEventCallback';
export { useRovingTabIndex } from './hooks/useRovingTabIndex';
export type {
  UseRovingTabIndexOptions,
  UseRovingTabIndexResult,
  RovingContainerProps,
} from './hooks/useRovingTabIndex';
export { useMergedRefs } from './hooks/useMergedRefs';
export { useIsClient } from './hooks/useIsClient';
export { useFieldControl } from './hooks/useFieldControl';
export type {
  FieldContextValue,
  FieldControlProps,
  UseFieldControlOptions,
} from './hooks/useFieldControl';
export { useAnnounce, announce } from './hooks/useAnnounce';
export type { Politeness } from './hooks/useAnnounce';

// Provider
export { WaveProvider, useWaveTheme, getThemeClassName } from './components/provider/WaveProvider';
export type {
  WaveProviderProps,
  WaveTheme,
  WaveDir,
  WaveContextValue,
} from './components/provider/WaveProvider';

// Portal
export { Portal } from './components/portal/Portal';
export type { PortalProps } from './components/portal/Portal';

// Components
export * from './components/button';
export * from './components/input';
export * from './components/data-display';
export * from './components/typography';
export * from './components/layout';
export * from './components/navigation';
export * from './components/feedback';
export * from './components/overlays';
export * from './components/table';
