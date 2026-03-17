// Styles — consumers should import 'waveui/styles' or this CSS file
// import './styles/globals.css';

// Utilities
export { cn } from './lib/cn';
export type * from './lib/types';
export { resolveSlot, renderSlot } from './lib/slot';
export type { Slot, SlotObject } from './lib/slot';

// Hooks
export { useControllable } from './hooks/useControllable';
export { useId } from './hooks/useId';
export { useEventCallback } from './hooks/useEventCallback';
export { useRovingTabIndex } from './hooks/useRovingTabIndex';
export type { UseRovingTabIndexOptions } from './hooks/useRovingTabIndex';

// Provider
export { WaveProvider, useWaveTheme } from './components/provider/WaveProvider';
export type { WaveProviderProps, WaveTheme, WaveDir } from './components/provider/WaveProvider';

// Components — re-exports added as each component directory is populated
export * from './components/button';
export * from './components/input';
export * from './components/data-display';
export * from './components/typography';
export * from './components/layout';
export * from './components/navigation';
export * from './components/feedback';
export * from './components/overlays';
export * from './components/table';
