/**
 * The prop controls of an example: a lazy chunk the example island imports on the first focus or
 * pointer entering the example (`Example.tsx`). One labelled native control per arg that
 * `getControlSpecs` supports (a checkbox, a select, a text or a number field), styled with the
 * site's token classes; no WaveUI part, so the chunk stays a few hundred bytes. Every change calls
 * `onChange` with the whole next args object.
 */
import * as React from 'react';
import { getControlSpecs, type ControlOption, type ControlSpec } from './controlSpecs';

type Args = Record<string, unknown>;

export interface ControlsProps {
  /** The story's merged argTypes. */
  argTypes: Record<string, unknown>;
  /** The args the story renders with now. */
  args: Record<string, unknown>;
  onChange(next: Record<string, unknown>): void;
}

const FIELD =
  'min-h-8 rounded border border-wave-stroke-accessible bg-wave-background px-2 text-wave-body-1 text-wave-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-wave-ring';

/** The `<option>` value of an option, and back. */
const optionKey = (option: ControlOption) => String(option);
const NOT_SET = '';

function Control({
  spec,
  id,
  value,
  unset,
  onValue,
}: {
  spec: ControlSpec;
  id: string;
  value: unknown;
  /** A select of an arg the story leaves unset offers "Not set" first. */
  unset: boolean;
  onValue: (value: unknown) => void;
}) {
  switch (spec.kind) {
    case 'boolean':
      return (
        <input
          id={id}
          type="checkbox"
          className="size-4 accent-wave-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wave-ring"
          checked={value === true}
          onChange={(event) => onValue(event.currentTarget.checked)}
        />
      );
    case 'select': {
      const selected = spec.options.find((option) => option === value);
      return (
        <select
          id={id}
          className={FIELD}
          value={selected === undefined ? NOT_SET : optionKey(selected)}
          onChange={(event) => {
            const key = event.currentTarget.value;
            onValue(spec.options.find((option) => optionKey(option) === key));
          }}
        >
          {unset || selected === undefined ? <option value={NOT_SET}>Not set</option> : null}
          {spec.options.map((option) => (
            <option key={optionKey(option)} value={optionKey(option)}>
              {String(option)}
            </option>
          ))}
        </select>
      );
    }
    case 'number':
      return (
        <input
          id={id}
          type="number"
          className={`${FIELD} w-28`}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={typeof value === 'number' ? value : ''}
          onChange={(event) => {
            const text = event.currentTarget.value;
            const number = Number(text);
            onValue(text === '' || !Number.isFinite(number) ? undefined : number);
          }}
        />
      );
    case 'text':
      return (
        <input
          id={id}
          type="text"
          className={`${FIELD} min-w-0 flex-1`}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onValue(event.currentTarget.value)}
        />
      );
  }
}

/** The prop controls of one example. */
export function Controls({ argTypes, args, onChange }: ControlsProps) {
  const idPrefix = React.useId();
  const specs = React.useMemo(() => getControlSpecs(argTypes, args), [argTypes, args]);
  // The args the story started without keep their "Not set" choice after another is picked.
  const [unsetAtStart] = React.useState(
    () => new Set(Object.keys(argTypes).filter((name) => args[name] === undefined)),
  );

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1 p-0 text-wave-caption-1 font-semibold text-wave-muted-foreground">
        Props
      </legend>
      {specs.map((spec) => {
        const id = `${idPrefix}-${spec.name}`;
        const label = (
          <label htmlFor={id} className="font-wave-mono text-wave-caption-1 text-wave-foreground">
            {spec.name}
          </label>
        );
        const control = (
          <Control
            spec={spec}
            id={id}
            value={args[spec.name]}
            unset={unsetAtStart.has(spec.name)}
            onValue={(value) => onChange({ ...args, [spec.name]: value } satisfies Args)}
          />
        );
        return (
          <div key={spec.name} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {spec.kind === 'boolean' ? (
              <>
                {control}
                {label}
              </>
            ) : (
              <>
                <span className="min-w-28">{label}</span>
                {control}
              </>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}

export default Controls;
