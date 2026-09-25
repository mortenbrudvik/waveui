import * as React from 'react';
import type { CheckedValuesApi } from '../../hooks/useCheckedValues';
import { isDev, reportMissingContext, warnOnce } from '../../lib/dev';
import type { Orientation, Size } from '../../lib/types';

/*
 * The context a Toolbar gives its parts (`Toolbar.Button`, `Toolbar.ToggleButton`, …): the
 * orientation, the default size and the checked-values state. Internal; imports no component.
 */

/** What a Toolbar shares with its parts. */
export interface ToolbarContextValue {
  /** The toolbar's orientation (the arrow-key axis and the layout direction of groups). */
  orientation: Orientation;
  /** The default size of `Toolbar.Button`, `Toolbar.ToggleButton` and `Toolbar.RadioButton`. */
  size: Size;
  /** The pressed toggles and checked radios, per group `name`. */
  checked: CheckedValuesApi;
  /**
   * Development only (a no-op in production): a toggle or radio button registers its
   * `name`/`value` from an effect and unregisters on cleanup; a second registration of the same
   * pair in one toolbar warns once (`Toolbar:duplicate-value`), since both would show as pressed.
   */
  registerCheckable: (name: string, value: string) => () => void;
}

export const ToolbarContext = React.createContext<ToolbarContextValue | null>(null);
ToolbarContext.displayName = 'ToolbarContext';

const noop = () => {};

/** The context a misplaced part renders with in production (C-CONTEXT). */
const INERT_TOOLBAR_CONTEXT: ToolbarContextValue = {
  orientation: 'horizontal',
  size: 'medium',
  checked: {
    values: Object.freeze({}),
    isChecked: () => false,
    toggle: noop,
    select: noop,
  },
  registerCheckable: () => noop,
};

/** C-CONTEXT: throws in development, logs once and returns an inert value in production. */
export function useToolbarContext(componentName: string): ToolbarContextValue {
  const context = React.useContext(ToolbarContext);
  if (context) return context;
  reportMissingContext(componentName, 'Toolbar');
  return INERT_TOOLBAR_CONTEXT;
}

/**
 * The `registerCheckable` of one toolbar: a count per `name`/`value` pair, kept for the toolbar's
 * lifetime. A second registration of a pair warns once (development only).
 */
export function useToolbarCheckableRegistry(): ToolbarContextValue['registerCheckable'] {
  const [counts] = React.useState(() => new Map<string, number>());
  return React.useCallback(
    (name: string, value: string) => {
      if (!isDev) return noop;
      const key = JSON.stringify([name, value]);
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      if (count > 1) {
        warnOnce(
          'Toolbar:duplicate-value',
          `Toolbar: two toggle or radio buttons of one toolbar have the name "${name}" and the value "${value}", so both show as pressed. Give every part of a group its own value.`,
        );
      }
      return () => {
        const remaining = (counts.get(key) ?? 1) - 1;
        if (remaining > 0) counts.set(key, remaining);
        else counts.delete(key);
      };
    },
    [counts],
  );
}
