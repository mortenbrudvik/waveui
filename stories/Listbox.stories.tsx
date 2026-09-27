import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Field, useId, useMergedRefs } from '../src';
import { Listbox, type ListboxProps } from '../src/components/input/Listbox';
import { ListboxSurface, Option, useListboxPopup } from '../src/components/input/Option';
import { useActiveDescendant } from '../src/hooks/useActiveDescendant';
import { useListbox, type ListboxItem } from '../src/hooks/useListbox';

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

/** The navigability predicate a picker on `useListbox` builds from its own query: a
 * case-insensitive substring match on the option's `textValue`, else its `label` (Combobox's 0.7
 * default `filter`). */
function matchesFont(item: ListboxItem, text: string): boolean {
  return (item.textValue ?? item.label).toLowerCase().includes(text.toLowerCase());
}

/**
 * A font picker built only on the public listbox primitives, not on `Listbox` itself:
 * `useListbox` in editable mode for its state, filtering and keys, `useListboxPopup` for the
 * popup's dismissal and position, and `ListboxSurface` for its list and popup — the acceptance
 * story of P5-03 (spec §10): every piece here is public API. Typing opens the list and filters
 * the fonts through `useListbox`'s `filter`; Enter (or a click) selects the highlighted font;
 * blurring the input or pressing Escape while text is typed restores the selected font's name
 * instead, as Combobox's 0.7 draft does (`src/components/input/Combobox.tsx` is the full-featured
 * reference this keeps small). The chosen font submits through a plain hidden input. Each `Option`
 * shows its own font.
 */
function FontPicker() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');
  // The typed filter while editing; `null` shows the selected font's name instead.
  const [draft, setDraft] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listbox = useListbox({
    open,
    onOpenChange: (next) => {
      setOpen(next);
      // Every close (Escape with options shown, Tab, a commit) restores the selected font's name.
      if (!next) setDraft(null);
    },
    mode: 'editable',
    selectedValues: value ? [value] : [],
    onSelect: (next) => {
      setValue(next);
      setDraft(null);
    },
    filter: draft ? (item) => matchesFont(item, draft) : undefined,
    // The first match highlighted while typing, so Enter selects what the list shows; nothing
    // highlighted on a plain open, so Enter without typing does not select the first font.
    autoHighlight: draft ? 'first' : false,
  });
  // Nothing to show (every font filtered out): the list stays collapsed.
  const expanded = open && listbox.items.length > 0;
  const { layerId, setReference, surfaceRef, floatingProps } = useListboxPopup({
    open,
    surfaceOpen: expanded,
    onDismiss: () => setOpen(false),
    rootRef,
    anchorRef: inputRef,
  });
  const inputMergedRef = useMergedRefs<HTMLInputElement>(inputRef, setReference);
  const inputText = draft ?? value;

  return (
    <form
      className="flex flex-col items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(String(new FormData(event.currentTarget).get('font') ?? ''));
      }}
    >
      <div ref={rootRef} data-open={open ? '' : undefined}>
        <input
          type="text"
          aria-label="Font"
          autoComplete="off"
          {...listbox.getComboboxProps()}
          aria-expanded={expanded}
          ref={inputMergedRef}
          value={inputText}
          onChange={(event) => {
            setDraft(event.target.value);
            if (!open) setOpen(true);
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(event) => {
            // Open with nothing shown: close it ourselves, and leave Escape to an enclosing layer
            // (never an Escape that only cancels an IME composition).
            if (event.key === 'Escape' && open && !expanded && !event.nativeEvent.isComposing) {
              setOpen(false);
              setDraft(null);
              return;
            }
            listbox.onKeyDown(event);
          }}
          onKeyUp={listbox.onKeyUp}
          placeholder="Type a font name…"
          style={{ fontFamily: draft === null && value ? value : undefined }}
          className="w-56 rounded border border-border bg-background px-3 py-1.5 text-body-1 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
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
      {/* HiddenInput is internal: a plain hidden input carries the value into the form. */}
      <input type="hidden" name="font" value={value} />
      <button
        type="submit"
        className="rounded border border-border bg-background px-3 py-1.5 text-body-1 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Submit
      </button>
      <p className="text-caption-1 text-muted-foreground">
        Submitted: {submitted === null ? 'nothing yet' : submitted || '(no font)'}
      </p>
    </form>
  );
}

/**
 * The acceptance story: a font picker built only on the public listbox primitives (`useListbox`,
 * `useListboxPopup`, `ListboxSurface`, `Option`), not on `Listbox` itself. Demonstrates opening
 * and filtering the fonts by typing, selecting one, and submitting it through a plain hidden
 * input inside a form.
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
 * the hook, not a full combobox. It relies on `aria-activedescendant` alone to say which command
 * is active and announces nothing else (no live region), unlike `useListbox`'s pickers.
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
          <li
            aria-disabled={true}
            role="option"
            className="px-3 py-1.5 text-body-1 text-muted-foreground"
          >
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
