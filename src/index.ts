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
export type { DismissReason, LayerKind } from './lib/layers';
export * from './lib/classNames';
export { addDays, addMonths, isSameDay, startOfWeek, getWeekNumber } from './lib/date';
export type { GetWeekNumberOptions } from './lib/date';
export { hsvToHex, hexToHsv } from './lib/color';
export { getInitials } from './lib/initials';
export type { GetInitialsOptions } from './lib/initials';
export {
  partitionBreadcrumbItems,
  truncateBreadcrumbLongName,
  truncateBreadcrumbLongTooltip,
  isTruncatableBreadcrumbContent,
} from './lib/breadcrumb';
export type {
  PartitionBreadcrumbItemsOptions,
  PartitionBreadcrumbItemsResult,
} from './lib/breadcrumb';
export { createToaster } from './lib/toaster';
export type { ToasterHandle } from './lib/toaster';

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
  FieldControlIdClaim,
  FieldControlProps,
  UseFieldControlOptions,
} from './hooks/useFieldControl';
export { useAnnounce, announce } from './hooks/useAnnounce';
export type { Politeness } from './hooks/useAnnounce';
export { usePresence } from './hooks/usePresence';
export type {
  PresencePhase,
  PresenceAttributes,
  UsePresenceOptions,
  UsePresenceResult,
} from './hooks/usePresence';
export { useActiveDescendant } from './hooks/useActiveDescendant';
export type {
  UseActiveDescendantOptions,
  UseActiveDescendantResult,
} from './hooks/useActiveDescendant';
export {
  useListbox,
  useListboxOption,
  collectOptionLabels,
  markListboxElement,
} from './hooks/useListbox';
export type {
  ListboxItem,
  ListboxOpenChangeReason,
  ListboxSelectDetails,
  UseListboxOptions,
  UseListboxResult,
  ListboxComboboxProps,
  ListboxListProps,
  ListboxStore,
  ListboxContextValue,
  UseListboxOptionProps,
  ListboxOptionElementProps,
  UseListboxOptionResult,
  ListboxElementKind,
} from './hooks/useListbox';

// Overlay and focus primitives
export { usePopupPosition } from './hooks/usePopupPosition';
export type {
  UsePopupPositionOptions,
  UsePopupPositionResult,
  PositionedInfo,
} from './hooks/usePopupPosition';
export { useDismiss, DismissLayerProvider } from './hooks/useDismiss';
export type { UseDismissOptions, DismissLayer } from './hooks/useDismiss';
export { useModalLayer } from './hooks/useModalLayer';
export type { UseModalLayerOptions } from './hooks/useModalLayer';
export { useFocusTrap, useInitialFocus } from './hooks/useFocusTrap';
export type { UseFocusTrapOptions, UseInitialFocusOptions } from './hooks/useFocusTrap';
export { useRestoreFocus } from './hooks/useRestoreFocus';
export type { UseRestoreFocusOptions } from './hooks/useRestoreFocus';
export { useModalOpen } from './hooks/useModalOpen';
export { useFocusVisible } from './hooks/useFocusVisible';
export { useFocusableGroup } from './hooks/useFocusableGroup';
export type {
  FocusableGroupProps,
  FocusableGroupTabBehavior,
  UseFocusableGroupOptions,
  UseFocusableGroupResult,
} from './hooks/useFocusableGroup';
export { useGridNavigation } from './components/table/useGridNavigation';
export type {
  UseGridNavigationOptions,
  UseGridNavigationResult,
  GridNavigationHandlers,
} from './components/table/useGridNavigation';
export { getTabbableElements, getFirstTabbable, getLastTabbable } from './lib/focus';
export { focusRing, focusRingInset, inputFocus, inputFocusWithin } from './lib/styles';
export { hasOpenModal, modalAllowProps } from './lib/layers';

// Provider
export { WaveProvider, useWaveTheme, getThemeClassName } from './components/provider/WaveProvider';
export type {
  WaveProviderProps,
  WaveTheme,
  WaveDir,
  WaveContextValue,
  InputDefaults,
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
export * from './components/motion';
