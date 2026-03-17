import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';

/** Properties for the ColorPicker component. */
export interface ColorPickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Controlled hex color value (e.g., '#0f6cbd'). */
  value?: string;
  /** Initial hex color for uncontrolled usage.
   * @default '#0f6cbd'
   */
  defaultValue?: string;
  /** Callback fired when the selected color changes. */
  onChange?: (color: string) => void;
  /** Array of preset hex colors displayed as quick-select swatches.
   * @default ['#0f6cbd','#d13438','#107c10','#ffb900','#5c2d91','#008272','#e3008c','#242424']
   */
  presets?: string[];
  /** Whether to show the opacity slider.
   * @default false
   */
  showOpacity?: boolean;
}

const isValidHex = (val: string): boolean => /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(val);

export const ColorPicker = React.forwardRef<HTMLDivElement, ColorPickerProps>(
  (
    {
      value: controlledValue,
      defaultValue = '#0f6cbd',
      onChange,
      presets = [
        '#0f6cbd',
        '#d13438',
        '#107c10',
        '#ffb900',
        '#5c2d91',
        '#008272',
        '#e3008c',
        '#242424',
      ],
      showOpacity = false,
      className,
      ...rest
    },
    ref,
  ) => {
    const [color, setColor] = useControllable(controlledValue, defaultValue, onChange);
    const [inputValue, setInputValue] = React.useState(color);
    const [opacity, setOpacity] = React.useState(100);

    React.useEffect(() => {
      setInputValue(color);
    }, [color]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value;
      if (!val.startsWith('#')) {
        val = '#' + val;
      }
      setInputValue(val);
      if (isValidHex(val)) {
        setColor(val);
      }
    };

    const handleInputBlur = () => {
      if (!isValidHex(inputValue)) {
        setInputValue(color);
      }
    };

    const handlePresetClick = (preset: string) => {
      setColor(preset);
      setInputValue(preset);
    };

    const applyOpacity = (hex: string, opacityValue: number): string => {
      let fullHex = hex;
      if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
        fullHex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
      }
      const alpha = Math.round((opacityValue / 100) * 255)
        .toString(16)
        .padStart(2, '0');
      return fullHex.slice(0, 7) + alpha;
    };

    const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newOpacity = Number(e.target.value);
      setOpacity(newOpacity);
      if (showOpacity) {
        setColor(applyOpacity(color, newOpacity));
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex flex-col gap-3 p-3 bg-background border border-border rounded shadow-4',
          className,
        )}
        {...rest}
      >
        {/* Color preview and hex input */}
        <div className="flex items-center gap-2">
          <div
            className="w-10 h-10 rounded border border-border flex-shrink-0"
            style={{
              backgroundColor: showOpacity ? applyOpacity(color.slice(0, 7), opacity) : color,
            }}
            aria-hidden="true"
          />
          <label className="flex flex-col gap-1">
            <span className="text-caption-1 text-muted-foreground">Hex</span>
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              aria-label="Hex color value"
              maxLength={9}
              className="w-24 px-2 py-1 text-body-1 border border-border rounded bg-background text-foreground focus:outline-none focus:border-primary"
            />
          </label>
        </div>

        {/* Preset swatches */}
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Preset colors">
            {presets.map((preset) => {
              const isSelected = color === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={preset}
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    'w-7 h-7 rounded border-2 transition-all flex-shrink-0',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    isSelected
                      ? 'border-primary shadow-2'
                      : 'border-transparent hover:border-[#c0c0c0]',
                  )}
                  style={{ backgroundColor: preset }}
                />
              );
            })}
          </div>
        )}

        {/* Opacity slider */}
        {showOpacity && (
          <div className="flex items-center gap-2">
            <span className="text-caption-1 text-muted-foreground w-14">Opacity</span>
            <input
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={handleOpacityChange}
              aria-label="Opacity"
              className="flex-1 h-1 accent-primary"
            />
            <span className="text-caption-1 text-muted-foreground w-10 text-right">{opacity}%</span>
          </div>
        )}
      </div>
    );
  },
);

ColorPicker.displayName = 'ColorPicker';
