import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Field, useId, useMergedRefs } from '../src';
import { Listbox, type ListboxProps } from '../src/components/input/Listbox';
import { ListboxSurface, Option, useListboxPopup } from '../src/components/input/Option';
import { useActiveDescendant } from '../src/hooks/useActiveDescendant';
import { useListbox } from '../src/hooks/useListbox';

const meta = {
  title: 'Components/Input/Listbox',
  component: Listbox,
  argTypes: {
    disabled: { control: 'boolean' },
    disabledOptionsFocusable: { control: 'boolean' },
  },
  args: {
    'aria-label': 'Fruit',
    onValueChange: fn(),
    style: { width: 220 },
  },
} satisfies Meta<typeof Listbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultValue: 'banana',
  },
  render: (args) => (
    <Listbox {...args}>
      <Listbox.Option value="apple">Apple</Listbox.Option>
      <Listbox.Option value="banana">Banana</Listbox.Option>
      <Listbox.Option value="cherry">Cherry</Listbox.Option>
      <Listbox.Option value="date">Date</Listbox.Option>
    </Listbox>
  ),
};

/** `multiselect` selects several options: a checkbox per option, and every toggle is announced. */
export const Multiselect: StoryObj<ListboxProps<true>> = {
  args: {
    'aria-label': 'Fruits',
    multiselect: true,
    defaultValue: ['banana'],
  },
  // The spread alone leaves `multiselect` optional (StoryObj widens `args`), which satisfies
  // neither call signature (D9): the literal attribute after it forces the multi-select one.
  render: (args) => (
    <Listbox {...args} multiselect>
      <Listbox.Option value="apple">Apple</Listbox.Option>
      <Listbox.Option value="banana">Banana</Listbox.Option>
      <Listbox.Option value="cherry">Cherry</Listbox.Option>
      <Listbox.Option value="date">Date</Listbox.Option>
    </Listbox>
  ),
};

export const Groups: Story = {
  args: {
    'aria-label': 'Animal',
  },
  render: (args) => (
    <Listbox {...args} className="max-h-56">
      <Listbox.OptionGroup label="Mammals">
        <Listbox.Option value="cat">Cat</Listbox.Option>
        <Listbox.Option value="dog">Dog</Listbox.Option>
        <Listbox.Option value="horse">Horse</Listbox.Option>
      </Listbox.OptionGroup>
      <Listbox.OptionGroup label="Fish">
        <Listbox.Option value="goldfish">Goldfish</Listbox.Option>
        <Listbox.Option value="salmon">Salmon</Listbox.Option>
        <Listbox.Option value="shark" disabled>
          Shark (not available)
        </Listbox.Option>
      </Listbox.OptionGroup>
    </Listbox>
  ),
};

/**
 * `disabledOptionsFocusable` keeps disabled options in the arrow-key order (they still cannot be
 * selected), unlike the default, which skips them.
 */
export const DisabledOptions: Story = {
  args: {
    'aria-label': 'Animal',
    disabledOptionsFocusable: true,
  },
  render: (args) => (
    <Listbox {...args}>
      <Listbox.Option value="cat">Cat</Listbox.Option>
      <Listbox.Option value="dog" disabled>
        Dog (not available)
      </Listbox.Option>
      <Listbox.Option value="fish">Fish</Listbox.Option>
    </Listbox>
  ),
};

/** Named by a Field label instead of `aria-label`. */
export const InField: Story = {
  args: {
    'aria-label': undefined,
  },
  render: (args) => (
    <Field label="Fruit" hint="Pick your favorite." required>
      <Listbox {...args}>
        <Listbox.Option value="apple">Apple</Listbox.Option>
        <Listbox.Option value="banana">Banana</Listbox.Option>
        <Listbox.Option value="cherry">Cherry</Listbox.Option>
      </Listbox>
    </Field>
  ),
};

const FONTS = ['Arial', 'Georgia', 'Verdana', 'Times New Roman', 'Courier New'] as const;

/**
 * A font picker built only on the public listbox primitives, not on `Listbox` itself:
 * `useListbox` in select-only mode for its state and keys, `useListboxPopup` for the popup's
 * dismissal and position, and `ListboxSurface` for its list and popup — the acceptance story of
 * P5-03 (spec §10): every piece here is public API. Each `Option` shows its own font.
 */
function FontPicker() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<HTMLButtonElement>(null);
  const listbox = useListbox({
    open,
    onOpenChange: setOpen,
    mode: 'select-only',
    selectedValues: value ? [value] : [],
    onSelect: (next) => setValue(next),
  });
  // Nothing to show (every font filtered out, say): the list stays collapsed.
  const expanded = open && listbox.items.length > 0;
  const { layerId, setReference, surfaceRef, floatingProps } = useListboxPopup({
    open,
    surfaceOpen: expanded,
    onDismiss: () => setOpen(false),
    rootRef,
    anchorRef,
  });
  const buttonRef = useMergedRefs<HTMLButtonElement>(anchorRef, setReference);

  return (
    <div ref={rootRef} data-open={open ? '' : undefined}>
      <button
        type="button"
        aria-label="Font"
        {...listbox.getComboboxProps()}
        aria-expanded={expanded}
        ref={buttonRef}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          // Open with nothing shown: close it ourselves, and leave Escape to an enclosing layer
          // (never an Escape that only cancels an IME composition).
          if (event.key === 'Escape' && open && !expanded && !event.nativeEvent.isComposing) {
            setOpen(false);
            return;
          }
          listbox.onKeyDown(event);
        }}
        onKeyUp={listbox.onKeyUp}
        style={{ fontFamily: value || undefined }}
        className="flex h-9 w-56 items-center justify-between gap-2 rounded border border-border bg-background px-3 text-body-1 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="truncate">{value || 'Pick a font'}</span>
        <span aria-hidden className="shrink-0 text-muted-foreground">
          ▾
        </span>
      </button>
      <ListboxSurface
        listbox={listbox}
        layerId={layerId}
        surfaceRef={surfaceRef}
        floatingProps={floatingProps}
        open={open}
        expanded={expanded}
        aria-label="Fonts"
        listClassName="max-h-80"
      >
        {FONTS.map((font) => (
          <Option key={font} value={font} style={{ fontFamily: font }}>
            {font}
          </Option>
        ))}
      </ListboxSurface>
    </div>
  );
}

/**
 * The acceptance story: a font picker built only on the public listbox primitives (`useListbox`,
 * `useListboxPopup`, `ListboxSurface`, `Option`), not on `Listbox` itself.
 */
export const CustomPicker: Story = {
  render: () => <FontPicker />,
};

interface Command {
  id: string;
  label: string;
}

const COMMANDS: readonly Command[] = [
  { id: 'new-file', label: 'New File' },
  { id: 'open-file', label: 'Open File…' },
  { id: 'save-file', label: 'Save File' },
  { id: 'close-tab', label: 'Close Tab' },
  { id: 'toggle-sidebar', label: 'Toggle Sidebar' },
  { id: 'run-tests', label: 'Run Tests' },
];

/**
 * A command palette built on `useActiveDescendant` alone, without `useListbox`: a text input
 * (`role="combobox"`) points `aria-activedescendant` at the active command of a filtered
 * `<ul role="listbox">`. ArrowUp and ArrowDown move the active command, and Enter runs it. The
 * list has no open/close state of its own here (it is always shown): a minimal illustration of
 * the hook, not a full combobox.
 */
function CommandPaletteWidget() {
  const inputId = useId('command-palette');
  const listId = `${inputId}-list`;
  const getOptionId = (value: string) => `${inputId}-option-${value}`;
  const [query, setQuery] = React.useState('');
  const [lastCommand, setLastCommand] = React.useState<string | null>(null);
  const commands = COMMANDS.filter((command) =>
    command.label.toLowerCase().includes(query.toLowerCase()),
  );
  const activeDescendant = useActiveDescendant({
    items: commands.map((command) => command.id),
    getId: getOptionId,
    fallback: commands[0]?.id ?? null,
    activateFirstOnChange: true,
  });

  function runActiveCommand() {
    const active = commands.find((command) => command.id === activeDescendant.activeValue);
    if (!active) return;
    setLastCommand(active.label);
    setQuery('');
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-body-1 font-semibold text-foreground">
        Command palette
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={true}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeDescendant.activeDescendantId}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            activeDescendant.next();
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            activeDescendant.prev();
          } else if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            runActiveCommand();
          }
        }}
        placeholder="Type a command…"
        className="w-64 rounded border border-border bg-background px-3 py-1.5 text-body-1 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Commands"
        className="m-0 mt-1 w-64 list-none rounded border border-border bg-background py-1"
      >
        {commands.length === 0 ? (
          <li aria-disabled={true} role="option" className="px-3 py-1.5 text-muted-foreground">
            No matching commands
          </li>
        ) : (
          commands.map((command) => (
            <li
              key={command.id}
              id={getOptionId(command.id)}
              role="option"
              className={
                command.id === activeDescendant.activeValue
                  ? 'bg-subtle-hover px-3 py-1.5 text-body-1 text-foreground'
                  : 'px-3 py-1.5 text-body-1 text-foreground'
              }
            >
              {command.label}
            </li>
          ))
        )}
      </ul>
      <p className="mt-2 text-caption-1 text-muted-foreground">
        Last command: {lastCommand ?? 'none'}
      </p>
    </div>
  );
}

/**
 * A command palette built directly on `useActiveDescendant`, without `useListbox`: a minimal
 * illustration of the hook for composites that are not listboxes.
 */
export const CommandPalette: Story = {
  render: () => <CommandPaletteWidget />,
};
