/**
 * The composable TagPicker (spec P6-04): the seven parts, their defaults and flat names, the
 * parts form, registration mode, the Button trigger, routing, sizes and server rendering.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import {
  TagPicker,
  TagPickerButton,
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerList,
  TagPickerOption,
  TagPickerOptionGroup,
} from '../TagPicker';
import type { TagPickerListProps, TagPickerProps } from '../TagPicker';
import { OptionGroup } from '../Option';
import { Tag } from '../../data-display/Tag';
import { Avatar } from '../../data-display/Avatar';
import { tagRootClasses } from '../../data-display/tagStyles';
import {
  asClientReference,
  expectThrows,
  findDanglingIdRefs,
  findDanglingIdRefsInHtml,
  installResizeObserverMock,
  mockRect,
  renderWithProviders,
  testCompoundExposure,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';
import { FIELD_TEST_IDS, FIELD_TEST_TEXT, renderWithFieldContext } from '../../../test-utils-field';
import { __getAnnouncerText } from '../../../hooks/useAnnounce';
import type { ListboxItem } from '../../../hooks/useListbox';
import { tagClassNames, tagPickerClassNames } from '../../../lib/classNames';
import * as devModule from '../../../lib/dev';

const options = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

function combobox(name = 'Fruits') {
  return screen.getByRole('combobox', { name });
}

function activeOption(name = 'Fruits'): HTMLElement | null {
  const id = combobox(name).getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
}

function tags() {
  const list = screen.queryByRole('list', { name: 'Selected' });
  return list
    ? within(list)
        .getAllByRole('listitem')
        .map((el) => el.textContent)
    : [];
}

/** `html` with every generated id replaced by its order of first appearance. */
function normalizeIds(html: string): string {
  const seen = new Map<string, string>();
  return html.replace(/_r_[0-9a-z]+_|«[^»]+»|:r[0-9a-z]+:/g, (id) => {
    if (!seen.has(id)) seen.set(id, `#${seen.size}`);
    return seen.get(id)!;
  });
}

/** The parts form with the defaults written out. */
function PartsForm(props: Partial<TagPickerProps>) {
  return (
    <TagPicker aria-label="Fruits" options={options} {...props}>
      <TagPicker.Control>
        <TagPicker.Group />
        <TagPicker.Input />
      </TagPicker.Control>
      <TagPicker.List />
    </TagPicker>
  );
}

/** The parts form with registered options (registration mode). */
function Registered(props: Partial<TagPickerProps> & { listChildren?: React.ReactNode }) {
  const { listChildren, ...rest } = props;
  return (
    <TagPicker aria-label="Fruits" {...rest}>
      <TagPicker.Control />
      <TagPicker.List>
        {listChildren ?? (
          <>
            <TagPicker.Option value="apple">Apple</TagPicker.Option>
            <TagPicker.Option value="banana">Banana</TagPicker.Option>
            <TagPicker.Option value="cherry">Cherry</TagPicker.Option>
          </>
        )}
      </TagPicker.List>
    </TagPicker>
  );
}

function ButtonForm(props: Partial<TagPickerProps>) {
  return (
    <TagPicker aria-label="Fruits" options={options} {...props}>
      <TagPicker.Control>
        <TagPicker.Group />
        <TagPicker.Button />
      </TagPicker.Control>
    </TagPicker>
  );
}

const ControlWrapper = ({ children }: { children: React.ReactNode }) => (
  <TagPicker aria-label="Fruits" options={options} defaultValue={['apple']}>
    {children}
  </TagPicker>
);
const GroupWrapper = ({ children }: { children: React.ReactNode }) => (
  <TagPicker aria-label="Fruits" options={options} defaultValue={['apple']}>
    <TagPicker.Control>
      {children}
      <TagPicker.Input />
    </TagPicker.Control>
  </TagPicker>
);
const TriggerWrapper = ({ children }: { children: React.ReactNode }) => (
  <TagPicker aria-label="Fruits" options={options} defaultValue={['apple']}>
    <TagPicker.Control>
      <TagPicker.Group />
      {children}
    </TagPicker.Control>
  </TagPicker>
);
const ListWrapper = ({ children }: { children: React.ReactNode }) => (
  <TagPicker aria-label="Fruits" options={options}>
    <TagPicker.Control />
    {children}
  </TagPicker>
);
const OptionWrapper = ({ children }: { children: React.ReactNode }) => (
  <TagPicker aria-label="Fruits" defaultOpen>
    <TagPicker.Control />
    <TagPicker.List>{children}</TagPicker.List>
  </TagPicker>
);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('TagPicker parts', () => {
  describe('TagPickerControl', () => {
    testSystemProps(TagPickerControl, {
      expectedTag: 'div',
      displayName: 'TagPickerControl',
      wrapper: ControlWrapper,
      conflictingClass: { className: 'items-start', overrides: 'items-center' },
    });
  });

  describe('TagPickerGroup', () => {
    testSystemProps(TagPickerGroup, {
      expectedTag: 'div',
      displayName: 'TagPickerGroup',
      wrapper: GroupWrapper,
    });
  });

  describe('TagPickerInput', () => {
    testSystemProps(TagPickerInput, {
      expectedTag: 'input',
      displayName: 'TagPickerInput',
      wrapper: TriggerWrapper,
      control: { role: 'combobox' },
    });
  });

  describe('TagPickerButton', () => {
    testSystemProps(TagPickerButton, {
      expectedTag: 'button',
      displayName: 'TagPickerButton',
      wrapper: TriggerWrapper,
      control: { role: 'combobox' },
    });
    testNoImplicitSubmit(TagPickerButton, { wrapper: TriggerWrapper });
  });

  describe('TagPickerList', () => {
    testSystemProps(TagPickerList, {
      expectedTag: 'ul',
      displayName: 'TagPickerList',
      wrapper: ListWrapper,
    });
  });

  describe('TagPickerOption', () => {
    testSystemProps(TagPickerOption, {
      expectedTag: 'li',
      displayName: 'TagPickerOption',
      wrapper: OptionWrapper,
      defaultProps: { value: 'apple', children: 'Apple' },
    });
  });

  testCompoundExposure(TagPicker, [
    'Control',
    'Group',
    'Input',
    'Button',
    'List',
    'Option',
    'OptionGroup',
  ]);

  it('exports every member under its flat name; TagPickerOptionGroup is OptionGroup', () => {
    expect(TagPickerControl).toBe(TagPicker.Control);
    expect(TagPickerGroup).toBe(TagPicker.Group);
    expect(TagPickerInput).toBe(TagPicker.Input);
    expect(TagPickerButton).toBe(TagPicker.Button);
    expect(TagPickerList).toBe(TagPicker.List);
    expect(TagPickerOption).toBe(TagPicker.Option);
    expect(TagPickerOptionGroup).toBe(TagPicker.OptionGroup);
    expect(TagPickerOptionGroup).toBe(OptionGroup);
  });

  describe('defaults', () => {
    it('renders the parts form with the roles, names, ids and classes of the simple form', () => {
      const simple = render(
        <TagPicker aria-label="Fruits" options={options} defaultValue={['apple']} />,
      );
      const simpleHtml = simple.container.innerHTML;
      simple.unmount();
      const parts = render(<PartsForm defaultValue={['apple']} />);
      expect(normalizeIds(parts.container.innerHTML)).toBe(normalizeIds(simpleHtml));
      expect(screen.getByRole('group')).toHaveClass(tagPickerClassNames.control);
      expect(tags()).toEqual(['Apple']);
      expect(combobox()).toHaveAttribute(
        'aria-controls',
        screen.getByRole('listbox', { hidden: true }).id,
      );
    });

    it('a Control without children renders a Group and an Input', () => {
      render(
        <TagPicker aria-label="Fruits" options={options} defaultValue={['apple']}>
          <TagPicker.Control />
        </TagPicker>,
      );
      expect(tags()).toEqual(['Apple']);
      expect(combobox().tagName).toBe('INPUT');
    });

    it('a Group without children renders a Tag per selected value', () => {
      render(<PartsForm defaultValue={['cherry', 'apple']} />);
      expect(tags()).toEqual(['Cherry', 'Apple']);
      for (const tag of screen.getAllByRole('listitem'))
        expect(tag).toHaveClass(tagClassNames.root);
    });

    it('a List without children renders the options entries', async () => {
      const user = userEvent.setup();
      render(<PartsForm defaultValue={['banana']} />);
      await user.click(combobox());
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Apple', 'Cherry']);
    });

    it('a parts form without a List renders the default list, so aria-controls resolves', async () => {
      const user = userEvent.setup();
      render(
        <TagPicker aria-label="Fruits" options={options}>
          <TagPicker.Control />
        </TagPicker>,
      );
      expect(findDanglingIdRefs()).toEqual([]);
      await user.click(combobox());
      expect(screen.getByRole('listbox')).toHaveAttribute(
        'id',
        combobox().getAttribute('aria-controls'),
      );
      expect(findDanglingIdRefs()).toEqual([]);
    });
  });

  describe('development warnings', () => {
    const PLACEMENT =
      '[WaveUI] TagPicker.List: render one TagPicker.List, directly inside TagPicker (a Fragment is fine). A second list, or one inside a component of your own, splits the options over two lists.';

    it('warns TagPicker.List:placement for a List inside a wrapper component, and for a second List', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function MyList() {
        return <TagPicker.List />;
      }
      const wrapped = render(
        <TagPicker aria-label="Fruits" options={options}>
          <TagPicker.Control />
          <MyList />
        </TagPicker>,
      );
      expect(warn.mock.calls).toEqual([[PLACEMENT]]);
      wrapped.unmount();
      warn.mockClear();
      const { __resetWarnings } = devModule;
      __resetWarnings();
      render(
        <TagPicker aria-label="Fruits" options={options}>
          <>
            <TagPicker.Control />
            <TagPicker.List />
          </>
          <TagPicker.List />
        </TagPicker>,
      );
      expect(warn.mock.calls).toEqual([[PLACEMENT]]);
    });

    it('warns TagPicker:trigger for a Control without a trigger and for two triggers', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const none = render(
        <TagPicker aria-label="Fruits" options={options}>
          <TagPicker.Control>
            <TagPicker.Group />
          </TagPicker.Control>
        </TagPicker>,
      );
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] TagPicker: render exactly one trigger, `TagPicker.Input` or `TagPicker.Button`, inside `TagPicker.Control` (found 0).',
        ],
      ]);
      none.unmount();
      warn.mockClear();
      devModule.__resetWarnings();
      render(
        <TagPicker aria-label="Fruits" options={options}>
          <TagPicker.Control>
            <TagPicker.Input />
            <TagPicker.Input aria-label="Second" />
          </TagPicker.Control>
        </TagPicker>,
      );
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] TagPicker: render exactly one trigger, `TagPicker.Input` or `TagPicker.Button`, inside `TagPicker.Control` (found 2).',
        ],
      ]);
    });
  });

  describe('client references (C-COMPOUND)', () => {
    const CLIENT = {
      Control: asClientReference(TagPickerControl),
      Group: asClientReference(TagPickerGroup),
      Input: asClientReference(TagPickerInput),
      Button: asClientReference(TagPickerButton),
      List: asClientReference(TagPickerList),
    };
    const PLAIN = {
      Control: TagPickerControl,
      Group: TagPickerGroup,
      Input: TagPickerInput,
      Button: TagPickerButton,
      List: TagPickerList,
    };

    function ClientParts({
      trigger,
      client,
      ...rest
    }: Partial<TagPickerProps> & { trigger: 'input' | 'button'; client: boolean }) {
      const { Control, Group, Input, Button, List } = client ? CLIENT : PLAIN;
      return (
        <TagPicker aria-label="Fruits" options={options} {...rest}>
          <Control>
            <Group />
            {trigger === 'input' ? <Input /> : <Button />}
          </Control>
          <List />
        </TagPicker>
      );
    }

    it.each(['input', 'button'] as const)(
      'renders the same with the parts as client references (%s trigger)',
      (trigger) => {
        const plain = renderToString(
          <ClientParts trigger={trigger} client={false} defaultValue={['apple']} />,
        );
        const client = renderToString(
          <ClientParts trigger={trigger} client defaultValue={['apple']} />,
        );
        expect(client).toBe(plain);
      },
    );

    it('finds a lazy List (no default List, no warning); aria-controls resolves; open, add and remove work', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn');
      const error = vi.spyOn(console, 'error');
      render(<ClientParts trigger="input" client defaultValue={['apple']} />);
      expect(screen.getAllByRole('listbox', { hidden: true })).toHaveLength(1);
      expect(findDanglingIdRefs()).toEqual([]);
      await user.click(combobox());
      await user.click(screen.getByRole('option', { name: 'Banana' }));
      expect(tags()).toEqual(['Apple', 'Banana']);
      await user.click(screen.getByRole('button', { name: 'Remove Apple' }));
      expect(tags()).toEqual(['Banana']);
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });
  });

  describe('missing context (C-CONTEXT)', () => {
    const parts = [
      ['TagPicker.Control', <TagPickerControl key="c" />],
      ['TagPicker.Group', <TagPickerGroup key="g" />],
      ['TagPicker.Input', <TagPickerInput key="i" />],
      ['TagPicker.Button', <TagPickerButton key="b" />],
      ['TagPicker.List', <TagPickerList key="l" />],
    ] as const;

    it.each(parts)('%s throws outside TagPicker in development', (name, ui) => {
      expectThrows(ui, `[WaveUI] ${name} must be used within TagPicker`);
    });

    it.each(parts)('%s logs once and renders inert in production', (name, ui) => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { container, rerender } = render(<div>{ui}</div>);
      rerender(<div>{ui}</div>);
      expect(container.firstElementChild).toBeEmptyDOMElement();
      expect(error.mock.calls).toEqual([[`[WaveUI] ${name} must be used within TagPicker`]]);
    });

    it('the Input and the Button throw outside TagPicker.Control', () => {
      expectThrows(
        <TagPicker aria-label="Fruits" options={options}>
          <TagPicker.Input />
        </TagPicker>,
        '[WaveUI] TagPicker.Input must be used within TagPicker.Control',
      );
      expectThrows(
        <TagPicker aria-label="Fruits" options={options}>
          <TagPicker.Button />
        </TagPicker>,
        '[WaveUI] TagPicker.Button must be used within TagPicker.Control',
      );
    });
  });

  describe('rich tags', () => {
    const people = [
      { value: 'katri', label: 'Katri Athokas' },
      { value: 'elvia', label: 'Elvia Atkins' },
    ];

    function PeoplePicker(props: Partial<TagPickerProps> & { lockedTag?: boolean }) {
      const { lockedTag, ...rest } = props;
      const [value, setValue] = React.useState<string[]>(['katri', 'elvia']);
      return (
        <TagPicker
          aria-label="People"
          options={people}
          value={value}
          onValueChange={setValue}
          {...rest}
        >
          <TagPicker.Control>
            <TagPicker.Group>
              {value.map((id) => (
                <Tag
                  key={id}
                  value={id}
                  disabled={lockedTag && id === 'katri'}
                  media={<Avatar name={people.find((p) => p.value === id)?.label} decorative />}
                >
                  {people.find((p) => p.value === id)?.label}
                </Tag>
              ))}
            </TagPicker.Group>
            <TagPicker.Input />
          </TagPicker.Control>
        </TagPicker>
      );
    }

    it('renders consumer Tags with Avatar media in the Group; dismissing one calls onValueChange and announces the option’s label', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<PeoplePicker onValueChange={onValueChange} />);
      const list = screen.getByRole('list', { name: 'Selected' });
      expect(within(list).getAllByRole('listitem')).toHaveLength(2);
      expect(list.querySelector('.' + tagClassNames.media)).not.toBeNull();
      await user.click(screen.getByRole('button', { name: 'Dismiss Katri Athokas' }));
      expect(onValueChange).toHaveBeenCalledWith(['elvia']);
      await waitFor(() => expect(__getAnnouncerText()).toBe('Katri Athokas removed, 1 selected'));
    });

    it('a consumer Tag is named Dismiss <text>, a default tag Remove <label>', () => {
      render(<PeoplePicker />);
      expect(screen.getByRole('button', { name: 'Dismiss Elvia Atkins' })).toBeInTheDocument();
      render(<PartsForm defaultValue={['apple']} />);
      expect(screen.getByRole('button', { name: 'Remove Apple' })).toBeInTheDocument();
    });

    it('a consumer Tag without value warns TagGroup:missing-value', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <TagPicker aria-label="Fruits" options={options} defaultValue={['apple']}>
          <TagPicker.Control>
            <TagPicker.Group>
              <Tag>Apple</Tag>
            </TagPicker.Group>
            <TagPicker.Input />
          </TagPicker.Control>
        </TagPicker>,
      );
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] TagGroup: a tag without `value` is in a group with `onDismiss` or a selection, so it is reported by a generated id. Give every tag a `value`.',
        ],
      ]);
    });

    it('renders no tag list while nothing is selected, whatever the Group’s children', () => {
      render(
        <TagPicker aria-label="Fruits" options={options}>
          <TagPicker.Control>
            <TagPicker.Group>
              <Tag value="apple">Apple</Tag>
            </TagPicker.Group>
            <TagPicker.Input />
          </TagPicker.Control>
        </TagPicker>,
      );
      expect(screen.queryByRole('list')).toBeNull();
      expect(screen.queryByText('Apple')).toBeNull();
    });

    it('a consumer Tag disabled in an enabled picker is dimmed; in a disabled picker only the control dims', () => {
      const { unmount } = render(<PeoplePicker lockedTag />);
      const locked = () => screen.getAllByRole('listitem')[0];
      expect(locked()).toHaveClass('opacity-50');
      unmount();
      render(<PeoplePicker lockedTag disabled />);
      expect(locked()).not.toHaveClass('opacity-50');
      expect(screen.getAllByRole('listitem')[1]).not.toHaveClass('opacity-50');
      expect(screen.getByRole('group')).toHaveClass('opacity-50');
    });
  });

  describe('registration mode', () => {
    it('hides selected TagPicker.Options and skips them with the keys', async () => {
      const user = userEvent.setup();
      render(<Registered defaultValue={['banana']} />);
      await user.click(combobox());
      const listbox = screen.getByRole('listbox');
      const banana = within(listbox).getByText('Banana').closest('[role="option"]');
      expect(banana).toHaveAttribute('hidden');
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Apple');
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Cherry');
    });

    it('hides an OptionGroup whose options are all selected', async () => {
      const user = userEvent.setup();
      render(
        <Registered
          defaultValue={['apple', 'banana']}
          listChildren={
            <>
              <TagPicker.OptionGroup label="Pome">
                <TagPicker.Option value="apple">Apple</TagPicker.Option>
                <TagPicker.Option value="banana">Banana</TagPicker.Option>
              </TagPicker.OptionGroup>
              <TagPicker.OptionGroup label="Stone">
                <TagPicker.Option value="cherry">Cherry</TagPicker.Option>
              </TagPicker.OptionGroup>
            </>
          }
        />,
      );
      await user.click(combobox());
      expect(screen.queryByRole('group', { name: 'Pome' })).toBeNull();
      expect(screen.getByRole('group', { name: 'Stone' })).toBeInTheDocument();
    });

    it('never calls filter for a selected option', async () => {
      const user = userEvent.setup();
      const filter = vi.fn((item: ListboxItem, query: string) =>
        item.label.toLowerCase().includes(query),
      );
      render(<Registered defaultValue={['banana']} filter={filter} />);
      await user.type(combobox(), 'a');
      expect(filter).toHaveBeenCalled();
      const seen = new Set(filter.mock.calls.map(([item]) => item.value));
      expect(seen.has('banana')).toBe(false);
    });

    it('arrows cross groups; a group’s heading names it', async () => {
      const user = userEvent.setup();
      render(
        <Registered
          listChildren={
            <>
              <TagPicker.OptionGroup label="Pome">
                <TagPicker.Option value="apple">Apple</TagPicker.Option>
              </TagPicker.OptionGroup>
              <TagPicker.OptionGroup label="Stone">
                <TagPicker.Option value="cherry">Cherry</TagPicker.Option>
              </TagPicker.OptionGroup>
            </>
          }
        />,
      );
      await user.click(combobox());
      expect(screen.getByRole('group', { name: 'Stone' })).toBeInTheDocument();
      await user.keyboard('{ArrowDown}{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Cherry');
      await user.keyboard('{Enter}');
      expect(tags()).toEqual(['Cherry']);
    });
  });

  describe('labels', () => {
    it('shows a registered option’s label in the tag in renderToString and after hydration', async () => {
      const error = vi.spyOn(console, 'error');
      const ui = (
        <Registered
          defaultValue={['cherry']}
          options={[{ value: 'cherry', label: 'Wrong label' }]}
          listChildren={<TagPicker.Option value="cherry">Sour cherry</TagPicker.Option>}
        />
      );
      const html = renderToString(ui);
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);
      try {
        expect(container.querySelector('[role="listitem"]')).toHaveTextContent('Sour cherry');
        let root: ReturnType<typeof hydrateRoot> | undefined;
        await act(async () => {
          root = hydrateRoot(container, ui);
        });
        expect(container.querySelector('[role="listitem"]')).toHaveTextContent('Sour cherry');
        expect(error).not.toHaveBeenCalled();
        act(() => root?.unmount());
      } finally {
        container.remove();
      }
    });

    it('options name values when the List has children', () => {
      render(
        <Registered
          defaultValue={['kiwi']}
          options={[{ value: 'kiwi', label: 'Kiwi fruit' }]}
          listChildren={<TagPicker.Option value="apple">Apple</TagPicker.Option>}
        />,
      );
      expect(tags()).toEqual(['Kiwi fruit']);
    });
  });

  describe('the Button trigger', () => {
    it('is a button combobox without aria-autocomplete, in the server HTML too', () => {
      const html = renderToString(<ButtonForm />);
      const parsed = document.createElement('div');
      parsed.innerHTML = html;
      const serverButton = parsed.querySelector('[role="combobox"]')!;
      expect(serverButton.tagName).toBe('BUTTON');
      expect(serverButton).not.toHaveAttribute('aria-autocomplete');
      render(<ButtonForm />);
      expect(combobox().tagName).toBe('BUTTON');
      expect(combobox()).toHaveAttribute('type', 'button');
      expect(combobox()).not.toHaveAttribute('aria-autocomplete');
      expect(combobox()).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('Down opens, typeahead moves, Enter and Space add and keep the list open, Escape closes, a click toggles', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<ButtonForm onValueChange={onValueChange} />);
      act(() => combobox().focus());
      await user.keyboard('{ArrowDown}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      expect(activeOption()).toHaveTextContent('Apple');
      await user.keyboard(' ');
      expect(onValueChange).toHaveBeenLastCalledWith(['apple']);
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard('c');
      expect(activeOption()).toHaveTextContent('Cherry');
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenLastCalledWith(['apple', 'cherry']);
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard('{Escape}');
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      await user.click(combobox());
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      await user.click(combobox());
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
      expect(onValueChange).toHaveBeenCalledTimes(2);
    });

    it('shows the placeholder while empty and nothing once a tag is selected', () => {
      const { rerender } = render(<ButtonForm placeholder="Pick fruit" value={[]} />);
      expect(combobox()).toHaveTextContent('Pick fruit');
      rerender(<ButtonForm placeholder="Pick fruit" value={['apple']} />);
      expect(combobox()).toHaveTextContent('');
    });

    it('Backspace and the previous arrow focus the last tag', async () => {
      const user = userEvent.setup();
      render(<ButtonForm defaultValue={['apple', 'banana']} />);
      act(() => combobox().focus());
      await user.keyboard('{Backspace}');
      expect(screen.getByRole('button', { name: 'Remove Banana' })).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(combobox()).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByRole('button', { name: 'Remove Banana' })).toHaveFocus();
    });

    it('removing the last tag focuses the Button', async () => {
      const user = userEvent.setup();
      render(<ButtonForm defaultValue={['apple']} />);
      act(() => combobox().focus());
      await user.keyboard('{Backspace}{Delete}');
      await act(async () => {});
      expect(tags()).toEqual([]);
      expect(combobox()).toHaveFocus();
      expect(document.activeElement).not.toBe(document.body);
    });

    it('allowCreate shows no create option and warns TagPicker:allowCreate-button once', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<ButtonForm allowCreate />);
      await user.click(combobox());
      await user.keyboard('x');
      expect(screen.queryByRole('option', { name: /^Create/ })).toBeNull();
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] TagPicker: `allowCreate` needs `TagPicker.Input`: `TagPicker.Button` has no text to create a tag from, so no create option is offered.',
        ],
      ]);
    });

    it('renders aria-readonly while read-only', async () => {
      const user = userEvent.setup();
      render(<ButtonForm readOnly defaultValue={['apple']} />);
      expect(combobox()).toHaveAttribute('aria-readonly', 'true');
      await user.click(combobox());
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    });

    it('is labelled by its Field', () => {
      renderWithFieldContext(
        <TagPicker options={options}>
          <TagPicker.Control>
            <TagPicker.Button />
          </TagPicker.Control>
        </TagPicker>,
      );
      const button = screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label });
      expect(button).toHaveAttribute('id', FIELD_TEST_IDS.controlId);
    });
  });

  describe('routing (D65)', () => {
    it('root aria-label, id and aria-describedby reach the Input and the Button', () => {
      render(
        <>
          <span id="extra">Extra</span>
          <TagPicker
            id="fruit-input"
            aria-label="Fruits"
            aria-describedby="extra"
            options={options}
          >
            <TagPicker.Control />
          </TagPicker>
          <TagPicker
            id="fruit-button"
            aria-label="Fruit button"
            aria-describedby="extra"
            options={options}
          >
            <TagPicker.Control>
              <TagPicker.Button />
            </TagPicker.Control>
          </TagPicker>
        </>,
      );
      expect(combobox()).toHaveAttribute('id', 'fruit-input');
      expect(combobox()).toHaveAccessibleDescription('Extra');
      expect(combobox('Fruit button')).toHaveAttribute('id', 'fruit-button');
      expect(combobox('Fruit button')).toHaveAccessibleDescription('Extra');
    });

    it('the part’s own id and aria-label win', () => {
      render(
        <TagPicker id="root-id" aria-label="Root name" options={options}>
          <TagPicker.Control>
            <TagPicker.Input id="own-id" aria-label="Fruits" />
          </TagPicker.Control>
        </TagPicker>,
      );
      expect(combobox()).toHaveAttribute('id', 'own-id');
      expect(screen.queryByRole('combobox', { name: 'Root name' })).toBeNull();
    });

    it('aria-describedby joins part, root, Field and summary in that order', () => {
      renderWithFieldContext(
        <>
          <span id="own">Own</span>
          <span id="root">Root</span>
          <TagPicker aria-describedby="root" options={options} defaultValue={['apple']}>
            <TagPicker.Control>
              <TagPicker.Group />
              <TagPicker.Input aria-describedby="own" />
            </TagPicker.Control>
          </TagPicker>
        </>,
        { hintId: FIELD_TEST_IDS.hintId },
      );
      const input = screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label });
      const ids = input.getAttribute('aria-describedby')!.split(' ');
      expect(ids.slice(0, 3)).toEqual(['own', 'root', FIELD_TEST_IDS.hintId]);
      expect(ids).toHaveLength(4);
      expect(document.getElementById(ids[3])).toHaveTextContent('Selected: Apple');
    });

    it('root maxLength, autoComplete and controlRef reach the Input only', () => {
      const controlRef = React.createRef<HTMLInputElement>();
      render(
        <>
          <TagPicker
            aria-label="Fruits"
            options={options}
            maxLength={5}
            autoComplete="on"
            controlRef={controlRef}
          >
            <TagPicker.Control />
          </TagPicker>
          <TagPicker aria-label="Fruit button" options={options} maxLength={5} autoComplete="on">
            <TagPicker.Control>
              <TagPicker.Button />
            </TagPicker.Control>
          </TagPicker>
        </>,
      );
      expect(combobox()).toHaveAttribute('maxlength', '5');
      expect(combobox()).toHaveAttribute('autocomplete', 'on');
      expect(controlRef.current).toBe(combobox());
      expect(combobox('Fruit button')).not.toHaveAttribute('maxlength');
      expect(combobox('Fruit button')).not.toHaveAttribute('autocomplete');
    });

    it('handlers compose part, then root, then internal; preventDefault() in the part skips the built-in keys', async () => {
      const user = userEvent.setup();
      const calls: string[] = [];
      let prevent = false;
      render(
        <TagPicker aria-label="Fruits" options={options} onKeyDown={() => calls.push('root')}>
          <TagPicker.Control>
            <TagPicker.Input
              onKeyDown={(event) => {
                calls.push('part');
                if (prevent) event.preventDefault();
              }}
            />
          </TagPicker.Control>
        </TagPicker>,
      );
      act(() => combobox().focus());
      await user.keyboard('{ArrowDown}');
      expect(calls).toEqual(['part', 'root']);
      expect(combobox()).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard('{Escape}');
      prevent = true;
      calls.length = 0;
      await user.keyboard('{ArrowDown}');
      expect(calls).toEqual(['part']);
      expect(combobox()).toHaveAttribute('aria-expanded', 'false');
    });

    it('the List’s own aria-label names the listbox, also inside a Field (its pair replaces the root’s)', async () => {
      const user = userEvent.setup();
      renderWithFieldContext(
        <TagPicker options={options}>
          <TagPicker.Control />
          <TagPicker.List aria-label="Fruit suggestions" />
        </TagPicker>,
      );
      await user.click(screen.getByRole('combobox', { name: FIELD_TEST_TEXT.label }));
      const listbox = screen.getByRole('listbox', { name: 'Fruit suggestions' });
      expect(listbox).not.toHaveAttribute('aria-labelledby');
    });

    it('the List’s className follows its classes on the listbox; its style, data-* and ref reach the <ul>', () => {
      const ref = React.createRef<HTMLUListElement>();
      render(
        <TagPicker aria-label="Fruits" options={options}>
          <TagPicker.Control />
          <TagPicker.List
            ref={ref}
            className="max-h-40"
            style={{ minWidth: 200 }}
            data-kind="fruit"
          />
        </TagPicker>,
      );
      const list = screen.getByRole('listbox', { hidden: true });
      expect(ref.current).toBe(list);
      expect(list).toHaveClass('max-h-40');
      expect(list).not.toHaveClass('max-h-60');
      expect(list.className.trim().split(/\s+/).at(-1)).toBe('max-h-40');
      expect(list).toHaveAttribute('data-kind', 'fruit');
      expect(list.style.minWidth).toBe('200px');
    });

    it('types: forms and the active descendant are not the parts’', () => {
      render(
        <TagPicker aria-label="Fruits" options={options}>
          <TagPicker.Control>
            {/* @ts-expect-error forms are TagPicker's */}
            <TagPicker.Input name="x" />
          </TagPicker.Control>
          <TagPicker.List />
        </TagPicker>,
      );
      // @ts-expect-error forms are TagPicker's
      void (<TagPicker.Input required />);
      // A hyphenated JSX attribute is never type-checked, so the object form checks these.
      // @ts-expect-error the listbox sets it
      const activeDescendant: TagPickerListProps = { 'aria-activedescendant': 'x' };
      // @ts-expect-error the listbox sets it
      const multiselectable: TagPickerListProps = { 'aria-multiselectable': true };
      // @ts-expect-error forbidden on the list (spec impl note 4)
      const markup: TagPickerListProps = { dangerouslySetInnerHTML: { __html: '' } };
      void [activeDescendant, multiselectable, markup];
      expect(screen.getByRole('listbox', { hidden: true })).not.toHaveAttribute(
        'aria-activedescendant',
      );
    });
  });

  describe('sizes and appearances of the parts', () => {
    const cases = [
      ['medium', 'extra-small', 'outline', 'filled', 'top-1.5', 'pe-8'],
      ['large', 'small', 'underline', 'filled', 'top-1.5', 'pe-10'],
      ['extra-large', 'medium', 'filled-darker', 'outline', 'top-2.25', 'pe-10'],
      ['medium', 'extra-small', 'filled-lighter', 'filled', 'top-1.5', 'pe-8'],
    ] as const;

    it.each(cases)(
      'size=%s → tags %s; appearance=%s → tags %s; the end buttons and padding',
      (size, tagSize, appearance, tagAppearance, top, endPadding) => {
        render(
          <PartsForm
            size={size}
            appearance={appearance}
            defaultValue={['apple']}
            clearable={false}
          />,
        );
        const group = screen.getByRole('list', { name: 'Selected' });
        expect(group).toHaveAttribute('data-size', tagSize);
        expect(group).toHaveAttribute('data-appearance', tagAppearance);
        const tag = screen.getByRole('listitem');
        expect(tag).toHaveAttribute('data-size', tagSize);
        expect(tag).toHaveAttribute('data-appearance', tagAppearance);
        const expand = screen.getByRole('button', { name: 'Show options' });
        expect(expand).toHaveClass(top, 'end-1');
        expect(expand).toHaveClass(size === 'medium' ? 'h-6' : 'size-8');
        expect(expand.querySelector('svg')).toHaveAttribute(
          'width',
          size === 'medium' ? '12' : '16',
        );
        expect(screen.getByRole('group')).toHaveClass(endPadding);
      },
    );

    it.each([
      ['large', 'small', 'filled-darker', 'outline'],
      ['extra-large', 'medium', 'outline', 'filled'],
    ] as const)(
      'the chip takes the tags’ look (size=%s, tags %s, appearance=%s, tags %s)',
      (size, tagSize, appearance, tagAppearance) => {
        const ro = installResizeObserverMock();
        try {
          render(
            <PartsForm
              size={size}
              appearance={appearance}
              overflow="count"
              defaultValue={['apple', 'banana']}
            />,
          );
          const control = screen.getByRole('group');
          mockRect(control, { width: 80 });
          for (const tag of screen.getAllByRole('listitem')) mockRect(tag, { width: 70 });
          ro.trigger(control);
          const chip = control.querySelector('.' + tagPickerClassNames.overflowCount)!;
          expect(chip).toHaveTextContent('+1');
          const expected = tagRootClasses({
            size: tagSize,
            appearance: tagAppearance,
            shape: 'rounded',
          }).split(' ');
          expect(chip).toHaveClass(...expected);
        } finally {
          ro.restore();
        }
      },
    );

    it('two end buttons: the clear button sits before the expand button', () => {
      render(<PartsForm size="large" defaultValue={['apple']} clearable />);
      expect(screen.getByRole('button', { name: 'Clear selection' })).toHaveClass(
        'end-9',
        'top-1.5',
      );
      expect(screen.getByRole('button', { name: 'Show options' })).toHaveClass('end-1');
      expect(screen.getByRole('group')).toHaveClass('pe-18');
    });

    it('only the root renders data-size and data-appearance among TagPicker’s own elements', () => {
      const { container } = render(<PartsForm size="large" />);
      const sized = Array.from(container.querySelectorAll('[data-size]'));
      expect(sized).toEqual([container.firstElementChild]);
      expect(Array.from(container.querySelectorAll('[data-appearance]'))).toEqual([
        container.firstElementChild,
      ]);
    });

    it('types: the parts take neither size nor appearance', () => {
      render(
        <TagPicker aria-label="Fruits" options={options}>
          {/* @ts-expect-error TagPicker's size applies */}
          <TagPicker.Control size="large">
            {/* @ts-expect-error TagPicker's appearance applies */}
            <TagPicker.Input appearance="underline" />
          </TagPicker.Control>
        </TagPicker>,
      );
      // @ts-expect-error TagPicker's size applies
      void (<TagPicker.Group size="large" />);
      // @ts-expect-error TagPicker's size applies
      void (<TagPicker.Button size="large" />);
      // @ts-expect-error TagPicker's size applies
      void (<TagPicker.List size="large" />);
      // @ts-expect-error TagPicker's size applies
      void (<TagPicker.Input size="large" />);
      expect(combobox()).toBeInTheDocument();
    });
  });

  it('RTL: mirrors the tag arrows and the previous arrow at the caret start; the end buttons stay at the inline end', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PartsForm defaultValue={['apple', 'banana']} />, { dir: 'rtl' });
    act(() => combobox().focus());
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Remove Banana' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Remove Apple' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(combobox()).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Show options' })).toHaveClass('end-1');
    expect(screen.getByRole('group')).toHaveClass('pe-8');
  });

  it('SSR: renders and hydrates the parts form with preselected registered options, and the Button trigger', async () => {
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    for (const ui of [
      <Registered key="r" defaultValue={['banana']} defaultOpen />,
      <ButtonForm key="b" defaultValue={['apple']} defaultOpen />,
    ]) {
      const html = renderToString(ui);
      expect(findDanglingIdRefsInHtml(html)).toEqual([]);
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);
      try {
        let root: ReturnType<typeof hydrateRoot> | undefined;
        await act(async () => {
          root = hydrateRoot(container, ui);
        });
        expect(container.querySelector('[role="combobox"]')).toHaveAttribute(
          'aria-expanded',
          'true',
        );
        act(() => root?.unmount());
      } finally {
        container.remove();
      }
    }
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('a press on the empty area of a Control in the parts form opens and focuses the Button', () => {
    render(<ButtonForm />);
    const control = screen.getByRole('group');
    const press = fireEvent.mouseDown(control, { button: 0 });
    expect(press).toBe(false);
    expect(combobox()).toHaveFocus();
    expect(combobox()).toHaveAttribute('aria-expanded', 'true');
  });
});
