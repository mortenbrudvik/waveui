import * as React from 'react';
import { cn } from '../../lib/cn';

/** Supported visual themes for the Wave design system. */
export type WaveTheme = 'light' | 'dark' | 'high-contrast';

/** Text direction for bidirectional layout support. */
export type WaveDir = 'ltr' | 'rtl';

/** Props accepted by {@link WaveProvider}. */
export interface WaveProviderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Visual theme applied to the subtree.
   * @default 'light'
   */
  theme?: WaveTheme;
  /**
   * Text direction for the subtree.
   * @default 'ltr'
   */
  dir?: WaveDir;
  /** Content rendered inside the themed container. */
  children: React.ReactNode;
}

/** Internal context value shape for theme and direction. */
interface WaveContextValue {
  /** The active theme. */
  theme: WaveTheme;
  /** The active text direction. */
  dir: WaveDir;
}

const WaveContext = React.createContext<WaveContextValue>({
  theme: 'light',
  dir: 'ltr',
});

/**
 * Hook to read the current Wave theme and direction from context.
 *
 * @returns The current {@link WaveTheme} and {@link WaveDir} from the nearest {@link WaveProvider}.
 */
export function useWaveTheme(): WaveContextValue {
  return React.useContext(WaveContext);
}

const themeClassMap: Record<WaveTheme, string> = {
  light: '',
  dark: 'dark',
  'high-contrast': 'high-contrast',
};

/**
 * WaveProvider wraps an application (or subtree) to apply Wave UI theming.
 *
 * - Sets the appropriate CSS class (`dark`, `high-contrast`, or none for light)
 *   on a wrapper `<div>` so that CSS custom properties from `tokens.css` take effect.
 * - Provides theme and dir values via React context for components that need them.
 */
export const WaveProvider = ({ theme = 'light', dir = 'ltr', children, className, ref, ...rest }: WaveProviderProps & { ref?: React.Ref<HTMLDivElement> }) => {
    if (process.env.NODE_ENV !== 'production') {
      if (theme && !themeClassMap[theme as keyof typeof themeClassMap]) {
        console.warn(
          `WaveProvider: unknown theme "${theme}". Valid themes: ${Object.keys(themeClassMap).join(', ')}`,
        );
      }
    }

    const value = React.useMemo(() => ({ theme, dir }), [theme, dir]);

    return (
      <WaveContext.Provider value={value}>
        <div ref={ref} dir={dir} className={cn(themeClassMap[theme], className)} {...rest}>
          {children}
        </div>
      </WaveContext.Provider>
    );
  };

WaveProvider.displayName = 'WaveProvider';
