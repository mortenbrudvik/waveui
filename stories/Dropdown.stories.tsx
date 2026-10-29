import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import {
  Dropdown,
  Field,
  Option,
  useVirtualWindow,
  type DropdownProps,
  type ListboxItem,
} from '../src';
import { coreSizeArgType, inputAppearanceArgType } from './_helpers';
import { SizeAppearanceGrid } from './_grids';
import { MountedOptions } from './_mountedOptions';
import { PEOPLE, TEN_THOUSAND_PEOPLE, teamOf } from './_people';

const meta = {
  title: 'Components/Input/Dropdown',
  component: Dropdown,
  argTypes: {
    disabled: { control: 'boolean' },
    clearable: { control: 'boolean' },
    disabledOptionsFocusable: { control: 'boolean' },
    expandIcon: { control: false },
    ...coreSizeArgType,
    ...inputAppearanceArgType,
  },
  args: {
    'aria-label': 'Pet',
    onValueChange: fn(),
    onOpenChange: fn(),
    style: { width: 250 },
  },
} satisfies Meta<typeof Dropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Select an option',
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.Option value="cat">Cat</Dropdown.Option>
      <Dropdown.Option value="dog">Dog</Dropdown.Option>
      <Dropdown.Option value="fish">Fish</Dropdown.Option>
      <Dropdown.Option value="hamster">Hamster</Dropdown.Option>
    </Dropdown>
  ),
};

export const WithDefaultValue: Story = {
  args: {
    defaultValue: 'dog',
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.Option value="cat">Cat</Dropdown.Option>
      <Dropdown.Option value="dog">Dog</Dropdown.Option>
      <Dropdown.Option value="fish">Fish</Dropdown.Option>
    </Dropdown>
  ),
};

/** `clearable` adds a clear button while a value is selected, a tab stop after the combobox. */
export const Clearable: Story = {
  args: {
    defaultValue: 'dog',
    clearable: true,
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.Option value="cat">Cat</Dropdown.Option>
      <Dropdown.Option value="dog">Dog</Dropdown.Option>
      <Dropdown.Option value="fish">Fish</Dropdown.Option>
    </Dropdown>
  ),
};

export const Grouped: Story = {
  args: {
    'aria-label': 'Animal',
    placeholder: 'Select an animal',
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.OptionGroup label="Mammals">
        <Dropdown.Option value="cat">Cat</Dropdown.Option>
        <Dropdown.Option value="dog">Dog</Dropdown.Option>
      </Dropdown.OptionGroup>
      <Dropdown.OptionGroup label="Fish">
        <Dropdown.Option value="goldfish">Goldfish</Dropdown.Option>
        <Dropdown.Option value="shark" disabled>
          Shark (not available)
        </Dropdown.Option>
      </Dropdown.OptionGroup>
    </Dropdown>
  ),
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Disabled',
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.Option value="a">Alpha</Dropdown.Option>
    </Dropdown>
  ),
};

/** `multiselect` selects several options: a checkbox per option, the selected labels in the
 * button, and `clearable` clears all of them. */
export const Multiselect: StoryObj<DropdownProps<true>> = {
  args: {
    'aria-label': undefined,
    multiselect: true,
    clearable: true,
  },
  // The spread alone leaves `multiselect` optional (StoryObj widens `args`), which satisfies
  // neither call signature (D9): the literal attribute after it forces the multi-select one.
  render: (args) => (
    <Field label="Fruits">
      <Dropdown {...args} multiselect>
        <Dropdown.Option value="apple">Apple</Dropdown.Option>
        <Dropdown.Option value="banana">Banana</Dropdown.Option>
        <Dropdown.Option value="cherry">Cherry</Dropdown.Option>
        <Dropdown.Option value="date">Date</Dropdown.Option>
      </Dropdown>
    </Field>
  ),
};

/**
 * A Dropdown next to plain text that follows `onActiveOptionChange`: the highlighted option after
 * every change (arrow keys, typeahead, the pointer, opening), and "none" once the list closes.
 */
function ActiveOptionPreviewDropdown({ onActiveOptionChange, ...args }: DropdownProps) {
  const [active, setActive] = React.useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <Dropdown
        {...args}
        onActiveOptionChange={(value) => {
          setActive(value);
          onActiveOptionChange?.(value);
        }}
      >
        <Dropdown.Option value="cat">Cat</Dropdown.Option>
        <Dropdown.Option value="dog">Dog</Dropdown.Option>
        <Dropdown.Option value="fish">Fish</Dropdown.Option>
        <Dropdown.Option value="hamster">Hamster</Dropdown.Option>
      </Dropdown>
      <p className="text-caption-1 text-muted-foreground">Active option: {active ?? 'none'}</p>
    </div>
  );
}

export const ActiveOptionPreview: Story = {
  args: {
    placeholder: 'Select an option',
    onActiveOptionChange: fn(),
  },
  render: (args) => <ActiveOptionPreviewDropdown {...args} />,
};

/**
 * `expandIcon` replaces the chevron with your own glyph; a `<button>` or `Button` passed here is
 * not nested (its children become the glyph).
 */
export const CustomExpandIcon: Story = {
  args: {
    defaultValue: 'dog',
    expandIcon: <span aria-hidden>▾</span>,
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.Option value="cat">Cat</Dropdown.Option>
      <Dropdown.Option value="dog">Dog</Dropdown.Option>
      <Dropdown.Option value="fish">Fish</Dropdown.Option>
    </Dropdown>
  ),
};

/**
 * `renderValue` renders the button's content while a value is selected, in place of the selected
 * label. It receives the raw value, not the label, so it is a good place to add content the
 * label alone cannot show, such as a status dot.
 */
export const RenderedValue: Story = {
  args: {
    defaultValue: 'dog',
    renderValue: (value: string) => (
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-success" />
        <span className="capitalize">{value}</span>
      </span>
    ),
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.Option value="cat">Cat</Dropdown.Option>
      <Dropdown.Option value="dog">Dog</Dropdown.Option>
      <Dropdown.Option value="fish">Fish</Dropdown.Option>
    </Dropdown>
  ),
};

/**
 * `disabledOptionsFocusable` keeps disabled options in the arrow-key order (they still cannot be
 * selected), unlike the default, which skips them.
 */
export const DisabledOptions: Story = {
  args: {
    disabledOptionsFocusable: true,
    placeholder: 'Select an animal',
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.Option value="cat">Cat</Dropdown.Option>
      <Dropdown.Option value="dog" disabled>
        Dog (not available)
      </Dropdown.Option>
      <Dropdown.Option value="fish">Fish</Dropdown.Option>
    </Dropdown>
  ),
};

/** Invalid state through a Field error (the Field labels and describes the button). */
export const Invalid: Story = {
  args: {
    'aria-label': undefined,
    placeholder: 'Select a pet',
  },
  render: (args) => (
    <Field label="Pet" error="Choose a pet." required>
      <Dropdown {...args}>
        <Dropdown.Option value="cat">Cat</Dropdown.Option>
        <Dropdown.Option value="dog">Dog</Dropdown.Option>
      </Dropdown>
    </Field>
  ),
};

/**
 * A person's option, with their team after the name. A function defined once, so moving the
 * highlight draws only the two options whose state changed.
 */
function renderPerson(item: ListboxItem) {
  return (
    <Option value={item.value} label={item.label}>
      <span className="flex items-baseline justify-between gap-2">
        <span>{item.label}</span>
        <span className="text-caption-1 text-muted-foreground">{teamOf(item.value)}</span>
      </span>
    </Option>
  );
}

/**
 * Data mode: the 500 options come from `items`, not from children, and `renderOption` draws each
 * one with the person's team. The button shows the selected person's label while the list is
 * closed and no option is rendered; typing a name moves to it (typeahead).
 */
export const DataMode: Story = {
  args: {
    'aria-label': 'Person',
    placeholder: 'Select a person',
    defaultValue: 'person-321',
    items: PEOPLE,
    renderOption: renderPerson,
  },
  argTypes: {
    items: { control: false },
    renderOption: { control: false },
    virtualWindow: { control: false },
  },
};

/** The args of the windowed story: the Dropdown's, and the window's option height. */
type TenThousandOptionsArgs = DropdownProps & {
  /** The height of every option in pixels: `useVirtualWindow({ itemSize })`. */
  itemSize: number;
};

/** A Dropdown of 10,000 people, windowed by `useVirtualWindow`, with the mounted-option count. */
function TenThousandDropdown({ itemSize, ...args }: TenThousandOptionsArgs) {
  const virtualWindow = useVirtualWindow({ itemSize });
  const [root, setRoot] = React.useState<HTMLDivElement | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <Dropdown {...args} ref={setRoot} items={TEN_THOUSAND_PEOPLE} virtualWindow={virtualWindow} />
      <MountedOptions scope={root} total={TEN_THOUSAND_PEOPLE.length} />
    </div>
  );
}

/**
 * 10,000 options with `virtualWindow`, drawn by the same `renderOption` as the data-mode story (one
 * line, so each option fits in the window's 32 pixels): the open list renders only the options in
 * view and a few beyond them, as the line below counts. It opens on the selected person in the
 * middle of the list; End, Home, PageDown and typeahead reach any of the 10,000.
 */
export const TenThousandOptions: StoryObj<TenThousandOptionsArgs> = {
  args: {
    'aria-label': 'Person',
    placeholder: 'Select a person',
    defaultValue: 'person-5000',
    renderOption: renderPerson,
    itemSize: 32,
    style: { width: 360 },
  },
  argTypes: {
    items: { control: false },
    renderOption: { control: false },
    virtualWindow: { control: false },
    // Heights an option fits in; a smaller one would overlap the options.
    itemSize: { control: 'select', options: [32, 40, 48] },
  },
  render: (args) => <TenThousandDropdown {...args} />,
};

export const SizesAndAppearances: Story = {
  render: (args) => (
    <SizeAppearanceGrid
      render={(size, appearance) => (
        <Dropdown
          {...args}
          size={size}
          appearance={appearance}
          clearable
          defaultValue="user"
          aria-label={`${size} ${appearance}`}
        >
          <Dropdown.Option value="admin">Admin</Dropdown.Option>
          <Dropdown.Option value="user">User</Dropdown.Option>
        </Dropdown>
      )}
    />
  ),
};
